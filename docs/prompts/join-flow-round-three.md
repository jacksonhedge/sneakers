## Join-tournament flow — round 3 (state persistence + a11y + polish)

Round 2 surfaced three structural gaps. This round verifies the fixes shipped for them, plus two polish items.

Browser-only. Dev server at http://localhost:3000.

---

## What changed

1. **State persistence (Task A from round 2)** — once you successfully verify a venue in this session, subsequent BUY IN clicks on the **same venue** open a new "fast-track" step instead of the choose / connect steps. The footer copy "Future tournaments on Polymarket skip this step" is now true.
2. **Lobby reflects connection state (Task I from round 2)** — after a successful verify, every BUY IN button on rows for that venue gains a leading ✓ and switches from fuchsia/rose to emerald.
3. **Modal focus trap + initial focus (Task B from round 2)** — Tab/Shift+Tab now cycle within the modal; focus is moved into the dialog on open and restored to the originating BUY IN on close.
4. **Spam-click shield** — for the first 250ms after the modal opens, its `pointer-events` are suppressed. Burst clicks no longer leak through onto the underlying Sign-up card and spawn affiliate tabs.
5. **Truncation threshold off-by-one** — `0xdeadbeef1234` (14 chars) now collapses to `0xdead…1234` in the success toast.

---

## PART 1 — Verify the round-3 fixes

For each, give a one-line PASS / FAIL / PARTIAL verdict.

### Fix 1 — State persistence (the big one)

1. Open http://localhost:3000/dashboard/horse-race
2. Click `BUY IN →` on any **Polymarket** row → choose "I already have one — connect" → paste `0xabcdef12` → VERIFY → success toast (retry if you hit the 10% failure case).
3. Now click `BUY IN →` on a **DIFFERENT Polymarket** row.
4. **Expected**: modal opens directly on the new fast-track step:
   - Emerald banner: `✓ Polymarket already connected · Account 0xabcdef12 · verified this session`
   - White "Buy-in summary" card showing flavor / size / cash / settles-on
   - Big emerald **CONFIRM BUY-IN — $X** button
   - Smaller "Re-verify Polymarket account" link below
5. Click `CONFIRM BUY-IN`. Modal closes. New toast: `Buy-in queued — <flavor> · <size> on Polymarket. Live escrow + payment goes live next round.`
6. Click `BUY IN →` on a third Polymarket row — fast-track step appears immediately again.
7. Click `Re-verify Polymarket account` from inside the fast-track step — should fall back to the original choose step.

### Fix 2 — Lobby BUY IN shows verified state

1. Refresh the page (state is session-only, by design).
2. Verify Polymarket once.
3. After modal closes, scan the lobby. Every Polymarket row's BUY IN button should:
   - Be emerald (gradient `from-emerald-500 to-emerald-600`), not fuchsia/rose
   - Have a leading `✓` before the `BUY IN →` text
   - Have an updated tooltip / aria-label: `"Polymarket already connected — one-tap buy-in for <flavor>"`
4. Other venues' rows (Limitless / OG / Hyperliquid) should still be fuchsia/rose.
5. Verify a second venue (say OG). Both venues' rows should now be emerald; the other two stay fuchsia/rose.

### Fix 3 — Focus trap + initial focus

1. Open any tournament modal via mouse click.
2. Hit `Tab` repeatedly. Focus should cycle through the modal's interactive elements (close ×, sign-up card, connect card) and **wrap to the first** when it reaches the last. It should **never leak into the lobby below**.
3. `Shift+Tab` from the first focusable should wrap to the last.
4. Open the modal, navigate to the connect step, and Tab through there too — BACK / input / VERIFY / nothing-leaks-out.
5. Close the modal (Esc or × button). Focus should return to the BUY IN button you clicked from. Press `Enter` — this re-opens that row's modal.
6. Try to navigate out via Tab+Enter as round 2 did — it should **not** be possible to land on `Watch this race` or another BUY IN.

### Fix 4 — Click shield (250ms)

1. On any non-LIVE / non-UNDERFILLED row, **rapid-click** `BUY IN →` 5+ times in fast succession (as fast as you can).
2. **Expected**: exactly one modal opens. Zero new affiliate tabs open. The Sign-up via Sneakers card does **not** receive any of the burst clicks.
3. Compare to round 2 behavior: clicks 2–5 were landing on the Sign-up card and spawning ~4 polymarket.com tabs. This should now be silent.
4. Click VERIFY rapidly with empty input — only one error message.
5. Open the modal, wait ~1 second, then click the Sign-up card normally. It should fire on the first click (proves the shield is windowed, not permanent).

### Fix 5 — Truncate threshold

1. Verify Polymarket with input `0xdeadbeef1234` (14 chars exactly). Toast should read `Account 0xdead…1234 ready...` (was previously unchanged at 14 chars).
2. Verify another with input `0xabc12345` (10 chars). Toast should still be `Account 0xabc12345 ready...` (unchanged — under threshold).
3. Verify with `0xabcdef1234567890` (18 chars). Toast: `Account 0xabcd…7890 ready...`.

### Part 1 expected outcome

`PART 1 SUMMARY`: 5/5 PASS or list which failed.

---

## PART 2 — New edge cases worth poking

### Task K — Fast-track edge cases

1. Verify Polymarket. Open the fast-track modal. Press `Esc` mid-flow. Modal closes; verified state should persist (open another Polymarket row → fast-track step still shown).
2. Open fast-track. Click `Re-verify Polymarket account`. Modal goes to choose step. Click `← BACK` to nothing — verify a different identifier — confirm the lobby badge & subsequent fast-tracks now use the **new** identifier (the truncated identifier in the emerald banner should change).
3. Verify Polymarket. Verify OG. Open a Limitless row — modal should still be a normal choose step (cross-venue isolation works).

### Task L — Focus trap depth

1. With a modal open, click somewhere inside the modal but on non-interactive content (e.g., the header bar). Press Tab — focus should re-enter the modal cleanly, not jump out.
2. Press `Shift+Tab` from inside the modal repeatedly to cycle backward — confirm wrap-around works in reverse.
3. With the connect step open and a long input typed, Tab from the input → should land on VERIFY, not leak.
4. With a screen reader on (or accessibility tree inspector), confirm the dialog reads as `dialog "Join <flavor> on <Venue>"` when opened.

### Task M — Click-shield timing

1. Time the shield: click BUY IN, then immediately try to click the close × — does it click on first attempt or do you need a second?
2. Repeat with the sign-up card. Roughly: clicks within ~250ms after open should fail silently; clicks after that should work first-time.

### Task N — Lobby state under churn

1. Verify a venue. Wait ~30 seconds while the lobby's rolling schedule advances (rows recycle, statuses change WAITING → LOCKED → STARTING → LIVE).
2. New rows that come in for that venue should also be emerald with a leading ✓.
3. Underfilled / live rows for that venue should still show their existing CLOSED / 👁 WATCH state, not BUY IN — verify the verified-state styling doesn't override status-driven button replacement.

### Task O — Toast lifecycle on fast-track

1. Click `CONFIRM BUY-IN` on a fast-track step — toast should be the new "Buy-in queued" copy, not the old "Connected — verified" copy.
2. Run two fast-track confirms back-to-back across two venues. Confirm the toasts read correctly per venue.

---

## Reporting back

```
PART 1 — Round-3 fix verification:
  Fix 1 (state persistence): PASS/FAIL · note
  Fix 2 (lobby badge): PASS/FAIL · note
  Fix 3 (focus trap + initial focus): PASS/FAIL · note
  Fix 4 (click shield): PASS/FAIL · note
  Fix 5 (truncate threshold): PASS/FAIL · note
  Total: X/5

PART 2 — New edge cases:
  Task K (fast-track edges): <verdict per sub-test>
  Task L (focus trap depth): <verdict>
  Task M (click-shield timing): <verdict>
  Task N (lobby state under churn): <verdict>
  Task O (toast lifecycle on fast-track): <verdict>

Anything broken vs. polish — call it out.
```
