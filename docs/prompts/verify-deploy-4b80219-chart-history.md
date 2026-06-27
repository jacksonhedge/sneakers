# Verify deploy 4b80219 — chart history fix

Background: pushed commit `4b80219` (`fix(market-detail): targeted history loader fixes flat-line chart fallback`). Bug was that the global `loadMarketHistory` LIMIT 200k was eaten alphabetically by Kalshi rows, so OG/NoVig/ProphetX market detail charts always rendered the "Price history is still loading — showing live quotes only" flat-line fallback even when their `price_observations` table had 80+ snapshots.

Fix: new `loadSingleMarketHistory(platform, id, days)` per-market indexed seek, called in parallel for all canonical book mirrors. Kalshi/Polymarket charts were already working and should remain unchanged.

You're a UX QA tester. **Be concrete. Verbatim text + numbers.**

## Step 1 — Wait for deploy

Vercel → sneakers-terminal → Deployments → find `4b80219`. Wait until status = Ready, marked Current Production. Report deployment id + build duration + total elapsed since push.

## Step 2 — Hard refresh

Visit `https://sneakersterminal.com/dashboard` and Cmd+Shift+R so we're on the new bundle.

## Step 3 — OG market detail (the bug case)

1. Navigate to `https://sneakersterminal.com/dashboard/markets?platform=og`.
2. Click the **first OG market card** in the list.
3. On the detail page, look at the chart area.

Report:
- **Chart points label** — should NOT say "2 pts". Quote the verbatim point count from the chart legend/header (e.g. "81 pts · primary").
- **"Price history is still loading…" banner** — should be ABSENT. If still present, flag.
- **Chart visual** — does it show a non-flat curve with multiple data points over the X axis? Or still two flat horizontal lines?
- **Time range visible** — what's the earliest timestamp on the X axis vs latest? Should span hours/days, not be a flat 1-pt line.

## Step 4 — Sanity: Kalshi (should be unchanged)

1. From `/dashboard`, navigate to `/dashboard/markets?platform=kalshi`.
2. Click the first Kalshi market.
3. Report:
   - Chart points label
   - "Still loading" banner present? (should NOT be — Kalshi was always working)
   - Visual: real curve or flat?

If Kalshi regressed (now showing flat), the fix introduced a regression — flag immediately.

## Step 5 — Spot check NoVig + ProphetX (also should be fixed)

For each:
1. `/dashboard/markets?platform=novig` → first card → chart
2. `/dashboard/markets?platform=prophetx` → first card → chart

Report for each:
- Chart points label
- "Still loading" banner present?
- Visual: real curve or flat?

These should now show real history (same fix as OG).

## Step 6 — Function logs

Vercel → Logs → Runtime → last 5 min on the new deployment.

Report:
- Count of 5xx errors
- Any new error patterns mentioning `loadSingleMarketHistory`, `price_observations`, or `markets-data`
- Function execution duration on the market-detail route — should be similar to before or faster (we replaced one big query with N small ones, but they run in parallel and are indexed seeks)

## Report back

```
## Step 1. Deploy
- 4b80219 deployment id: <…>
- Build: <…>s
- Status: <…>
- Elapsed since push: <…>

## Step 3. OG market chart (THE FIX)
- Chart points label verbatim: <…>
- "Still loading" banner: present / absent
- Curve shape: real curve / flat lines
- Time range on X-axis: <…>

## Step 4. Kalshi sanity
- Chart points: <…>
- Banner: present / absent
- Visual: <…>
- REGRESSION? <y/n>

## Step 5. NoVig + ProphetX
- NoVig: pts=<N>, banner=<…>, visual=<…>
- ProphetX: pts=<N>, banner=<…>, visual=<…>

## Step 6. Logs
- 5xx count: <N>
- New errors: <list or NONE>
- Market-detail exec duration: <ms>

## VERDICT
- Chart history fix: <FULL SUCCESS / PARTIAL / FAILED>
- Regressions: <NONE / list>
```
