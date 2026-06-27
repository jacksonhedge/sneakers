# Chrome prompt — O'Toole Strategy + Knowledge + Other QA (PRODUCTION)

Same shape as `test-otoole-memory-flow.md`, but pointed at **production**:
`https://sneakersterminal.com`. Tests the new Strategy / Knowledge / Other
settings + verifies that pasted snippets actually flow into O'Toole's chat.

This is **all UI + chat — no API keys, no destructive actions outside the
explicit cleanup in Step 7**. Every source you add will be deleted before
you finish the run, so the test account is left clean.

---

**Required inputs from the user before you start** — ask in chat if missing:

- `base_url` — default `https://sneakersterminal.com`. Confirm with the user; this is the live site.
- `email` — the test account email. Default `jacksonfitzgerald25@gmail.com`.
- **Deploy readiness** — ask the user to confirm the latest deploy has completed before you start. Vercel usually takes 60–120s after a push. If they say "not yet, wait", pause and don't open any tabs until they say "ready".

**Auth note**: prod uses email + password (NOT magic link). You will NOT enter the password — per safety rules, the user types it themselves. Your job in Step 0 is to navigate to the login page, then HAND OFF until the user reports they're on `/dashboard`.

If any input is missing, STOP and ask. Don't invent values.

---

## Step 0 — Sanity + sign in

1. Open `<base_url>` in a fresh tab, DevTools → Network tab open.
2. Visit `<base_url>/login`. Confirm it's an email + password form (with a SHOW button on the password field and a SIGN IN button).
3. **HAND OFF** to the user: "Please type your email + password into the form and click SIGN IN. Tell me when you're on `/dashboard`." Do NOT enter the password yourself.
4. When the user confirms they're on `/dashboard`, proceed. If they report bouncing to `/pending` or `/signup?error=…`, capture the URL and STOP — that means the account isn't approved/admin-gated, not a test we can recover from.

## Step 1 — Settings layout

Navigate to `<base_url>/dashboard/settings/otoole`.

Confirm **three separate white cards** stacked top to bottom:

1. **🎯 Strategy** — header with "LIVE" tag, big textarea, SAVE button, char counter (`X / 8000`).
2. **📚 Knowledge** — header with "LIVE" tag, then three labeled subsections in this order:
   - **TWEETS** with `+ ADD TWEET` button on the right
   - **GITHUB REPOS** with `+ ADD GITHUB SOURCE` button
   - **ARTICLES** with `+ ADD ARTICLE` button
   Each subsection should show "No tweets/github repos/articles yet." in a dashed empty-state box (assuming a fresh account; if they exist from a prior session, that's also fine — just note it).
3. **🗒 Other** — notes catch-all. Empty-state with `+ ADD NOTE` button inside it.

In Network tab, confirm two GET requests fired on page load:
- `GET /api/otoole/memory` → 200, body `{ ok: true, content: "" }` (or whatever's saved)
- `GET /api/otoole/sources` → 200, body `{ ok: true, sources: [...] }`

If layout is missing any card, or the subsections aren't grouped under Knowledge, screenshot + STOP. Most likely cause for missing UI: deploy hasn't propagated yet — pause and re-check after 60s.

**Note**: there's also an O'Toole spotlight card on `/dashboard` with a "Teach" pillar that should read LIVE post-deploy, but the spotlight is dismissible (`localStorage.sneakers_otoole_spotlight_dismissed`) and stays hidden once dismissed. Don't gate the test on the spotlight — the settings page IS the deploy-readiness signal. The spotlight pillars (Configure / Teach / Execute) are also NOT the same as the dashboard's market-category cards (Politics / Economics / Crypto / Sports). If you only see the four category cards, that's normal.

## Step 2 — Save strategy text

1. Click into the Strategy textarea.
2. If there's pre-existing text from a prior session, capture it in your notes so you can restore later. For this test, REPLACE with: `I trade only NBA player props between $0.10 and $0.35. Max $50 per ticket. I never touch crypto perpetuals. My favorite players are Lakers role players.`
3. Char counter should update in real time.
4. Click `SAVE`. Network: `PUT /api/otoole/memory` → 200. Brief `✓ saved` indicator appears.
5. Reload `<base_url>/dashboard/settings/otoole`.
6. Confirm the strategy text is still there (proves Supabase persistence on prod).

If gone after reload, capture PUT response + STOP.

## Step 3 — Add a tweet source with a market filter

This source uses a **deliberately distinctive phrase** so we can later confirm O'Toole actually saw it.

1. Click `+ ADD TWEET`. Modal opens with title "Add tweet". No kind picker.
2. Fill in:
   - LABEL: `lakers role player thread`
   - CONTENT: paste exactly →
     ```
     The fuchsia rule: when a Lakers role player has played fewer than 12 minutes in their last 3 games but is starting tonight, their PRA prop is mispriced by ~7% on average. Backtested 2023-24 season, n=41.
     ```
   - MARKET FILTER: `lakers, nba`
3. Save. Network: `POST /api/otoole/sources` → 200. Modal closes.
4. New tweet appears in TWEETS list with label, green `fires on: lakers, nba` badge, 3-line preview.
5. Reload — persists.

## Step 4 — Add a GitHub source WITHOUT a market filter

A no-filter source should fire on every chat.

1. Click `+ ADD GITHUB SOURCE`. Modal title "Add GitHub source".
2. Fill in:
   - LABEL: `kalshi-public/markets repo notes`
   - CONTENT: `The kalshi-public/markets repo lists every active market with the codename 'persimmon' for political event markets. Use the persimmon prefix when looking up Trump-related contracts.`
   - MARKET FILTER: leave **blank**
3. Save. Confirm appears in GITHUB REPOS subsection with NO `fires on:` badge.

## Step 5 — Add a Note in the Other section

1. Scroll to the **Other** card.
2. Click `+ ADD NOTE`. Modal title "Add note".
3. Fill in:
   - LABEL: `bankroll rule`
   - CONTENT: `Never go below $200 cash on Polymarket — that's the redeposit floor.`
   - MARKET FILTER: `polymarket`
4. Save. Appears with green filter badge.

## Step 6 — Verify the filter actually scopes (the important test)

Open O'Toole chat. The chat lives **on the dashboard** as a left-side panel (look for the OToolePanel — header has an `Ø` avatar + "O'Toole AI" label). On phones, it's behind a floating action button (FAB).

**New as of today's deploy**: the chat panel header has a small **gear icon** (settings) link next to the collapse arrow. Confirm the gear is present and links to `/dashboard/settings/otoole` when clicked. (Right-click → copy link to verify, then come back.)

### Test 6a — message that should trigger the lakers tweet

In the chat input, send: **`What should I look at for Lakers props tonight?`**

Wait for O'Toole's full response. Then check:

- ✅ PASS if the response references the **fuchsia rule** specifically OR mentions the "12 minutes / 3 games / 7% mispricing / n=41" pattern.
- ⚠️ PARTIAL if the response talks about Lakers role players generally but doesn't echo the distinctive phrasing.
- ❌ FAIL if the response is generic NBA chatter with zero hint that O'Toole saw your snippet.

### Test 6b — message that should NOT trigger the lakers tweet

Send: **`What's the weather like in San Francisco?`**

- ✅ PASS if the response is generic / says it doesn't have weather data / doesn't mention fuchsia, Lakers, NBA, props.
- Note: the GitHub source (no filter) WILL be in the system prompt, but a well-behaved bot shouldn't drop unrelated `persimmon` chatter into a weather question.
- ❌ FAIL if it randomly mentions the fuchsia rule or Lakers — that means filter scoping broke.

### Test 6c — message that should trigger the no-filter GitHub source

Send: **`How do I find Trump-related contracts on Kalshi?`**

- ✅ PASS if the response mentions the **persimmon** codename or references the `kalshi-public/markets` repo.
- ❌ FAIL if it doesn't — no-filter sources aren't being injected.

### Test 6d — strategy memory check

Send: **`I'm thinking about a $200 bet on a Bitcoin futures contract — thoughts?`**

- ✅ PASS if O'Toole pushes back on the bet size (max $50 per your rule) AND/OR pushes back on crypto perps.
- ❌ FAIL if it just engages with the trade idea without referencing your rules.

## Step 7 — Cleanup (mandatory, this is prod)

For each of the three sources you added in Steps 3–5:
1. Hover the row in its respective subsection.
2. Click `delete`, confirm the native `confirm()`.
3. Network: `DELETE /api/otoole/sources?id=<n>` → 200.
4. Confirm row vanishes.

Strategy textarea: if you captured pre-existing text in Step 2, restore it now. Otherwise clear the textarea entirely and SAVE — leaves the field empty for the user.

---

## Hard guardrails

- This is **production**. Don't paste any text outside the exact test strings above. Don't run any other action.
- If the deploy isn't live yet (you see the old BETA pill on the spotlight card or no Strategy/Knowledge/Other layout on the settings page), STOP and tell the user — don't try to "make it work."
- Auth is password-based. NEVER enter the password yourself — always hand off to the user.
- The cleanup in Step 7 is mandatory — even if the chat tests fail, clean up the sources so the account is left clean.

## Report back

A punch list per step:
- ✅ pass / ⚠️ partial / ❌ fail
- For ❌: response body or screenshot of the failing UI/chat reply
- For Test 6 (the meat of this run): include the verbatim text of O'Toole's response for each of 6a/6b/6c/6d
- One bullet at the end: any UI bugs, layout weirdness, or chat behavior worth flagging
