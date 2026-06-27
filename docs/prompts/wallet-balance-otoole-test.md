# Chrome prompt — wallet + balance + O'Toole personal-info test

Three-part test of newly-shipped wallet/balance infrastructure plus O'Toole's awareness of user-scoped data.

What's being tested:
- Wallet status card UX on `/dashboard`
- Balance card behavior (`/api/balance` + the per-venue rollup card)
- Connections wizard for credentialed venues (Polymarket, Kalshi, Opinion)
- O'Toole's user-context battery — does it know your tier / credits / recent activity? Does it correctly refuse on data it doesn't have?

15-20 minutes. **Do NOT paste real production API keys** — see boundaries.

---

**Required inputs from the user before you start:**

- `email` — defaults to `jacksonfitzgerald25@gmail.com`
- `password` — user types it themselves at the form

If missing, STOP and ask.

---

## Step 0 — Sign in

Open `https://sneakersterminal.com/login`, sign in with `email` + `password` (user types the password). Land on `/dashboard`.

---

## Step 1 — Wallet status card on `/dashboard`

**Do:** From `/dashboard`, find the WalletStatusCard.

**Expected:**
- Visible card (or already-dismissed if you've seen it before)
- Copy mentions wallet for "deposits and payouts"
- Six wallet picker options listed (Crypto.com / Coinbase / Robinhood / Phantom / MetaMask / EDGE Boost)
- A "SET UP" CTA + a dismiss × button

**Do (continued):** Click "SET UP". Note what opens — modal? new page?

**Do NOT:** Actually pick a wallet and connect to a real one. Just observe the picker.

**Result:**
- Card present: yes / no / dismissed
- Wallet picker options visible:
- "SET UP" target:
- Anything weird:

---

## Step 2 — Balance card (newly-shipped)

There's a new `BalanceCard` that calls `GET /api/balance` and aggregates USD across connected venues. It's part of the parallel autotrade work that just shipped.

**Do:** From `/dashboard`, find the BalanceCard. (It may be in the right rail, header area, or stat strip — search the page.)

**Expected per-state:**
- If you have NO credentials saved for any venue → "no_credentials" empty state, CTA pointing at `/dashboard/settings/autotrade` or `/dashboard/connections`
- If you have credentials but the adapter can't reach the venue → per-venue error pill
- If credentials work → USD total + per-venue breakdown

**Do (network probe):** Open DevTools → Network → reload `/dashboard`. Find the `/api/balance` request. Capture:
- HTTP status
- Response body shape (redact any cents/balance values)
- Per-venue rows: `{ venue, status, cents?, error? }`

**Result:**
- BalanceCard rendered: yes / no
- Per-venue states visible:
- /api/balance response shape:
- Any errors logged:

---

## Step 3 — Connections wizard for Polymarket (UX-only, no real keys)

The connections page has a credential wizard for Polymarket / Kalshi / Opinion. We're going to walk through the wizard's UX without entering real keys.

**Do:** Visit `/dashboard/connections`. Find the Polymarket card. Click the card (or its CONNECT button if it has one).

**Expected:** A wizard modal/panel appears prompting for API credentials.

**For Polymarket specifically:**
- Three fields expected: API KEY / API SECRET / PASSPHRASE (CLOB credential trio)
- A "Save & verify" or similar button
- Help text or external "Get key →" link

**Do (controlled fake-input test):** Type `test-fake-key` into the API KEY field. Type `test-fake-secret` into API SECRET. Type `test-fake-passphrase` into PASSPHRASE. Click Save & Verify.

**Expected:** Server-side test connection should FAIL gracefully — red error pill saying the credentials don't validate against Polymarket's API. NO crash, NO 500.

**Do (cleanup):** Cancel out of the wizard. The credentials should NOT be saved (verify wasn't successful).

**Result:**
- Wizard fields:
- Save & verify result:
- Cleanup successful (no fake creds saved):

## Step 3b — Same wizard for Kalshi

**Do:** Same flow, Kalshi card. Note that Kalshi has a different credential shape — RSA keypair (key_id + PEM private key) instead of API/secret/passphrase.

**Expected:**
- Different field layout — Key ID + PEM private key (multi-line text)
- Same "Save & verify" pattern
- Same fake-input → graceful error path

**Do (fake input):** Key ID = `test-key-id`, PEM = `-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----`. Save & verify.

**Result:**
- Field layout differs from Polymarket: yes / no
- Verify result:

## Step 3c — Same for Opinion (single API key)

**Do:** Same flow, Opinion card.

**Expected:** Single API key field (no secret, no passphrase, no PEM).

**Result:**
- Field layout: <list>

---

## Step 4 — O'Toole personal-info battery

Open the right-sidebar O'Toole chat from `/dashboard`. Send each question one at a time, capture each response verbatim, then move on.

The point: see what O'Toole correctly KNOWS about you (because the server injects user context), what it correctly REFUSES to guess at (per its persona instructions), and what it accidentally hallucinates.

### Q1 — basic identity
**Send:** `What email am I signed in as?`

**Expected:** Answers correctly with `jacksonfitzgerald25@gmail.com`. The user context block injects email server-side.

**Response verbatim:**
**Honest / hallucinated:**

### Q2 — credit balance
**Send:** `How many O'Toole credits do I have left?`

**Expected:** Answers with the actual credit balance (the server injects balance). For free-tier accounts that's typically 0 or whatever the seed is.

**Response verbatim:**

### Q3 — tier
**Send:** `What plan am I on?`

**Expected:** Says "free" (or the actual tier).

**Response verbatim:**

### Q4 — positions (data it should NOT have)
**Send:** `What positions am I currently holding?`

**Expected (per persona):** O'Toole says it doesn't have positions data loaded — "that's user-scoped data the server only injects when relevant" — and DOESN'T fabricate positions. The persona explicitly says "DON'T guess".

**Response verbatim:**
**Did it refuse correctly OR hallucinate positions:**

### Q5 — recent activity
**Send:** `What markets have I been clicking on lately?`

**Expected:** O'Toole has the user's recent activity injected (if click_events is populated for this user). Should mention real pages from the activity log, OR honestly say it doesn't have visibility.

**Response verbatim:**
**Activity referenced — real or fabricated:**

### Q6 — wallet balance
**Send:** `What's my wallet balance across all venues?`

**Expected:** Honest answer — either O'Toole has access to the `/api/balance` aggregator and pulls it, or it says it doesn't have wallet data loaded. Note which.

**Response verbatim:**
**Pulled live data / refused / hallucinated:**

### Q7 — preferences
**Send:** `What's my trading style?`

**Expected:** From the saved memory, the user's stated O'Toole price-range preference is "trades in the 10-25¢ band, longshot-leaning". But O'Toole only knows what's in the user-context block, NOT external memory files. It probably says it doesn't know.

**Response verbatim:**

### Q8 — open question
**Send:** Any free-form question you want to test, e.g., `Suggest me a longshot trade for tonight.`

**Expected:** A reasoned answer using the live market data + tool calls.

**Response verbatim:**

---

## Step 5 — Final report

```
## Wallet + balance + O'Toole test — <date>

### Wallet status card
- Rendered: yes / no
- Picker options:
- SET UP target:
- Issues:

### Balance card
- Rendered: yes / no
- /api/balance status code:
- Response shape:
- Per-venue states:
- Issues:

### Connections wizard
- Polymarket fields + verify result:
- Kalshi fields + verify result:
- Opinion fields + verify result:
- Any wizard fully crashed: yes / no — <which>

### O'Toole personal-info battery
| Q# | Question | Honest? | Hallucinated? | Notes |
|----|----------|---------|---------------|-------|
| 1 | email | | | |
| 2 | credits | | | |
| 3 | tier | | | |
| 4 | positions | | | |
| 5 | activity | | | |
| 6 | wallet balance | | | |
| 7 | trading style | | | |
| 8 | freeform | | | |

### Top fix-tomorrow items
Ranked.

### Anything weird
(free-form)
```

---

## Boundaries

- **DO NOT enter real production API keys.** Use only the obviously-fake test strings provided in the steps. The Sneakers credential store encrypts at rest, but pasting real keys into a Chrome extension session is bad security hygiene regardless.
- **DO NOT actually trade** — even if O'Toole offers to scaffold a trade, decline.
- **DO NOT click external venue affiliate links** — they'll burn the agent session.
- DO NOT preview/send a broadcast email.
- DO NOT click DELETE / REVOKE / GRANT ACCESS / CONFIRM anywhere.
- Stay on `*.sneakersterminal.com`.
- Redact passwords + any credential values from screenshots.
- If the wizard appears to actually save fake credentials despite verify-fail, flag it loudly — that's a security bug, not just a UX bug.
