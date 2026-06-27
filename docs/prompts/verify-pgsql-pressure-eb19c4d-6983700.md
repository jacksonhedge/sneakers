# Verify pgsql_tmp pressure dropped after eb19c4d + 6983700

Background: two perf commits shipped to reduce the 376k-row pulls that surfaced the Railway Postgres "could not write to file base/pgsql_tmp/...: No space left on device" warning earlier:

- `eb19c4d` — landing `/` page now uses `loadMarketCount()` (96ms) instead of `loadAllLatestSnapshots()` (4,765ms / 125 MB)
- `6983700` — `loadAllLatestSnapshots` wrapped in React `cache()` so dashboard's parallel callers (`loadMarkets` + `loadCanonicalMarkets`) share one Postgres query instead of firing two concurrent 376k-row pulls

You're a perf QA tester. **Concrete numbers.**

## Step 1 — Confirm Vercel deploys

1. Vercel → sneakers-terminal → Deployments. Find:
   - Deployment for `eb19c4d` (perf(landing) commit)
   - Deployment for `6983700` (perf(markets) cache dedupe commit)
2. Both should be Ready. Most recent should be Current Production.
3. Report deployment ids + completion times.

## Step 2 — pgsql_tmp warning frequency

Vercel → Logs → Runtime → search for `pgsql_tmp` OR `No space left on device`.

Report:
- Count of these warnings in the last 1 hour
- Count in the last 6 hours
- Most recent occurrence timestamp
- Compare to baseline (we saw 1 occurrence at 2026-05-04 03:33:49 EDT before these fixes)

If frequency dropped to 0 since the deploys, that's success. If frequency increased, the fixes didn't help (different root cause).

## Step 3 — Landing page perf

1. Open a fresh incognito tab. Navigate to `https://sneakersterminal.com/`.
2. Open DevTools → Network → filter "Doc". Click into the document request.
3. Report:
   - **Network Time**: <…ms>  (expected: <500ms cold, was previously ~5s)
   - **Marketing stats strip rendered?** (look for the "X markets, Y venues, Z signups" text)
   - **The market count number** displayed on screen — should be a 6-figure number rounded down to nearest 10

## Step 4 — Dashboard perf (regression check)

1. Sign in (user handles), land on `/dashboard`.
2. Network tab, click the doc request.
3. Report:
   - Network Time
   - Page renders fully
   - All panels visible (BiggestVolume, ArbitragePanel, PerformanceChart, BigMovers, etc.)
   - Footer shows "X markets across Kalshi, Polymarket, OG Markets, NoVig, and ProphetX" — quote verbatim with the count

Expected: faster than before due to dedup, but cold-start may still be slow because dashboard still pulls the 376k-row snapshot once. The win is no LONGER pulling it twice.

## Step 5 — Vercel function logs

Filter to `/dashboard` and `/` routes, last 1h, on the new deployment.

Report:
- Cold + warm exec ms for `/`
- Cold + warm exec ms for `/dashboard`
- Any new errors

## Report back

```
## Step 1. Deploys
- eb19c4d: <id, time>
- 6983700: <id, time, current y/n>

## Step 2. pgsql_tmp warning frequency
- Last 1h count: <N>
- Last 6h count: <N>
- Latest occurrence: <ts | NONE>
- VS baseline (1 at 03:33:49 EDT pre-fix): <improved / unchanged / worse>

## Step 3. Landing /
- Network Time: <…ms>
- Stats strip rendered: y/n
- Market count displayed: <…>

## Step 4. Dashboard /dashboard
- Network Time: <…ms>
- Renders: y/n
- All panels visible: y/n
- Footer verbatim: <…>

## Step 5. Function logs
- / cold/warm: <…/…>
- /dashboard cold/warm: <…/…>
- New errors: <NONE | list>

## VERDICT
- pgsql_tmp pressure relief: <SUCCESS / NO CHANGE / WORSE>
- Landing perf improvement: <…x faster than 5s baseline>
- Dashboard regression: <NONE / observed>
```
