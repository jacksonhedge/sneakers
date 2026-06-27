# Verify deploys 545197a + 133fdb6 — observability + footer count fix

Background: two follow-ups from the prior verify of `48d1c76`:

1. `545197a` — added slow-query (>3s) logging and SQL-tag-on-failure logging to `safeQuery()`. Pure observability, no behavior change.
2. `133fdb6` — dashboard footer count now uses `loadMarketCount()` (targeted ~96ms count query) instead of `marketsResult.total` (which had been returning ~21k vs the true ~191k from direct DB count, root cause unknown).

Also re-checking the cross-book pairs panel (was empty in last verify — worth seeing if iteration 2+ on Railway populated it now that polymarket may have recovered).

You're a QA tester. **Concrete numbers + verbatim text.**

## Step 1 — Deploy

Vercel → sneakers-terminal → Deployments. Find `133fdb6` (most recent). Wait until Ready + Current Production. Report deployment id + build duration.

## Step 2 — Footer count check (THE fix)

1. Hard-refresh `https://sneakersterminal.com/dashboard`.
2. Quote footer text **verbatim**. Should now show 100k+ markets, not 21k.
3. Compare to last verify's "21,599 markets across..." — if the number is substantially higher (~100k+), the fix worked.

Report:
- Footer verbatim
- Approximate market count (just the number)
- vs 21,599 baseline: <higher / similar / lower>

## Step 3 — Cross-Book panel re-check

Latest Railway iteration may have populated `cross_book_pairs` if polymarket recovered (it failed in iteration 1 with exit 124).

1. On `/dashboard`, look at the **Cross-Book Spread** panel.
2. Report:
   - Header count (was "0 PAIRS")
   - Pair rows visible
   - 1-2 verbatim sample rows if present

3. Open Railway logs → find iterations 2+ → report:
   - polymarket status: ✓ done or ✗ failed
   - recompute-arb-pairs status: ✓ done or ✗ failed + tail
   - Any "[db] slow query" or "[db] query failed" lines from the new observability

## Step 4 — Vercel logs for new observability output

Vercel → Logs → Runtime → last 10 min. Search for `[db] slow query` and `[db] query failed`.

Report VERBATIM any matches:
- `[db] slow query Xms rows=N sql="..."` lines
- `[db] query failed after Xms, falling back: <message> sql="..."` lines

The slow-query log will tell us if heavy queries are partially completing. The fallback log will tell us if `marketsResult.total` is underflowing because the underlying query is silently failing.

## Step 5 — Sanity

1. /dashboard renders all panels: y/n
2. /dashboard load time
3. 5xx count last 10 min
4. Any new errors mentioning `loadMarketCount`

## Report back

```
## Step 1. Deploy
- 133fdb6: <id, build, ready y/n>

## Step 2. Footer count
- Verbatim: <…>
- Number: <…>
- vs 21,599: higher / similar / lower
- VERDICT: FIX WORKED / STILL UNDERCOUNTING

## Step 3. Cross-Book panel
- Header count: <…>
- Sample rows: <verbatim or n/a>
- Latest Railway iteration polymarket: ✓ / ✗
- recompute-arb-pairs: <verbatim>

## Step 4. Vercel observability output
- Slow-query lines: <verbatim list or NONE>
- Failed-query lines: <verbatim list or NONE>
- Top slow query (if any): <which sql, how slow, how many rows>

## Step 5. Sanity
- Renders: y/n
- /dashboard load time: <ms>
- 5xx count: <N>
- New errors: <NONE | list>
```
