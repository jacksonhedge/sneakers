# Verify deploy ebb99b0 — polymarket parallelization unblocks downstream

Background: pushed commit `ebb99b0` (`perf(scrapers/polymarket): batch orderbook fetches at concurrency=10`). Polymarket scraper had been timing out at 5min (exit 124) for several iterations because per-market orderbook fetches were sequential. Now batched at 10-wide parallel, expected to finish in ~30s.

Cascade effects to verify:
1. Polymarket completes without timeout
2. After recompute-arb-pairs runs, `cross_book_pairs` table populates (was empty because no fresh polymarket data)
3. Dashboard footer count recovers from earlier 21K toward ~190K (more markets fresh within 24h LATERAL JOIN window)
4. Dashboard "Cross-Book Spread" panel shows pairs

Patience: Railway needs to deploy + run at least one full iteration with new code. ~10-15 min after push for the first complete cycle.

You're a QA tester. **Concrete numbers + verbatim text.**

## Step 1 — Railway deploy

1. Railway → glorious-playfulness → sneakers-trading service → Deployments. Find `ebb99b0`. Wait until Active.
2. Report deploy id + active timestamp.

## Step 2 — Polymarket scraper success (THE fix)

1. Open Logs. Find an iteration that started AFTER the Railway deploy went Active.
2. Look for these lines in order:
   - `→ polymarket`
   - `✓ polymarket done` ← this was missing for several prior iterations
3. Report:
   - Polymarket start ts
   - Polymarket completion: ✓ done OR ✗ failed (exit code)
   - **Wall-clock duration** of polymarket step (was 5min timeout; should now be <60s)
   - Snapshot count if shown in the log tail (`N markets scraped in Xs`)

If `✗ polymarket failed` again, quote the 5-line tail. Likely cause = code bug in the parallel batching.

## Step 3 — recompute-arb-pairs output

Same iteration:
1. Find `→ recompute-arb-pairs` and `✓ recompute-arb-pairs done` lines.
2. The recompute job should now have polymarket data to pair against. Sample the log:
3. Report verbatim ✓/✗ line + duration.

## Step 4 — Cross-Book panel populates (THE downstream verify)

1. Hard-refresh `https://sneakersterminal.com/dashboard`.
2. Find the **Cross-Book Spread** panel.
3. Report:
   - Header count (was "0 PAIRS" — should now be a positive number)
   - First 2 pair rows verbatim if present
4. If still "0 PAIRS" after iteration completes successfully, that's a real problem worth flagging.

## Step 5 — Footer count recovery

1. Quote dashboard footer verbatim.
2. Compare to:
   - Last verify (after `133fdb6`): "191,911 markets"
   - The "21K mystery" before fix: "21,599 markets"

Note: footer uses `loadMarketCount()` which counts all non-closed markets (always ~191K). What we ACTUALLY want to verify is that the SLOW query (the LATERAL JOIN one with 24h freshness filter) now returns more rows.

Report from Vercel logs `[db] slow query` lines:
- Latest occurrence: `[db] slow query Xms rows=N sql="..."`
- The `rows=N` value — was 46,749 (bad), should now climb toward 380K+ as polymarket markets refresh

## Step 6 — Sanity

1. /dashboard renders all panels: y/n
2. /dashboard load time
3. 5xx count last 10 min
4. Any new errors

## Report back

```
## Step 1. Railway deploy
- ebb99b0 deploy id: <…>
- Active since: <…>

## Step 2. Polymarket success
- Start: <ts>
- Result: ✓ done / ✗ failed (exit N)
- Duration: <Xs>
- Snapshot count: <N markets in Xs>
- VERDICT: FIX WORKED / STILL TIMING OUT

## Step 3. recompute-arb-pairs
- Verbatim: <…>
- Duration: <Xs>

## Step 4. Cross-Book Spread panel
- Header count: <…>
- Sample row 1: <verbatim>
- Sample row 2: <verbatim>
- VERDICT: PAIRS POPULATED / STILL EMPTY

## Step 5. Footer + slow-query
- Footer verbatim: <…>
- Latest [db] slow query rows=N: <N>
- vs 46,749 baseline: higher / similar / lower
- VERDICT: FRESH-MARKET COUNT RECOVERING / STILL LOW

## Step 6. Sanity
- Renders: y/n
- /dashboard load time: <ms>
- 5xx count: <N>
- New errors: <NONE | list>

## OVERALL VERDICT
- Polymarket fix: <SUCCESS / FAILED>
- Cross-book downstream: <POPULATED / STILL EMPTY>
- Dashboard freshness: <RECOVERING / FLAT>
```
