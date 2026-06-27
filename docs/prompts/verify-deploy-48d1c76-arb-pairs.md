# Verify deploy 48d1c76 — cross-book pairs precompute + starts_at fix

Background: pushed commit `48d1c76`. Two compounded fixes:

1. **Silent data-shape bug**: scraper never persisted `starts_at` to the DB. `dbRowsToSnapshot` returned `starts_at: undefined`, so `findCrossBookPairs` filtered every market out. The dashboard's "Cross-Book Spread" panel has been showing "0 PAIRS" not because there are no pairs — but because the scanner saw no eligible inputs.

2. **Perf**: cross-book pairs are now precomputed by a new Railway scrape-loop step (`recompute-arb-pairs`) into a `cross_book_pairs` table. Dashboard reads via `loadCrossBookPairs(10)` — sub-100ms indexed scan vs the prior 188k-row in-memory scan.

The fix requires Railway to (a) deploy the new scrape code, (b) run a scrape iteration so existing markets get `starts_at` backfilled into raw_metadata, (c) run `recompute-arb-pairs` so the table populates. ~10-15 min total after deploy.

You're a perf + data QA tester. **Concrete numbers + verbatim text.**

## Step 1 — Confirm both deploys

**Vercel:** sneakers-terminal → Deployments → find `48d1c76`. Wait until Ready + Current Production. Report deployment id, build duration, elapsed since push.

**Railway:** glorious-playfulness → sneakers-trading service → Deployments → find the deploy for `48d1c76`. Wait until Active. Report Railway deploy id + status.

## Step 2 — Confirm Railway scrape iteration backfilled starts_at

Railway → sneakers-trading → Logs. Find an iteration that completed AFTER the Railway deploy time (not before).

For that iteration, look for these lines (verbatim):
- `✓ polymarket done` (any scraper succeeding confirms backfill happened — every scrape UPSERTs markets with the new raw_metadata.starts_at)
- `→ recompute-canonical`
- `✓ recompute-canonical done`
- `→ recompute-arb-pairs`  ← NEW STEP
- `✓ recompute-arb-pairs done`  OR `✗ recompute-arb-pairs failed`

If `✗ recompute-arb-pairs failed`, quote the 5-line tail. Likely cause = schema/typo in the new script.

## Step 3 — Cross-Book Spread panel on /dashboard (THE bug-fix verify)

1. Hard-refresh `https://sneakersterminal.com/dashboard`.
2. Find the **Cross-Book Spread** panel.
3. Report:
   - **Number shown in header** (was "0 PAIRS"; should now be a positive number like "5 PAIRS" or "10 PAIRS")
   - **Number of pair rows visible**
   - **Sample 2 pair rows verbatim** — quote the team names, sports, prices
   - If still "0 PAIRS", check Step 2 — recompute-arb-pairs may not have run yet. Wait one more iteration (~10 min) and re-check.

## Step 4 — Dashboard load time

Network tab → click `/dashboard` doc request.

Report:
- Network Time
- Page renders fully
- All panels visible (BiggestVolume, ArbitragePanel, PerformanceChart, BigMovers, UpcomingResolutions, MyPositions)
- Footer count verbatim

## Step 5 — Click into one cross-book pair

If pairs are populating (Step 3), click into one. The market detail page should:
- Render with full canonical group (multi-venue overlay)
- Show the same teams + sport + start time as the panel

Report:
- Detail page load time
- "N venues" count on the detail page header
- Confirmed starts_at displayed somewhere (was missing before this fix)

## Step 6 — Function logs

Vercel → Logs → Runtime → last 10 min on `48d1c76`.

Report:
- 5xx count
- Any new errors mentioning `cross_book_pairs`, `loadCrossBookPairs`, `recompute-arb-pairs`, `findCrossBookPairs`, or `starts_at`
- pgsql_tmp warning frequency (should be lower or zero — this commit reduces snapshot pulls further)

## Report back

```
## Step 1. Deploys
- Vercel 48d1c76: <id, build, elapsed>
- Railway 48d1c76: <deploy id, status>

## Step 2. Railway scrape iteration
- Latest iteration N completion ts: <…>
- recompute-arb-pairs: <verbatim ✓/✗ line + duration>
- recompute-canonical (sanity): <verbatim ✓ line>

## Step 3. Cross-Book Spread panel (THE BUG-FIX VERIFY)
- Header count: <…> (was "0 PAIRS")
- Pair rows visible: <N>
- Sample 1: <verbatim>
- Sample 2: <verbatim>
- Status: PAIRS POPULATED / STILL EMPTY

## Step 4. Dashboard load
- Network Time: <…ms>
- All panels render: y/n
- Footer: <verbatim>

## Step 5. Cross-book pair detail page
- Load time: <…ms>
- N venues: <N>
- starts_at visible: y/n

## Step 6. Function logs
- 5xx count: <N>
- New errors: <NONE | list>
- pgsql_tmp warnings (1h): <N>

## VERDICT
- Cross-book bug fix: <SUCCESS / STILL EMPTY / FAILED>
- Dashboard regression: <NONE / observed>
- pgsql_tmp pressure: <improved / unchanged / worse>
```
