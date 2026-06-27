# Chrome prompt — re-verify hydration fix (commit f51c551)

Tiny focused re-verify of the hydration root-cause fix that the previous verify pass surfaced. The pass said "no #418 errors" but ALSO said "Clicking the BiggestVolume row link didn't navigate" — those two findings are the same bug. Fix swaps `Math.random()` → `useId()` for SVG gradient IDs in RobinhoodChart + RobinhoodSparkline. Should restore both row-click navigation AND eliminate intermittent #418.

5 minutes. Read-only.

---

**Required inputs from the user before you start:**

- `email` — defaults to `jacksonfitzgerald25@gmail.com`
- `password` — user types it themselves at the login form

If missing, STOP and ask.

---

## Step 0 — Sign in

1. Open `https://sneakersterminal.com/login` in a fresh tab.
2. Email = `email`, password = type yourself.
3. Confirm landing on `/dashboard`.

---

## ✅ Fix #1 — BiggestVolume row click navigates

**Do:** From `/dashboard`, scroll to the "Biggest Volume" panel. Click ANYWHERE on the FIRST row (the market name area, the sparkline, the YES price column — try a few targets).

**Expected:** Browser navigates to `/dashboard/markets/<platform>/<id>` for that market. URL bar updates.

**Do (repeat):** Click a DIFFERENT row (3rd or 4th down the list). Click on the sparkline column specifically.

**Expected:** Same — navigates to that market's detail page.

**Pass / Fail:** [fill in]
**Notes:** [if any clicks still fail to navigate, capture which row + which column you clicked]

---

## ✅ Fix #2 — No React hydration error #418 in console (multiple loads)

**Do:** Open DevTools → Console → clear it. Then:
1. Hard-refresh `/dashboard` (cmd+shift+R). Wait 5s. Note any #418 / hydration errors.
2. Navigate to `/dashboard/markets`. Wait 5s. Note errors.
3. Click into a market detail page. Wait 5s.
4. Hit back, hit forward, hit back again.
5. Hard-refresh `/dashboard` once more.

**Expected:** ZERO instances of "Minified React error #418" or "Hydration failed" across all 5 actions. Previous run got a false-negative because the random IDs happened to collide on those page loads — this round should be deterministic.

**Pass / Fail:** [fill in]
**Notes:** [any errors observed across the 5 actions, with the URL where they fired]

---

## ✅ Fix #3 — BigMovers row click also navigates (regression check)

The BigMovers panel uses the same MarketLink + RobinhoodSparkline pattern, so the fix should restore its click navigation too.

**Do:** From `/dashboard`, scroll to the "Biggest Movers" panel (if it's not paywalled out for your account). Click any row.

**Expected:** Navigates to that market's detail page. (If the panel is locked behind a Pro paywall on this account, skip and note.)

**Pass / Fail / N/A:** [fill in]
**Notes:** [paywall state if applicable]

---

## Step 4 — Final report

Return as:

```
## Hydration fix re-verify — f51c551

| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 1 | BiggestVolume row clicks navigate | | |
| 2 | No #418 across 5 navigation actions | | |
| 3 | BigMovers row clicks navigate | | |

## Anything weird
(free-form)
```

---

## Boundaries

- Read-only.
- Don't click external venue links.
- Don't submit any forms.
- Stay on `*.sneakersterminal.com`.
