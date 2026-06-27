# Plan — precomputed `canonical_groups` table

## Why

Current cold-start on `/dashboard/markets/[platform]/[marketId]` is 12-15s. Bottleneck (per timing run 2026-05-04):

| Op | Time | Size |
|---|---|---|
| `loadAllLatestSnapshots` | 4,765ms | 125 MB / 376k rows |
| Single market lookup | 77ms | 2 rows |
| Single market history | 78ms | 168 rows |
| pg pool connect | 418ms |

Tonight's deploy (`7d119c9`) races the canonical load against a 200ms budget — cache-hot wins, cache-cold falls back to solo render and loses the cross-venue chart overlay on the first visit per function instance. **That's a UX downgrade,** acceptable as a stopgap but not the right end state.

The real fix: precompute the canonical groups in the DB so the detail page can do an indexed lookup ("what canonical group is market X in?") instead of pulling 376k rows to recompute groups in-memory.

## Current shape

`groupIntoCanonical(snapshots)` (in `apps/platform/src/lib/canonical-markets.ts`) computes a stable group ID for each market based on:
1. **Phase 1 — exact-question match.** `canonicalQuestion(question, sport)` produces a normalized key. Markets with the same key form a group.
2. **Phase 2 — sport signature.** Phase 1 singletons get matched on `sportsSignature(snap)` (teams + league + market type). Same signature → same group.
3. **Singletons** that don't match either pass become their own group, keyed off `(platform, platform_market_id)`.

The grouping is **deterministic** given the same input snapshots — same key in → same group ID out.

## Proposal

### 1. Schema (Railway Postgres)

Add a `canonical_id` column to `markets`:

```sql
alter table markets
  add column if not exists canonical_id text;

create index if not exists markets_canonical_id_idx
  on markets (canonical_id)
  where canonical_id is not null;
```

`canonical_id` shape mirrors what `toCanonical()` already produces: `c_<hash>` for grouped markets, `s_<platform>_<id>` for singletons. Stable across recomputes.

### 2. Population

Two approaches:

**A. Recompute job in scrape-loop.** Every iteration, after all scrapers finish:
```
node --loader ts-node/esm src/jobs/recompute-canonical.ts
```
Job:
1. `SELECT id, source, question, category, raw_metadata FROM markets WHERE status <> 'closed'`
2. `groupIntoCanonical()` over the rows (in-memory, ~5s)
3. `UPDATE markets SET canonical_id = $2 WHERE id = $1` (batched, idempotent)

Pros: simple, runs every 10 min along with scrapers. No new infra.
Cons: every iteration does the full recompute work — wasted when most markets unchanged.

**B. Incremental.** Compute on insert in `db-write.ts` for new markets only. Periodic full recompute (daily?) to catch question-edits.

**A is the right call for v1.** Volume is small enough; simpler.

### 3. Platform read path

Add to `apps/platform/src/lib/canonical-markets.ts`:

```ts
export async function loadCanonicalForMarket(
  platform: string,
  platformMarketId: string,
): Promise<CanonicalMarket | null> {
  const id = `${platform}:${platformMarketId}`
  const sql = `
    WITH target AS (SELECT canonical_id FROM markets WHERE id = $1)
    SELECT m.id, m.source, m.question, ... [full snapshot fields]
    FROM markets m
    JOIN outcomes o ON o.market_id = m.id
    JOIN LATERAL (...latest price observation...) l ON TRUE
    WHERE m.canonical_id = (SELECT canonical_id FROM target)
      AND m.canonical_id IS NOT NULL
  `
  // ~50ms expected: index seek on canonical_id, then per-market index on (m_id, o_id) for the LATERAL.
  // Returns 1-N quotes (the entire group).
  // Build CanonicalMarket from rows + return.
}
```

Update market-detail page to call `loadCanonicalForMarket()` instead of `loadCanonicalMarkets()`. Race + 200ms timeout no longer needed — targeted lookup is well under budget.

### 4. Migration of existing callers

`loadCanonicalMarkets()` is also called by:
- Dashboard page (loads everything for big-movers + sparklines + venue counts)
- `findCanonicalById(id)` — admin lookup
- `findCanonicalForSnapshot(p, id)` — same use case as new function above
- `canonicalReps()` — for biggest-volume / movers panels

Most of these legitimately need ALL canonical markets (for global aggregations). Keep `loadCanonicalMarkets()` for them. Only the market-detail page (single-market lookup) gets the new targeted path.

`findCanonicalForSnapshot()` can also switch to the targeted path — same shape.

## Effort estimate

| Step | Effort |
|---|---|
| Migration + index | 5 min |
| One-shot backfill script | 30 min |
| Recompute job in scrape-loop | 30 min |
| `loadCanonicalForMarket()` | 30 min |
| Swap market-detail page + remove race | 10 min |
| Verify | 30 min |
| **Total** | **~2 hours** |

## Cleanup after ship

- Remove the 200ms race timeout from market-detail page (`7d119c9` fix becomes obsolete)
- Optionally: add metric/log for canonical_id population freshness so we can spot when the recompute job is failing
- Future: revisit if dashboard page's full-canonical load becomes a bottleneck (currently ~5s, only on cold-start, mostly tolerated)

## Open questions

- Where should the recompute job live? Same Railway service as scrape-loop, or its own container? Same is fine for v1.
- What happens to `canonical_id` for closed markets? Leave the value, query filters them out. Cheaper than NULLing.
- Idempotency: if scrape-loop crashes mid-recompute, partial canonical_ids are fine because the next iteration recomputes everything from scratch.
