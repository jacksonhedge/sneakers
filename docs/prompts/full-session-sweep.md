## Full session sweep — dashboard tiles + affiliate admin + token cap

Three new features shipped this session. This walkthrough verifies all three end-to-end against the local dev server. Browser-only — no shell, no code edits.

Dev server: http://localhost:3000  ·  Admin (local): http://localhost:3000/admin/*  ·  Admin (prod): https://admin.sneakersterminal.com/* (production-only subdomain split — local keeps everything on :3000)

---

## Setup

1. Sign in at http://localhost:3000/login if not already signed in. Use an admin email so the `/admin/*` routes work.
2. Confirm you can see the consumer dashboard at http://localhost:3000/dashboard before starting.

---

# SECTION A — Dashboard center-row swap

The tiles between the four category cards (top) and the Biggest Movers row (below) were replaced. Old tiles `Cross-Book Spread` and `Normalized Market Performance` are gone; new tiles `Tournaments` (middle) and `Teach your AI bot to trade` (right) take their slots.

### Task A1 — Old tiles fully gone

1. Load `/dashboard`.
2. Search the rendered page for `Cross-Book Spread` and `Normalized Market Performance`.
3. **Expected**: neither string appears anywhere.
4. Hard-refresh (Cmd+Shift+R) if either still shows — Turbopack sometimes caches.

### Task A2 — Tournaments tile (middle column)

1. Header reads `Tournaments` with a small fuchsia/pink **NEW** pill on its left.
2. Top-right of the header has an `ALL →` link → navigates to `/dashboard/horse-race`. Click it, then back.
3. Body shows up to **5 rows**. Each row has:
   - A circular asset badge (orange ₿, indigo Ξ, or violet ◎)
   - Flavor text (`BTC sprint`, `ETH sprint`, `SOL classic`, etc.)
   - A size pill (`1V1 DUEL`, `5P TABLE`, or `10P TABLE`)
   - `$N · <Venue> · X/Y` line under that
   - A thin gradient fill bar
   - A countdown (right side, font-mono, ticks once per second)
   - A small fuchsia/rose `BUY IN →` button at the bottom-right
4. **Wait 3 seconds**: at least one countdown digit decrements. Confirm timer is alive.
5. No row shows status `live` or `resolved` (no rose `LIVE NOW` strip, no `WATCH` button — only countdown rows here).
6. Footer reads: `Crypto Horse Race · 5/15/30-min strike markets` with `OPEN LOBBY →` link → `/dashboard/horse-race`.
7. Hover any `BUY IN →` button — tooltip reads like `"Buy in to BTC sprint on Polymarket"`.

### Task A3 — Teach-your-bot tile (right column)

1. Header: `🤖  Teach your AI bot to trade` + small `5 PICKS` chip on the right.
2. Body shows **5 cards** in this exact order:
   1. ARTICLE — `Sneakers` — *How O'Toole reads markets — strategy, not signal*
   2. TWEET — `@cryptoTrader` — *Fading Polymarket overround on settled events*
   3. ARTICLE — `Aaronson + co.` — *Prompting an LLM to size positions like a trader*
   4. TWEET — `@kalshi_quant` — *Cross-venue arb on weather contracts*
   5. VIDEO — `@predictionalpha` — *Building a Polymarket bot in 30 minutes*
3. Each card has a kind chip (black `𝕏 TWEET`, emerald `✎ ARTICLE`, rose `▶ VIDEO`), an author label, a yellow `COMING SOON` badge top-right, a bold title, and a 2-line hook description.
4. Click a card — nothing happens (URLs are placeholders, cards render disabled).
5. Footer reads: `Tweets · articles · walkthroughs to sharpen your prompt + strategy.` with `STRATEGY →` link → `/dashboard/settings/otoole`.

### Task A4 — Layout sanity

1. At ≥1280px wide (xl): three tiles side by side, `1fr · 1fr · 1.5fr` — Teach-your-bot tile is ~50% wider than the others.
2. Resize down to ~1200px: tiles stack vertically full-width.
3. All three tiles in the row are the **same height** (no shorter/taller mismatch).
4. No horizontal scrollbars anywhere on the page.

---

# SECTION B — Affiliate admin page

`/admin/affiliates` is a new page that lets ops set per-venue sign-up URLs and optional promo codes. The Crypto Horse Race join modal's "Sign up via Sneakers" card uses these.

### Task B1 — Page loads + lists 5 venues

1. Navigate to `/admin/affiliates` (sign-out + sign-in as admin if needed).
2. Header reads `> VENUE AFFILIATE LINKS` with `5 venues · 0 overridden` (or whatever count of saved overrides).
3. Below the description: **5 cards** in this order — Polymarket, Limitless, OG, Hyperliquid, Kalshi.
4. Each card has:
   - Venue name + a `DEFAULT` (gray) or `OVERRIDE` (emerald) pill
   - `SIGN-UP URL` text input (currently empty if DEFAULT, populated if OVERRIDE) with the default URL shown beneath as `Default: https://...`
   - `PROMO CODE (optional)` text input next to it
   - A `RESET TO DEFAULT` button (disabled if already on default) and a `SAVE` button (disabled until you change something)
   - A timestamp + email line at top-right (or `—` if never saved)

### Task B2 — Save a Polymarket override

1. On the **Polymarket** card, paste a fake URL: `https://polymarket.com/?ref=TESTUSER`
2. Type a fake promo code: `TESTUSER`
3. Click `SAVE`.
4. **Expected**: button briefly shows `SAVING…`, then green pill `saved polymarket` appears at the bottom-left of the card. Pill at top changes from `DEFAULT` to `OVERRIDE`. Timestamp updates to "now".
5. Hard-refresh — values persist.

### Task B3 — Verify lobby uses the new URL + code

1. Open a new tab → `/dashboard/horse-race`.
2. Click `BUY IN →` on any **Polymarket** tournament row (any size).
3. Modal opens. On the choose step:
   - Click the green **Sign up via Sneakers** card.
   - The card's title should now show a small emerald **CODE TESTUSER** chip next to "Sign up via Sneakers".
   - A new tab opens to `https://polymarket.com/?ref=TESTUSER` (URL has `TESTUSER`, not `SNEAKERS`).
4. Back in the modal, the amber post-signup banner should read:
   - `Use code `**TESTUSER**` at signup.` (bold, with monospace pill around the code)
   - `Tab opened. Once you finish signup, come back and click I just signed up — connect.`
5. Close all the test tabs.

### Task B4 — Reset to default

1. Back at `/admin/affiliates`, on the Polymarket card click `RESET TO DEFAULT`.
2. **Expected**: green pill `polymarket reset to default`. Pill flips back to `DEFAULT`. URL field returns to `https://polymarket.com/?ref=SNEAKERS`. Promo code field clears.
3. Confirm the lobby's Sign-up card on the next BUY IN no longer shows the `CODE` chip.

### Task B5 — Validation

1. On the Limitless card, try saving with URL: `javascript:alert(1)` → expect rejection: `signup_url must be http(s)`.
2. Try URL: `not-a-url` → expect: `signup_url must be a valid absolute URL`.
3. Try URL valid + promo code `bad code with spaces` → expect: `promo_code: 2-32 chars, letters/digits/_/- only`.
4. Save with valid URL `https://limitless.exchange/?ref=TESTUSER` and **empty** promo code → success, OVERRIDE pill on, no code chip in the lobby's Sign-up card.

---

# SECTION C — $2/day Claude API token cap

A new dollar-cost cap on Sneakers' shared API key — free tier is $2/day, BYO-key requests bypass it.

### Task C1 — Panel copy update

1. Navigate to any `/dashboard/*` page where the O'Toole sidebar is visible (e.g. `/dashboard`).
2. Look at the row above the chat input. Should read:
   - `On Sneakers' key · free, $2/day budget` (NOT the old `…capped daily`)
   - `Use your own key →` button on the right
3. Hover the budget text — tooltip should explain: *"Free Claude API access on Sneakers' key, capped at $2/day per user. Add your own key to skip the cap — your key, your budget."*

### Task C2 — Send a message, confirm it works

1. With no BYO key configured, type any prompt into the O'Toole chat (e.g., `hi`).
2. Press Enter / Send.
3. **Expected**: O'Toole responds normally. The message + response appears in the stream. No 429 / "cap reached" error on this single message (we're well under $2 of usage on a one-message session).

### Task C3 — Inspect the chat response shape

1. Open Chrome DevTools → Network tab → filter to `chat`.
2. Send another short message. Click the `chat` row → Preview / Response tab.
3. **Expected fields in the JSON**:
   - `cap.tier` — likely `"business"` if you're an admin email, otherwise `"free"`
   - `cap.limit` — `5` for free, higher for paid, `null`/`Infinity` for business
   - `cap.used` — increments by 1 each successful send
   - `cap.costUsd` — small positive number (probably <0.01 for short messages)
   - `cap.costUsdCap` — `2` for free, `10` for pro, `50` for elite, very large for business
   - `usage.input` and `usage.output` — token counts

### Task C4 — Optional: simulate the cap hit (skip if too tedious)

The fast way to feel the cap-hit response without sending hundreds of messages:
1. Open DevTools → Application → IndexedDB → ... no, easier path: just look at the 429 path in the route by sending a request manually.
2. Open DevTools → Console:
   ```js
   await fetch('/api/otoole/chat', {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
   }).then(r => ({ status: r.status, body: await r.json() }))
   ```
3. Confirm the response shape includes `costUsd`, `costUsdCap`, `tier`, `cap`, `used`.
4. (No need to actually trigger 429 — the existence of the new fields proves the cap path is wired. If you do hit it, the message reads `"You've used your $2.00 daily O'Toole budget on the free tier (~$X.XX spent)…"`)

---

# SECTION D — Cross-feature regression sweep

Quick check that prior features still work.

### Task D1 — Tournament join flow still works

1. From `/dashboard`, click `BUY IN →` on a row in the new Tournaments tile → lands at `/dashboard/horse-race`.
2. From the lobby, click `BUY IN →` on any row → modal opens.
3. Pick "I already have one — connect", paste `0xabcdef12`, click VERIFY → success toast.
4. Click `BUY IN →` on a different row of the **same venue** → should fast-track straight to the buy-in confirmation card (the round-3 fix from earlier).
5. Confirm the verified BUY IN button on the lobby is now emerald with a leading ✓.

### Task D2 — No console errors

1. Open DevTools → Console. Reload `/dashboard`.
2. **Expected**: no red errors. Yellow warnings (deprecation notices, etc.) are fine.
3. Scroll the page, click a tile link, navigate to the lobby. Still no red errors.

### Task D3 — Topbar / nav still intact

1. Top of `/dashboard` shows: search bar, category nav (`All / Sports / Politics / Crypto / Economics / Tech`), `Quick`, `Horse Race NEW`, `$N.NN` credits, avatars, `FREE · UPGRADE` pill.
2. Click `Horse Race NEW` → navigates to `/dashboard/horse-race`. Click back.
3. The OToole sidebar (left) still loads with the greeting card if no messages yet.

---

## Reporting back

```
SECTION A — Dashboard tiles
  A1 (old gone):     PASS/FAIL · note
  A2 (Tournaments):  PASS/FAIL per sub-step (1-7)
  A3 (Teach-bot):    PASS/FAIL + 5 titles seen
  A4 (layout):       xl=PASS/FAIL · stacked=PASS/FAIL · heights=PASS/FAIL · overflow=PASS/FAIL

SECTION B — Affiliate admin
  B1 (page lists 5): PASS/FAIL
  B2 (save override): PASS/FAIL · OVERRIDE pill visible?
  B3 (lobby uses URL+code): PASS/FAIL · URL=??? · code chip=???
  B4 (reset to default): PASS/FAIL
  B5 (validation):   javascript:URL=PASS/FAIL · bad-URL=PASS/FAIL · bad-code=PASS/FAIL · empty-code=PASS/FAIL

SECTION C — Token cap
  C1 (panel copy):   PASS/FAIL · note exact text seen
  C2 (one msg):      PASS/FAIL
  C3 (response shape): PASS/FAIL · note tier/cap/costUsd/costUsdCap values seen
  C4 (cap-hit path): SKIPPED / PASS / saw-fields

SECTION D — Regressions
  D1 (join flow + fast-track): PASS/FAIL
  D2 (no console errors):      PASS/FAIL · paste any red errors
  D3 (topbar / nav):           PASS/FAIL

Top 3 issues found this run:
  1.
  2.
  3.

Top 3 things working surprisingly well:
  1.
  2.
  3.

Anything broken vs. polish — call out which, and which feature each belongs to.
```
