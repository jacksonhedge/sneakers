# Verify deploy 5bd4251 — precomputed canonical_id

Background: pushed commit `5bd4251` (`perf(market-detail): precomputed canonical_id replaces 200ms race`). Real fix for the 12-15s cold-start. New `markets.canonical_id` column was backfilled locally (189,536/189,537 markets populated, 24k cross-venue groups). Market-detail page now does an 80ms indexed lookup instead of pulling 376k rows / 125 MB to recompute groups in-memory. The 200ms race + solo-fallback degradation from `7d119c9` is removed.

You're a perf QA tester. **Concrete numbers + verbatim text.**

## Step 1 — Wait for deploys

Two services to check:

**Vercel deploy:**
1. Vercel → sneakers-terminal → Deployments → find `5bd4251`. Wait until Ready + Current Production. Report deployment id, build duration, elapsed since push.

**Railway scrape-loop (must pick up new recompute step):**
2. Railway → glorious-playfulness → sneakers-trading service → Logs. Find the iteration that started AFTER the most recent commit deploy (tail the log).
3. Look for these log lines (verbatim):
   - `→ recompute-canonical`
   - `✓ recompute-canonical done`  OR  `✗ recompute-canonical failed`
4. If `failed`, quote the 5-line tail printed below.
5. If neither line appears yet, wait one more iteration (~10 min) and re-check.

## Step 2 — Cold-start COLD market-detail hit

Force a cold function instance. Easiest: open a fresh incognito tab.

1. Sign in (user handles auth) → land on `/dashboard`.
2. Navigate to `https://sneakersterminal.com/dashboard/markets?platform=og`.
3. Open DevTools → Network → filter "Doc".
4. Click the **first OG market card**.
5. Read the request's `Time` column verbatim.

Report:
- **Network Time (cold)**: <…ms>
- **Cross-venue overlay visible on first paint?** (count chart legend lines — primary + secondary entries)
- **Page renders fully?** y/n

Expected: <1s cold, with cross-venue overlay if the market has cross-venue mirrors. Previous stopgap (`7d119c9`) was ~200ms cold but solo-only on first visit; this fix should preserve overlay on first visit.

## Step 3 — Same instance, second hit

Browser back → click a different OG market.

Report:
- Network Time (warm): <…ms>
- Cross-venue overlay: present / absent
- Should be roughly equal to Step 2 (~80-200ms range).

## Step 4 — Pick a market with KNOWN cross-venue mirrors

Run this query intent in Chrome — navigate to a Kalshi market that's likely mirrored on Polymarket (e.g., a "Will X happen by Y" type market). Look at the chart for multiple lines in the legend.

Easier proxy: from the dashboard, look at the "Cross-Book Spread" panel. Click any market listed there (it's specifically the cross-venue ones). Confirm:
- Chart legend shows >1 venue line
- Order book shows >1 venue row
- Number "N venues" in the header is >1

If the cross-book panel is empty (it was at "0 PAIRS" earlier today), instead navigate manually to a Kalshi NBA Finals MVP market or similar.

## Step 5 — NoVig, ProphetX, OG sanity

Hit one market on each platform. For each, report:
- Network Time
- Page renders (y/n)
- Chart shows real history (not the "still loading" fallback)

## Step 6 — Function logs

Vercel → Logs → Runtime → last 10 min on `5bd4251` deployment.

Report:
- **Cold-hit exec ms** for `/dashboard/markets/[platform]/[marketId]`: <…>
- **Warm-hit exec ms**: <…>
- Any errors mentioning `loadCanonicalForMarket`, `canonical_id`, or `recompute-canonical`
- Any errors mentioning `dbRowsToSnapshot` (we just exported it — type changes can sometimes cascade)
- Any new 5xx

## Report back

```
## Step 1. Deploys
- Vercel 5bd4251 deployment id: <…>
- Vercel build: <…s>
- Railway recompute-canonical seen: <yes/no — last timestamp>
- Railway iteration N completion line: <verbatim>

## Step 2. Cold OG hit
- Network Time: <…ms>
- Cross-venue overlay: present / absent
- First-paint chart legend entries: <N>

## Step 3. Warm OG hit (different market)
- Network Time: <…ms>
- Overlay: present / absent

## Step 4. Cross-venue market
- Source: <…>
- Network Time: <…ms>
- Legend lines: <N>
- "N venues" badge: <…>

## Step 5. Multi-platform sanity
- NoVig: time=<…ms>, renders=y/n, history=y/n
- ProphetX: time=<…ms>, renders=y/n, history=y/n
- OG: time=<…ms>, renders=y/n, history=y/n
- Kalshi: time=<…ms>, renders=y/n, history=y/n

## Step 6. Function logs
- Cold exec ms: <…>
- Warm exec ms: <…>
- New errors: <NONE | list>

## VERDICT
- canonical_id fix: <SUCCESS / PARTIAL / FAILED>
- Cold-start improvement vs baseline 12-15s: <…x faster>
- Cross-venue overlay always present (no solo-fallback degradation): <y/n>
- Recompute job running on Railway: <y/n>
- Regressions: <NONE / list>
```
