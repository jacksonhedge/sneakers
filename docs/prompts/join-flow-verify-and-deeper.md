## Join-tournament flow — verify fixes + deeper dive

Two-part task. Part 1: verify the six fixes from the last session actually shipped. Part 2: go deeper — edge cases, accessibility, state behavior, and the question of whether copy promises match prototype reality.

Browser-only — no shell, no code edits. Dev server at http://localhost:3000.

---

## PART 1 — Verify the six fixes

For each, give a one-line PASS / FAIL / PARTIAL verdict.

### Fix 1 — Footer typo (was "Polymarketskip")

1. Open http://localhost:3000/dashboard/horse-race
2. Click `BUY IN →` on any tournament row
3. Scroll to the bottom of the modal (the gray-50 footer band)
4. Confirm the text reads: `"We verify your Polymarket account once. Future tournaments on Polymarket skip this step. Buy-ins settle via Sneakers' tournament escrow (smart contract on Base, coming soon)."`
5. Specifically: the space between **`Polymarket`** and **`skip`** must be present. No more `Polymarketskip`.
6. Repeat for one Limitless, one OG, one Hyperliquid tournament. All four must show the proper space.

### Fix 2 — BUY IN button title / aria-label

1. Hover over a `BUY IN →` button. The browser tooltip should now read `"Join <flavor> on <Venue>"` (e.g., `"Join BTC sprint on Polymarket"`) — NOT `"Click to register interest (live launch coming soon)"`.
2. Use your dev tools (or accessibility tree inspector) to confirm the button's `aria-label` reads `"Join <flavor> (<size>) on <Venue>"` (e.g., `"Join BTC sprint (1V1 DUEL) on Polymarket"`).

### Fix 3 — OG handle validator

1. Open the OG tournament's modal (`SOL classic` flavor)
2. Click "I already have one — connect"
3. Paste `0xabc12345` and click VERIFY
4. **Expected**: rose error: `"That doesn't look like a valid OG username."` (NOT routed to success path)
5. Now clear the input, paste `jackson_og`, click VERIFY → success path (~90% of the time)
6. Try a few wallet-shaped strings to be sure none slip through.

### Fix 4 — Connect-card description (proper case)

1. Open any tournament modal
2. Look at the white "I already have one — connect" card on the choose step
3. Description should read: `"Paste your Polymarket username or wallet to verify."` (or `"Paste your Limitless wallet address to verify."`, etc.)
4. Specifically: the venue name should be **PROPER CASE** — NOT `"Paste your polymarket username..."` lowercased.

### Fix 5 — "a / an" article

1. On a Polymarket / Limitless / Hyperliquid / Kalshi modal, the emerald sign-up card should read `"Don't have a {Venue} account?"`
2. On an OG modal, it should read `"Don't have an OG account?"` (article changes because OG starts with vowel sound)
3. Verify both spellings.

### Fix 6 — Truncated identifier in success toast

Run several successful validations across venues. Verify the toast wording:

- Wallet input `0xdeadbeef1234` → toast should read `"Account 0xdead…1234 ready..."`
- Wallet input `0xabc12345` (12 chars) → ≤14 chars so unchanged: `"Account 0xabc12345 ready..."`
- Handle input `jackson_btc` (11 chars) → unchanged: `"Account jackson_btc ready..."`
- Long handle `superlongusernamehere` → `"Account superlongus… ready..."`
- Long email `someverylongemail@example.com` → `"Account somev…@example.com ready..."`

Try at least 3 different identifier shapes and report what the toast actually said vs. expected.

### Part 1 expected outcome

`PART 1 SUMMARY`: 6/6 PASS or list which failed.

---

## PART 2 — Dive deeper

### Task A — State persistence (the big one)

The footer copy promises **"Future tournaments on Polymarket skip this step."** Let's see if the prototype actually delivers on this promise.

1. Open a Polymarket tournament's modal, run through the connect flow successfully (paste a valid wallet, click VERIFY, get the success toast).
2. Modal closes. Confirm the success toast.
3. **Now click `BUY IN →` on a DIFFERENT Polymarket tournament row** (there are 3 sizes per venue: 1V1 / 5P / 10P, so plenty of choices).
4. **Expected per the copy**: the modal should skip the choose step entirely and go directly to a buy-in confirmation, OR the modal shouldn't open at all and proceed to buy-in directly.
5. **Likely actual**: the modal opens fresh on the choose step, asking the user to verify Polymarket again.

**Report what actually happens.** This is a design-vs-implementation gap — the copy makes a promise the prototype may not keep, which would erode trust. If actual = expected, great. If not, that's the top item for the next session.

### Task B — Modal focus management & keyboard

Re-open any tournament modal.

1. **Focus trap**: tab through the modal. Does focus stay inside the modal, or does it leak out to the lobby below?
2. **Initial focus**: when the modal first opens, where does focus land? (Hopefully on the close `×` or one of the choose-step cards.)
3. **Enter on choose step**: with focus on a card, does pressing Enter activate it?
4. **Tab order on connect step**: tab from "← BACK" through the input field through the VERIFY button. Order should be left-to-right / top-to-bottom logical order.
5. **Enter to submit**: focus the input, type a valid identifier, press Enter. Should fire VERIFY (already wired per the spec, confirm).
6. **Esc closes**: at any step (choose / connect / validating / success), Esc should close the modal. Try at each step.

### Task C — Mobile / responsive

1. Open Chrome DevTools → toggle device toolbar
2. Set viewport to **iPhone SE (375 × 667)**
3. Open the lobby. Confirm tournament rows stack readably.
4. Click `BUY IN →` on a tournament — modal should still be centered and not overflow horizontally.
5. Try the connect flow at this width. Input field should be full-width inside the modal. VERIFY button should be tappable.
6. Now try **Pixel 7 (412 × 915)** and **iPad Mini (768 × 1024)**. Note any layout breakage.

### Task D — Spam / rapid input

1. Click `BUY IN →` rapidly 5 times in a row. Does it open 5 modals stacked, or just one?
2. Open a modal, click VERIFY before typing anything. Click VERIFY again rapidly. Does it spam the validation timer or queue them?
3. With the connect form open, paste a valid identifier and double-click VERIFY very fast. Does the spinner state lock out the second click?

### Task E — Long / weird input handling

In the connect input on a Polymarket modal, try:

1. **Very long string** (50+ chars): `0x` followed by 60 hex chars. Does the input handle it gracefully?
2. **Special chars**: `0xab&^%$@!`, `<script>alert(1)</script>`. Should be rejected by shape check; verify no XSS.
3. **Whitespace padding**: `   0xabcdef12   ` (with leading/trailing spaces). Should be trimmed and accepted.
4. **Empty space** (just spaces): `      `. Should be treated as empty → "required" error.
5. **Unicode**: `0xab🦊cdef`. Should reject (not valid hex).

### Task F — Toast lifecycle

1. Trigger a success toast (verify a real wallet on Polymarket).
2. Time it: does the toast auto-dismiss in ~5 seconds?
3. Trigger 3 success toasts back-to-back (quickly verify 3 tournaments). Do they stack or overwrite?
4. Are old toasts still readable while new ones come in?

### Task G — Cross-venue user flow

1. Open a Polymarket tournament modal. Verify a wallet successfully. Get the success toast.
2. Modal closes. Now click `BUY IN →` on an **OG** tournament row.
3. Modal opens fresh — confirm:
   - Header shows `OG` (not Polymarket)
   - Choose step pitches `Sign up via Sneakers` for OG (not Polymarket)
   - Connect form expects an OG handle (not a wallet)

This confirms the modal correctly switches venues per click and doesn't carry stale state from the previous one.

### Task H — Affiliate URL inspection

For each venue, click "Sign up via Sneakers" and verify the new tab's URL:

| Venue | Expected URL |
|---|---|
| Polymarket | `https://polymarket.com/?ref=SNEAKERS` |
| Limitless | `https://limitless.exchange/?ref=SNEAKERS` |
| OG | `https://og.markets/?ref=WINDAILY` |
| Hyperliquid | `https://app.hyperliquid.xyz/?ref=SNEAKERS` |

(Skip Kalshi if no Kalshi tournament is in the schedule — it's known not to be wired.)

Confirm each opens with the correct ref query param. **Note**: some of these URLs (og.markets, limitless.exchange, app.hyperliquid.xyz) may not be real production URLs — that's expected for now; the data shape is what matters.

### Task I — The "back to lobby" experience

After successfully verifying a venue:

1. Modal closes, toast shows.
2. Look at the lobby. Did the BUY IN button on the row you came from change in any visible way? (E.g., a checkmark, a "VERIFIED" badge, anything to indicate "you're connected to this venue now"?)
3. Likely: nothing changes. The lobby still shows BUY IN as if you'd never connected. This is part of the same gap as Task A — the prototype doesn't track connection state across modal openings. Worth confirming.

### Task J — Big-picture feel

After running through all the above, take 2 minutes and just *use* the lobby like a curious user would. Click around. Try to break things. Try to do a thing that wasn't covered above.

Then: **what felt good, what felt off, and what's the single thing that would make this feel most like a real product?**

---

## Reporting back

One consolidated message:

```
PART 1 — Fix verification:
  Fix 1 (footer): PASS/FAIL · note
  Fix 2 (aria/title): PASS/FAIL · note
  Fix 3 (OG regex): PASS/FAIL · note
  Fix 4 (connect copy): PASS/FAIL · note
  Fix 5 (a/an article): PASS/FAIL · note
  Fix 6 (toast truncate): PASS/FAIL · note
  Total: X/6

PART 2 — Deeper dive:
  Task A (state persistence): <2-3 sentences on what actually happens>
  Task B (focus / keyboard): <verdict per sub-test>
  Task C (responsive): <viewport-by-viewport verdict>
  Task D (spam input): <verdict>
  Task E (weird input): <one line per sub-test>
  Task F (toast lifecycle): <verdict>
  Task G (cross-venue): <verdict>
  Task H (affiliate URLs): <one line per venue>
  Task I (back-to-lobby): <verdict>
  Task J (big-picture feel): <free-form>

Top 3 to fix next:
  1. ...
  2. ...
  3. ...

Top 3 working surprisingly well:
  1. ...
  2. ...
  3. ...

Anything that's broken vs. just polish — call out which.
```
