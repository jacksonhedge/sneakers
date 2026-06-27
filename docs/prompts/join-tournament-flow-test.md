## Join-tournament flow test — venue validation + sign-up affiliate

Goal: walk every branch of the new BUY IN flow on the Crypto Horse Race lobby. Each tournament now requires the user to verify their venue account (or sign up via Sneakers' affiliate link) before joining. Browser-only — no shell, no code edits.

Dev server: http://localhost:3000

### Setup
1. Open http://localhost:3000/dashboard/horse-race
2. The lobby should load with the rolling tournament schedule. Tournaments are tagged with their settlement venue ("on Polymarket", "on Limitless", "on OG", "on Hyperliquid", "on Kalshi").

### Task A — Open the join modal
1. Find a tournament card whose status is `WAITING` (gray pill) or `LOCKED · WILL RUN` (emerald pill). Avoid `LIVE`, `STARTING`, or `UNDERFILLED` rows — those don't open the modal.
2. Click the gradient `BUY IN →` button on that row.
3. A centered modal should appear with a dark backdrop. Confirm:
   - Header shows the tournament's title (e.g. "BTC sprint"), size badge (1V1 DUEL / 5P TABLE / 10P TABLE), and duration badge.
   - Money line reads `$X buy-in · $Y cash · settles on <Venue>`.
   - Two cards visible: emerald "Sign up via Sneakers" + white "I already have one — connect".

### Task B — Test the close behaviors (3 sub-tests)
1. **Backdrop click**: click the dark area outside the modal box. Modal should close.
2. **Esc key**: re-open the modal, press `Esc`. Modal should close.
3. **× button**: re-open, click the small `×` in the top-right of the modal header. Modal should close.

### Task C — Sign-up flow (affiliate)
1. Re-open a Polymarket tournament's modal.
2. Click the emerald **`Sign up via Sneakers →`** card.
3. Confirm:
   - A new browser tab opens to a Polymarket URL with `?ref=SNEAKERS` in the query string.
   - **Do not actually sign up** — just verify the URL.
   - Back in the modal, an amber hint banner appears: "Tab opened. Once you finish signup, come back and click I just signed up — connect."
4. Click the underlined **"I just signed up — connect"** link inside that amber banner.
5. Confirm you advance to the connect form (venue-specific input field).
6. Click `← BACK` to return to the choose step. Confirm the amber hint is still visible.

### Task D — Connect form: input shape validation
The connect form's input expects a different format per venue. Test each venue with the right tournament:

#### D1. Polymarket (accepts wallet OR handle)
1. Open a `BTC sprint` (Polymarket) tournament's modal → click "I already have one — connect"
2. Verify the input label: `POLYMARKET USERNAME OR WALLET`
3. Try each of these inputs in sequence (clear between tries):
   - Empty → click VERIFY → expect rose error: "Polymarket username or wallet required"
   - `ab` (too short handle) → expect: "That doesn't look like a valid…"
   - `jackson_btc` (valid handle) → expect spinner "VERIFYING ON POLYMARKET…" for ~800ms → ~90% chance of success (green checkmark + auto-close + success toast). If you get the 10% failure path, retry.
   - `0xabc12345` (valid wallet) → same flow

#### D2. Limitless (wallet only)
1. Open the `ETH sprint` (Limitless) tournament's modal → "I already have one — connect"
2. Label should read `LIMITLESS WALLET ADDRESS`
3. Try:
   - `jackson_btc` (handle) → expect: "That doesn't look like a valid Limitless wallet address."
   - `0xdeadbeef1234` (valid wallet shape) → spinner → success or retry

#### D3. Hyperliquid (wallet only — same shape as Limitless)
1. Open the `BTC marathon` (Hyperliquid) tournament's modal
2. Confirm label says `HYPERLIQUID WALLET ADDRESS`
3. Same handle vs. wallet shape rules

#### D4. Kalshi (email only)
1. Open a `SOL classic` tournament's modal — wait, Kalshi might not be in the rolling schedule. If you don't see a Kalshi tournament, skip this; otherwise, use whichever Kalshi-tagged row appears.
2. Label should read `KALSHI EMAIL`
3. Try:
   - `0xabc123` (wallet) → expect: "That doesn't look like a valid Kalshi email."
   - `you@example.com` (valid email) → spinner → success or retry

#### D5. OG (handle only)
1. Open the `SOL classic` (OG) tournament's modal
2. Label should read `OG USERNAME`
3. Try:
   - `0xabc123` (wallet) → either accepts (handle regex matches) or rejects depending on shape
   - `jackson_og` (valid handle) → success path

### Task E — Success path
1. Run any successful validation from Task D (about 9 of 10 attempts succeed).
2. Confirm:
   - Connect button shows the verifying spinner with "VERIFYING ON <VENUE>…" copy
   - After ~800ms: a centered green ✓ + "<Venue> account verified" + "Routing you to buy-in…"
   - Modal closes after another ~600ms
   - A success toast slides in top-right: "Connected — <Venue> verified · Account <truncated identifier> ready. Tournament buy-ins go live next round."

### Task F — Failure-and-retry path
1. Try connect inputs repeatedly until you hit the 10% failure case (or check 10+ tries to force one).
2. When failure hits:
   - Form returns to the connect step (NOT the choose step) — input value is preserved
   - Rose error banner: "Couldn't find that account on <Venue>. Double-check it, or sign up if you don't have one."
   - Click VERIFY again — should re-roll
3. Click `← BACK` from the connect step. Confirm modal returns to the choose step (Sign up vs. Connect).

### Task G — Footer + reassurance copy
- Verify the bottom of the modal reads: "We verify your <Venue> account once. Future tournaments on <Venue> skip this step. Buy-ins settle via Sneakers' tournament escrow (smart contract on Base, coming soon)."
- On the connect step, below the VERIFY button: "We never see your password. We only confirm the account exists."
- Both messages should be readable, not gray-on-gray.

### Things to specifically evaluate

For each, give a one-line yes-it-works / felt-off / suggest-X verdict:

1. **Modal entrance** — does it feel snappy or laggy?
2. **Two-path layout** — is "Sign up" vs "I have one" clearly the right framing for new users?
3. **Affiliate URL** — does the new tab actually open with the `?ref=` query string visible?
4. **"I just signed up" banner** — is it visible enough that a user coming back from signup notices it?
5. **Per-venue identifier label** — does the right label render for each venue?
6. **Validation error wording** — does it tell you what to do, or just complain?
7. **Spinner state** — is the "VERIFYING ON <VENUE>…" copy reassuring or boring?
8. **Success choreography** — checkmark → "verified" → close → toast — does it feel like a real connection moment, or rushed?
9. **Failure-retry** — does the error path feel solvable, or does it dead-end?
10. **One-time gate framing** — does "verify once, future tournaments skip" land as valuable?
11. **"We never see your password"** — important reassurance for a paranoid user, or unnecessary?
12. **Mobile layout** — try resizing browser to ~400px wide. Does the modal still work?
13. **Esc / backdrop / × close behaviors** — all three feel natural, or does one stick out?
14. **Overall** — does this feel like a real account-linking flow, or like a tech demo?

### Reporting back

One consolidated message:
- `Task A:` <modal opens correctly?>
- `Task B:` <three close behaviors>
- `Task C:` <signup affiliate flow>
- `Task D:` <per-venue validation, one line per sub-test D1–D5>
- `Task E:` <success path>
- `Task F:` <failure-retry>
- `Task G:` <copy review>
- `14 cross-cutting verdicts:` numbered 1–14
- `Top 3 to fix first:` ranked
- `Top 3 working well:` ranked

Anything broken vs. just needs polish — call out which.
