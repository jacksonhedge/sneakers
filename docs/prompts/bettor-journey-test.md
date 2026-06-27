# Chrome prompt — everyday bettor journey test

You are testing Sneakers Terminal as if you are a college-age sports + crypto bettor who heard about the product from a friend, never used it before. Your goal is to figure out:

1. **Is everything that looks clickable actually clickable?** A button that doesn't respond is worse than one that doesn't exist.
2. **Are the numbers real or placeholder?** Dashes (—), "stub" text, "Coming soon" pills, empty states with no CTA — flag every one.
3. **How fast does it react?** Snappy (< 1s), OK (1-3s), slow (3-10s), unusable (> 10s) — capture per surface.
4. **Does it feel like a real product or a half-finished demo?** Founder-feel test.

This is NOT a structured checklist. Walk through it like a real user would, narrate what you see, click things, get frustrated when they don't work. Capture every disappointment.

30-40 minutes. Read-mostly. The two real writes that happen are signups for THIS test (so the agent gets logged-in state) — see boundaries.

---

**Required inputs from the user before you start:**

- `email` — defaults to `jacksonfitzgerald25@gmail.com` (already AUTHED, so the dashboard portion works without fresh signup). If user wants you to start cold as a new visitor, they can give a fresh email + ask you to walk the signup flow too.
- `password` — user types it themselves at the form

If `email` missing, STOP and ask.

---

## Act 1 — Cold visitor (un-authed, new to the product)

Pretend you've never seen Sneakers before. A friend texted you "check out sneakersterminal.com — they aggregate prediction markets across like 40 venues."

### Scene 1: Landing

Open `https://sneakersterminal.com/` in a fresh tab.

Walk through:
- Read the hero. Does it explain what Sneakers is in 5 seconds or less?
- Look at the 3-card strip (Student discount / Leaderboards / Groups). Are all 3 the same level of done, or one a placeholder?
- The stats line ("43 venues / 13 live markets / 10m refresh"). Are those real or rounded marketing numbers? Do they update live or are they static?
- "Tracking across" venue ticker — count the venue logos. Click ONE that looks live (NOT placeholder) — does it open something useful?
- Any "Sign up your organization" / "Sign up as Individual" buttons — what do they actually do on click?
- Footer — every link, click it. 404? 200? Does it go where you'd expect?

For each clickable: did it react in <1s, 1-3s, 3-10s, or feel broken?

**Reaction-time + clickability summary for landing:**

### Scene 2: "Where can I trade?"

Curious about which venues, click `/venues` from the nav.

- Counts at the top (15 LIVE / 13 COMING SOON / 15 IN QUEUE) — do those add up?
- Each card: does the "BEST PRICE" actually populate, or stays "— updating —" forever?
- Click 3 different venue cards' "Trade on X →" links. **DO NOT actually go to the external site** (that would burn your session). Just note: does the link APPEAR to point at a real URL? Does it have an affiliate code in the href?
- Are there ANY interactive bits (filter chips, sort dropdowns)? Try them.

**Venues page reaction:**

### Scene 3: "What can I bet on?"

Click `/markets` from the nav.

- You should get bounced to signup (un-authed gates — that's expected). What's the post-bounce experience like? Is it clear why you got redirected? Is there a path back to the public site?
- Does the URL leak any internal vocab (`error=no_waitlist_row` was a known bug; should be fixed)?

**Auth-gate observation:**

### Scene 4: Pricing

Click `/pricing`.

- 6 tiers (Free / Pro / Elite / Business / Fraternity / Enterprise). Skim each tier's bullets — any mention internal infra vocab ("dedicated infra" was a known bug)?
- Monthly/Annual toggle — does the price actually change?
- Click "START 7-DAY TRIAL" on Pro. What happens? Does it gate to signup? Open a Stripe modal? Crash?

**Pricing page reaction:**

### Scene 5: Sign in (you DO have an account)

Click LOG IN, navigate to `/login`. Use `email` + `password` (user types it). Land on `/dashboard`.

Note: how long from "click LOG IN" to "fully-rendered dashboard"? <2s, 2-5s, 5-10s, >10s?

---

## Act 2 — On the dashboard for the first time today

You're a bettor — you want to find a good trade. Where does Sneakers help you?

### Scene 6: Topbar — what can I do from here?

- Wallet pill: shows `$X.XX` (NEW — should be live). What's the value? Tap it.
  - Popover: total balance + per-venue breakdown. Are venues listed even though you have no creds? What's the empty state?
  - Click "Manage venue connections" → goes to `/dashboard/connections`. Reaction time?
  - Close popover.
- Search box: type "Lakers" — does it autocomplete? Does it search real markets? Press Enter — what page does it land on?
- Filter pills (All / Sports / Politics / Crypto / Economics / Tech): click each. Does the page actually filter? Does it feel snappy or laggy?
- "+" button (connect more apps): click it. What opens?
- Venue chips (Polymarket / Kalshi / NoVig / ProphetX): tap one. What's in the popover?
- Avatar (top right): click. What's the menu?
- Hamburger / settings: click. What's there?

**Topbar clickability + reaction summary:**

### Scene 7: Body — "show me where to bet"

Scroll the dashboard. For each section, ask: is this REAL data or placeholder?

- WalletStatusCard (orange "Set up your wallet" banner): SET UP click — what opens?
- O'Toole spotlight card (Configure / Teach / Execute pillars): click each pillar. Does each go somewhere real, or is it dead?
- Category cards (Politics / Economics / Crypto / Sports): click one. Does the page filter to that category?
- BiggestVolume panel:
  - 6 rows. Each has a market name, sparkline, YES %, volume. Are all 6 real markets or seed/dummy data?
  - **CLICK A ROW** — does it navigate to the market detail? (This was broken until a hydration fix; should work now.)
  - Sparklines: do they look like actual price curves, or all flat lines (which would mean no historical data)?
- Cross-Book Spread / Arbitrage panel: any real arb candidates? What's the empty state if zero?
- Performance chart: does it look like real data or synthesized? Footer should NOT say "stub" or mention JSONL.
- BigMovers: empty state ("upgrade to Pro") — is the upgrade button clickable, what's it like?
- Upcoming Resolutions: any markets shown? Are they real or seed?
- My Positions: empty state — is the copy actionable or roadmap-excuse?

**Dashboard body reaction:**

### Scene 8: "OK I'll click a market"

From BiggestVolume, click any row → market detail at `/dashboard/markets/<platform>/<id>`.

Walk the detail page like a bettor deciding whether to trade:
- Topbar: should still feel like Sneakers (not "O'Toole TERMINAL" wordmark anymore — bug fixed). Confirm.
- URL bar: should NOT have `seed-` prefix. Confirm.
- Market title + countdown clock: does the timer look real? Counting down accurately?
- Robinhood-style chart: does the line render or stays flat? Try the timeframe pills (1H / 4H / 1D / 1W / ALL) — do they actually change the chart, or all show the same flat line?
- Hover the chart — does a crosshair / tooltip appear?
- Spread / venue table: is it populated?
- Right rail (Buy/Sell panel): YES + NO prices. Do they sum to ~100¢? (This was a known data-shape question.)
- "Connect Polymarket" green CTA — click it. What happens?
- Account Overview card: anything in it, or all dashes?
- Top Movers in the right rail: real markets or placeholders?
- Watchlist: any UX for adding to watchlist? Click "Add" if present.

**Market detail reaction:**

### Scene 9: "Can I get notified?"

Back to dashboard. Click `/dashboard/alerts`.

- Empty alerts list. NEW RULE button: clickable on free tier?
- "Upgrade to Pro for 3 alert rules" — does the upgrade button feel reachable?
- DELIVERY SETTINGS link top-right — clickable? Where does it go?
- Try `/dashboard/alerts/new` directly — what happens?

**Alerts reaction:**

### Scene 10: "What does O'Toole do?"

Open the right-sidebar O'Toole chat (or, if on mobile, the Ø FAB bottom-right).

Send these one at a time, ~30s between each so you can capture response time:

1. `What's the most volume right now on Polymarket?`
2. `Show me a longshot under 25 cents in NBA`
3. `What's my balance?` (should NOT make up a number — should direct you to dashboard)
4. `What venues do I have connected?` (NEW — should know from server-injected context)
5. `Draft me an alert for Bitcoin dropping below 50k`

For each: latency from send → first token (<2s good, 2-5s OK, 5-10s slow, >10s feels broken). Did it stream? Did it use real data? Did it offer to do anything?

**O'Toole battery summary:**

---

## Act 3 — "Now I want to actually use this"

Imagine you've decided Sneakers is useful. You want to wire your accounts up.

### Scene 11: Connections

Click `/dashboard/connections`.

- 30+ venue cards. Visual scan: are status pills (LIVE / COMING / QUEUED) actually meaningful, or do most show the same thing?
- Polymarket card: click CONNECT. Wizard opens — does it explain what API keys you need? Is there a "Get key →" link to Polymarket's settings? Cancel out.
- Kalshi card: same flow. Different field shape (PEM key)?
- A non-credentialed venue (e.g. Sleeper): click CONNECT. What happens — opens an affiliate link? Toggles a self-declared chip?

**Connections UX reaction:**

### Scene 12: Profile + identity

Click `/dashboard/profile`.

- Email shown — matches you?
- Plan / tier / referral code — present?
- Direct + indirect referrals — accurate?
- UPLOAD PHOTO button — click it. Does a file picker open? (Don't actually upload.)
- Any "edit display name" / "change password" affordances?
- Quick links — every one click. Real destinations or 404s?

**Profile reaction:**

### Scene 13: Settings

Click `/dashboard/settings` and each subroute:

- `/dashboard/settings` (root) — what's there?
- `/dashboard/settings/api-keys` — paste fields for Anthropic / OpenAI / Google / xAI. Click "Get key →" on Anthropic — opens external (don't follow)?
- `/dashboard/settings/autotrade` — Polymarket connect form. Read the explainer copy — does it mention "Kill-switch endpoint" or "POST" (would be a bug)?
- `/dashboard/settings/otoole` — Configure / Teach / Execute pillars. Click model picker — does it actually let you select?

**Settings reaction:**

### Scene 14: Money

Click `/dashboard/billing`.

- Same as `/pricing` but with "Current plan" highlighted?
- Click "MANAGE SUBSCRIPTION" — does it open Stripe portal or a placeholder?
- `/dashboard/billing/credits` — credit packs ($10/$25/$100/$500). Click any "Buy" button — what happens? Does it open Stripe checkout or sit idle?

**Billing reaction:**

### Scene 15: Social / leaderboard

Click `/dashboard/leaderboard`.

- Renders as a leaderboard (NOT 404 — was broken until recently). Confirm.
- Empty state OR a few rows? RETURN column shows what?
- "JOIN" CTA → goes to `/dashboard/leaderboard/join`. Walk the join flow — student verification gate works?

**Leaderboard reaction:**

### Scene 16: Treasury / Org (if applicable)

Click `/dashboard/treasury` and `/dashboard/org` if you have access.

- Are these real surfaces or placeholders? What's the call-to-action?

---

## Act 4 — "This is broken" / "this is great"

Open up. After 30+ minutes in the product, write a real-user reaction.

### What worked
(things that delighted, that you'd tell your friend about)

### What annoyed you
(things that felt broken, slow, half-finished, confusing — be specific about page + behavior)

### Reaction-time impressions overall
- Average dashboard render:
- Average market-detail render:
- O'Toole first-token latency:
- Slowest single page:
- Snappiest single page:

### Real-vs-placeholder data tally
For these surfaces, classify the data as REAL / SEED / PLACEHOLDER / EMPTY:
- BiggestVolume rows
- Market detail price chart
- BigMovers
- Cross-book arbitrage
- Performance chart
- Upcoming resolutions
- Top movers in market-detail right rail
- Account overview / portfolio overview cards on market detail
- Leaderboard
- Connections affiliate-link statuses
- O'Toole responses (does it cite real markets or fabricate?)

### Top 10 fix-tomorrow items
Ranked by what hurt the user experience most. Each: <surface> — <one-sentence problem>.

### Founder-experience grade
On a scale of 1-10 — "would a real college bettor sign up and come back tomorrow"? Defend the number.

---

## Boundaries

- DO NOT click external venue affiliate links (will burn the agent session).
- DO NOT actually upload a photo, save credentials, submit alert form, place a trade, or click "Buy credits" through to checkout. Inspect the UX, then back out.
- DO NOT enter REAL API credentials anywhere. If you want to test the wizard's verify path, use only obviously-fake test strings (`test-fake-key` etc.) and back out before saving.
- DO NOT click DELETE / REVOKE / GRANT ACCESS / CONFIRM anywhere.
- DO NOT preview/send a broadcast email.
- Stay on `*.sneakersterminal.com`.
- Redact passwords from screenshots.
- If a page > 30s, flag it and move on; don't retry.
- This is qualitative + behavioral. Don't blow through surfaces fast — sit with each one for 30-60s like a real user would.
