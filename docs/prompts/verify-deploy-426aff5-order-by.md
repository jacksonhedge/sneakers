# Verify deploy 426aff5 — drop wasted ORDER BY

Background: pushed commit `426aff5` (`perf: drop wasted ORDER BY from heavy snapshot queries`). Two regressions from the prior verify cascade:

1. `recompute-arb-pairs` failed with Postgres `BufFileDumpBuffer` (buffile.c:543) — disk spill on the 380k-row external sort overflowed Railway's pgsql_tmp tablespace.
2. `/dashboard`, `/dashboard/billing`, `/api/otoole/pending-drafts` started returning function-timeout `---` status as fresh-market count climbed.

Fix: drop the `ORDER BY m.id, o.id` from three queries (loadAllLatestSnapshotsFromDb, recompute-canonical, recompute-arb-pairs). Consumers group by market_id in JS via Map iteration, which doesn't depend on order. Direct-query benchmark on Railway: same 58k rows / 3.1s with or without ORDER BY.

You're a QA tester. **Concrete numbers + verbatim text.** This is the tail-end-of-night verify, so flag anything that looks worse than the prior one.

## Step 1 — Deploys

**Vercel:** Find `426aff5`. Wait until Ready + Current Production. Report deploy id + build duration.

**Railway:** Find Railway deploy for `426aff5`. Wait until Active. Report deploy id.

## Step 2 — recompute-arb-pairs success (the bug fix)

Find an iteration that started AFTER the Railway deploy went Active.

Report:
- Latest verbatim line for `→ recompute-arb-pairs` and following result
- Was: `✗ recompute-arb-pairs failed (exit 1)` with `BufFileDumpBuffer`
- Should now be: `✓ recompute-arb-pairs done (Xs)`

If still failing, quote the 5-line tail.

## Step 3 — Cross-Book Spread panel (the cascade verify)

Hard-refresh `/dashboard`. Find the Cross-Book Spread panel.

Report:
- Header count (was "0 PAIRS" for the entire session)
- First 3 pair rows verbatim if present

If pairs populate, this commit closes out one of the longest-running issues from tonight. If still empty, note whether recompute-arb-pairs has actually run successfully yet (Step 2 status).

## Step 4 — Function timeouts gone

Vercel → Logs → Runtime → filter status `---` (function timeout) over last 30 min.

Report:
- Count of `---` status entries since `426aff5` deployed
- Was: 3 in the last verify on /dashboard, /dashboard/billing, /api/otoole/pending-drafts
- Should now be: 0 (sort removal cuts ~30% of query duration)

## Step 5 — Dashboard load time + footer

1. Hard-refresh `/dashboard`. Measure Network Time.
2. Quote footer verbatim.
3. From Vercel logs, latest `[db] slow query` line — verbatim including `Xms rows=N`.

Compare to last verify:
- Load time: was 6,137ms; should be lower (~30% faster query)
- Slow query rows=N: was 58,555; expect higher as polymarket continues refreshing markets within the 24h window
- Slow query duration: was 4,136ms; should be lower

## Step 6 — Sanity

- pgsql_tmp warning frequency last 30 min (was sporadic; should now be ZERO since we removed the spill source)
- 5xx count last 30 min
- Any new errors

## Report back

```
## Step 1. Deploys
- Vercel 426aff5: <id, build>
- Railway 426aff5: <id, active since>

## Step 2. recompute-arb-pairs
- Verbatim result line: <…>
- Duration: <Xs>
- VERDICT: SUCCESS / STILL FAILING

## Step 3. Cross-Book panel
- Header count: <…>
- Sample 1: <verbatim>
- Sample 2: <verbatim>
- Sample 3: <verbatim>
- VERDICT: PAIRS POPULATED / STILL EMPTY

## Step 4. Function timeouts
- "---" count since deploy: <N>
- vs 3 baseline: <better / same / worse>

## Step 5. Dashboard perf
- Network Time: <Xms>
- Footer: <verbatim>
- Latest [db] slow query: <verbatim>
- vs 6,137ms / 4,136ms / 58,555 rows: <…>

## Step 6. Sanity
- pgsql_tmp warnings (30m): <N>
- 5xx count: <N>
- New errors: <NONE | list>

## OVERALL
- ORDER BY removal: <SUCCESS / PARTIAL / FAILED>
- Tonight's outstanding issues now closed: <list>
- Issues remaining for next session: <list>
```
