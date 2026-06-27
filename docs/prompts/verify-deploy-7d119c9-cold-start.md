# Verify deploy 7d119c9 — market-detail cold-start fix

Background: pushed commit `7d119c9` (`perf(market-detail): race canonical load against 200ms budget`). Previous cold-start on `/dashboard/markets/[platform]/[marketId]` was 12-15s because `loadCanonicalMarkets()` pulls 376k rows / 125 MB on every fresh function instance. Fix races canonical against a 200ms budget — cache-hot wins (full overlay), cache-cold falls back to solo book render.

You're a perf QA tester. **Be concrete with numbers + verbatim text.**

## Step 1 — Wait for deploy

Vercel → sneakers-terminal → Deployments → find `7d119c9`. Wait until Ready + Current Production. Report deployment id, build duration, elapsed since push.

## Step 2 — Force a COLD market-detail hit

To prove the fix, we need to hit a market-detail page on a cold function instance. Strategy: wait until a low-traffic moment (or just go fast — Vercel scales down idle instances after ~minutes).

1. Open a fresh tab. Go to `https://sneakersterminal.com/dashboard`.
2. Navigate to `https://sneakersterminal.com/dashboard/markets?platform=og`.
3. Click an OG market (any one).
4. **Time the page render** — start clock when you click, stop when the chart finishes painting (or use DevTools Network tab → "Doc" filter → `Time` column on the page request).
5. Report:
   - **Time to render (network "Time" column)**: <Xs>
   - **Was the cross-venue overlay visible?** (look at chart legend — does it show >1 line, or just one for the requested book?)
   - **Page renders?** y/n

## Step 3 — Immediately repeat (warm hit on same instance)

Within 30s of Step 2 (so we hit the same warm function instance):

1. Hit browser back → land on the OG markets list.
2. Click a DIFFERENT OG market.
3. Report:
   - **Time to render**: <Xs>
   - **Cross-venue overlay visible?** (this should now be present — canonical cache populated by Step 2's background load)

## Step 4 — Function logs

Vercel → Logs → Runtime → last 5 min on `7d119c9` deployment.

For the market-detail route specifically, report:
- **Cold-hit exec duration** (the slow first hit): <ms>
- **Warm-hit exec duration** (subsequent hits): <ms>
- Any new errors mentioning `loadCanonicalMarkets`, `canonical`, or `Promise.race`
- Any unhandled rejection warnings

## Step 5 — Sanity: Kalshi market still works

1. `/dashboard/markets?platform=kalshi` → click first market.
2. Confirm:
   - Page renders (cold or warm)
   - Chart shows real history (not the "still loading" fallback we fixed yesterday)
   - Cross-venue overlay either present (warm) or absent (cold solo) — but no errors

## Report back

```
## Step 1. Deploy
- 7d119c9 deployment id: <…>
- Build: <…>s
- Elapsed since push: <…>

## Step 2. COLD market-detail hit (OG)
- Network Time: <…>
- Cross-venue overlay: present / absent
- Page renders: y/n
- Note (any visible degradation): <…>

## Step 3. WARM hit (same instance, different OG market)
- Network Time: <…>
- Cross-venue overlay: present / absent

## Step 4. Function logs
- Cold-hit exec ms: <…>
- Warm-hit exec ms: <…>
- New errors: <NONE | list>
- Unhandled rejections: <NONE | list>

## Step 5. Kalshi sanity
- Renders: y/n
- Chart history present: y/n
- Errors: <NONE | list>

## VERDICT
- Cold-start fix: <SUCCESS / PARTIAL / FAILED>
- Cold→warm time delta: <…>
- Regressions: <NONE / list>
```
