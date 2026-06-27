# Sneakers Terminal — verify OG markets are populating the live terminal

Background: last night we shipped commit `4cdd858` expanding the OG scraper from 11 → 28 groups (2.5× contracts per iteration). Local validation ran 1,731 contracts in 16.1s. The Railway scrape-loop runs `og` every ~10 min and dual-writes JSONL + Timescale. We need to confirm OG markets are actually surfacing in the production terminal with fresh data, not just landing in the DB.

You're a UX QA tester. **Be concrete. Counts + verbatim text + screenshots of anything weird. No adjectives.**

## Sign in fresh

1. Go to `https://sneakersterminal.com/login`. Sign in with the credentials the user provides (or stop and ask).
2. Land on `/dashboard`. Hard refresh once (Cmd+Shift+R) so you're on the latest deploy.

## A. OG-filtered markets list

1. Navigate to `https://sneakersterminal.com/dashboard/markets?platform=og`.
2. Wait for the list to fully render (no skeleton loaders).
3. Record:
   - **Total OG markets visible** (scroll to bottom; if paginated, note the total count from any "X markets" indicator)
   - **Most recent "updated X ago"** value on any row — should be **<10 min**
   - **Oldest "updated X ago"** value visible — flag if anything is **>30 min** old
   - **Sample 5 question titles verbatim** from the list (first 3, then 2 from middle/bottom)

## B. Variety check (does the 28-group expansion show?)

The new groups added last night include: World Cup, NFL, F1, tennis, cricket, college baseball, EU top-5 leagues, South American leagues, and economics/inflation markets.

Use the search box (or scroll + Cmd+F) and report **yes/no + 1 example title** for each:
- World Cup
- NFL
- Formula 1 / F1
- Tennis
- Cricket
- Inflation (any "Inflation in Apr 2026 — X%" markets)
- Premier League / La Liga / Bundesliga / Serie A / Ligue 1 (any one)

If 5+ of these 7 categories are present, expansion is live. If 0–2, the deploy hasn't picked up the new group list.

## C. Open one OG market

1. Click the first OG market in the list.
2. Confirm the detail page renders with: question text, outcomes/prices, a chart, and a buy/sell or venue-link panel.
3. On the chart, confirm there are **multiple data points over time** (not a single dot) — scrape-loop has been running long enough that we should see hours of history.
4. Hit back → confirm you're back on the filtered list, not /dashboard.

## D. Apps-bar sanity (NOT in featured row yet)

1. Go to `/dashboard`.
2. Look at the apps-bar venue logos at the top. **OG should NOT be in the featured row** (Polymarket, Kalshi, NoVig, ProphetX) — that promotion is uncommitted on this machine. Confirm.
3. Click "(+N more)" → drawer opens → confirm OG appears in the full venue list with its logo.
4. Click OG in the drawer → popover opens → click "View markets" → should land back on `/markets?platform=og` (or `/dashboard/markets?platform=og`).

## E. Console errors

While clicking through A–D, keep DevTools console open. Report any:
- 4xx/5xx network requests (path + status)
- Red console errors mentioning `og`, `markets`, `snapshots`, or `timescale`
- Hydration warnings

## Report back

```
## A. OG markets list (/dashboard/markets?platform=og)
- Total visible: <N>
- Most recent updated: <X min ago>
- Oldest updated: <X min ago>
- Sample titles:
  1. <verbatim>
  2. <verbatim>
  3. <verbatim>
  4. <verbatim>
  5. <verbatim>

## B. Variety check (28-group expansion)
- World Cup: <yes/no — example>
- NFL: <yes/no — example>
- F1: <yes/no — example>
- Tennis: <yes/no — example>
- Cricket: <yes/no — example>
- Inflation: <yes/no — example>
- EU football: <yes/no — example>
- VERDICT: <expansion live / partial / not deployed>

## C. Market detail
- Renders: <yes/partial/no>
- Chart has multi-point history: <yes/no — approx point count>
- Back button works: <yes/no>

## D. Apps-bar
- OG in featured row: <should be NO — confirm>
- OG in "+N more" drawer: <yes/no>
- "View markets" link works: <yes/no — final URL>

## E. Console / network
- <list any 4xx/5xx, red errors, or hydration warnings — verbatim>

## Overall
- OG populating terminal: <YES — fully / PARTIAL — what's missing / NO — what's broken>
```
