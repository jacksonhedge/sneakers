# Chrome prompt — verify trading-terminal audit polish batches

Targeted verification for the polish bundles that shipped after the trading-terminal audit:

- `9b811b7` — vocab leak sweep (12+ surfaces)
- `c7bffdc` — leaderboard 404 / dead LOADING badge / em-dash sparklines / onboarding stepper
- `593d438` — market detail chrome / Yes-flip / seed-prefix / hydration error

10-15 minutes. One real write (a feature flag toggle to test behavior) — everything else read-only / preview-only.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `email` — defaults to `jacksonfitzgerald25@gmail.com` (the account currently authed for the dashboard, per last session). If user wants admin@ instead, switch.
- `password` — user types it themselves at the login form.

If missing, STOP and ask.

---

## Step 0 — Sign in

1. Open `https://sneakersterminal.com/login` in a fresh tab.
2. Email = `email`, password = type yourself.
3. Confirm landing on `/dashboard` cleanly (no bounce to `/signup?error=...`).

If sign-in lands anywhere unexpected, STOP.

---

## ✅ Fix #1 — `/dashboard/leaderboard` renders (was 404)

**Do:** Navigate to `https://sneakersterminal.com/dashboard/leaderboard`.

**Expected:**
- Page renders with header "COLLEGE LEADERBOARD" + traders count
- Helper copy mentioning rate-of-return ranking is "coming when one-click trading goes live"
- Table with columns: # / HANDLE / SCHOOL / RETURN / JOINED
- If you haven't joined the leaderboard, an emerald "You're not on the board yet" CTA box with a JOIN button → `/dashboard/leaderboard/join`
- Empty-state copy if no joiners yet, or rows with "— pending trades" in the RETURN column

**Pass / Fail:** [fill in]
**Notes:** [row count, anything weird]

---

## ✅ Fix #2 — Topbar "LOADING" badge no longer permanent

**Do:** From `/dashboard`, look at the top-right cluster (next to the wallet button).

**Expected:**
- NO permanent amber "LOADING" pill
- Either: nothing visible (because `latestTs` isn't supplied to topbar), OR a green "LIVE" pill if it's now wired
- The previous bug was a permanent amber dot pulsing forever next to the word "LOADING"

**Pass / Fail:** [fill in]
**Notes:** [what's actually in the right cluster now]

---

## ✅ Fix #3 — BiggestVolume sparklines are flat lines, not em-dashes

**Do:** On `/dashboard`, look at the "Biggest Volume" panel. Inspect every row's middle column (between the market name and the YES price).

**Expected:** Every row shows a tiny horizontal flat line (40% opacity) — even on rows where there's no historical data. NO em-dashes (—) in any row's sparkline column.

**Pass / Fail:** [fill in]
**Notes:** [if any rows still show em-dashes, list them]

---

## ✅ Fix #4 — Onboarding stepper progresses correctly

**Do:** Navigate to `/onboarding/about-you`. Read the top-right of the header. Then navigate to `/onboarding/wallet` (or any other onboarding step). Read header again.

**Expected:**
- `/onboarding/about-you` header shows "STEP 1 OF 6 · ABOUT YOU"
- `/onboarding/wallet` header shows "STEP 2 OF 6 · WALLET"
- `/onboarding/platforms` shows "STEP 3 OF 6 · PLATFORMS"
- `/onboarding/done` shows "STEP 6 OF 6 · DONE"
- The progress bar fills proportionally
- On `/onboarding/done`, NO "SKIP FOR NOW" link in the footer

**Pass / Fail:** [fill in]
**Notes:** [the actual step labels you saw]

---

## ✅ Fix #5 — Market-detail topbar no longer reads as a different product

**Do:** From `/dashboard`, click into ANY market card to open `/dashboard/markets/<platform>/<marketId>`.

**Expected (the FIX):**
- Top-left: same Sneakers logo lockup as `/dashboard` (dark circle + emerald ring + word "Sneakers" in light-mode text). NOT the "O'Toole TERMINAL" two-line wordmark.
- NO Light/Dark toggle button in the right cluster
- Sign Out button still present (intentional — useful here)
- Nav links Dashboard / Markets / Venues / Billing still present (intentional)
- URL bar reads `/dashboard/markets/<platform>/<id>` where `<id>` does NOT start with "seed-"

**Pass / Fail:** [fill in]
**Notes:** [verbatim wordmark text, full URL]

---

## ✅ Fix #6 — Yes/No price flip resolved

**Do:** From `/dashboard`, find a market in BiggestVolume where the title implies the bet is unlikely (e.g., "Bitcoin > $100k by EOM" — usually NO is favored). Note the YES % shown.

Then click into that market's detail page.

**Expected:**
- Detail page shows YES price + NO price separately
- The YES % from the BiggestVolume row matches the YES price on the detail page (NOT the NO price)
- Specifically: if BiggestVolume said "44%" for YES on a market, the detail page should show YES at 44¢, NO at 56¢ (NOT the reverse)

**Pass / Fail:** [fill in]
**Notes:** [list the market name, BiggestVolume YES%, detail YES price, detail NO price for verification]

---

## ✅ Fix #7 — `seed-` prefix gone from market URLs

**Do:** Click through 3 different market cards on `/dashboard` or `/dashboard/markets`.

**Expected:** Each URL bar reads `/dashboard/markets/<platform>/<id>` where `<id>` is something like:
- `mlb-yanks-redsox`
- `kalshi-fedrate`
- `poly-btc100k`
- `nba-lakers-warriors`

NOT prefixed with `seed-`.

**Pass / Fail:** [fill in]
**Notes:** [3 URLs you visited]

---

## ✅ Fix #8 — No React hydration error #418 in console

**Do:** Open DevTools → Console. Hard-refresh `/dashboard`. Look at the console output.

**Expected:**
- No "Minified React error #418" entries
- No "Hydration failed because the initial UI does not match what was rendered on the server" warnings

If you do see #418, capture which interaction triggered it and the line number.

**Pass / Fail:** [fill in]
**Notes:** [errors observed during a fresh load + 30s of interaction]

---

## ✅ Fix #9 — Vocab leaks gone

Quick scan of pages where the audit flagged internal vocab:

**Do:** Visit each, grep visually for the listed forbidden phrase:

- `/dashboard/connections` — should NOT contain "scraping" or "(once Execution lands)"
- `/dashboard` PerformanceChart footer — should NOT say "stub · pending JSONL rollup"
- `/dashboard` MyPositions empty — should NOT say "ships after auth+invite is stable"
- `/dashboard/settings/autotrade` — should NOT say "Kill-switch endpoint" / "POST" / "Background worker" / "rules engine"
- `/dashboard/settings/otoole` — should NOT contain "PLAN_OTOOLE" or "Track progress in Level 2"
- `/dashboard/alerts/settings` — should NOT contain `NEXT_PUBLIC_VAPID_PUBLIC_KEY` or "v1 still sends"
- `/dashboard/settings/api-keys` — should say "encrypted at rest" not "stored encrypted in our database"
- `/students` + `/college` — should say "Referred by" not "Referred by operator"
- `/pricing` Enterprise — should say "private deployment" not "dedicated infra"
- `/hardware` topbar — should NOT have a "CONNECT WALLET" button for un-authed visitors

**Pass / Fail per surface:** [list]

---

## Step 10 — Final report

Return as:

```
## Audit polish verify — 593d438

| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 1 | /dashboard/leaderboard renders | | |
| 2 | Topbar LOADING badge gone | | |
| 3 | BiggestVolume sparklines flat-line | | |
| 4 | Onboarding stepper progresses | | |
| 5 | Market detail chrome consistent | | |
| 6 | Yes/No price flip resolved | | |
| 7 | seed- prefix gone from URLs | | |
| 8 | No hydration error #418 | | |
| 9 | Vocab leaks (per surface) | | |

## Regressions spotted
(any)

## Anything weird
(free-form)
```

---

## Boundaries

- DO NOT click "CONFIRM" / "SEND" / "REVOKE" / "DELETE" anywhere.
- DO NOT submit alert creation, broadcast email, or feature-flag toggle on the user-facing side.
- DO NOT click external venue affiliate links.
- DO NOT submit the broadcast-email composer.
- Stay on `*.sneakersterminal.com`.
- Redact passwords from screenshots.
