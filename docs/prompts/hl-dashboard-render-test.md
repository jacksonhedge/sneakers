## Dashboard render-speed + banner verification

Dev server was just restarted with a bumped DB pool connection timeout (2s → 5s). Previous render of `/dashboard?error=not_admin` was hanging indefinitely on the splash because the DB connection was timing out and forcing a 4 GB JSONL fallback scan. The fix should let the page render in <1s.

**Browser-only tasks. No code edits, no shell, no logins required (current +test1b alias is fine).**

### Task A — dashboard render speed
1. Hard-reload http://localhost:3000/dashboard?error=not_admin (cmd+shift+R or right-click → "Empty cache and hard reload").
2. Time it with a stopwatch / wall clock. Note: time-to-first-paint of the actual dashboard content (BalanceCard, market tables) — not just the loading splash.
3. Report:
   - Wall-clock time from request to actual dashboard rendering.
   - Did you see the centered "SNEAKERS TERMINAL — Connecting to Polymarket, Kalshi…" loading splash, and how long was it visible?
   - Once content rendered: is the page actually populated (balance card, category cards, market tables) or still empty?

### Task B — not-admin banner
1. On the same `/dashboard?error=not_admin` page (after content renders), look for an **amber banner at the top** above the BalanceCard.
2. Banner should read: "ADMIN-ONLY PAGE — You're signed in but not on the admin allowlist." with a `DISMISS` button on the right.
3. Click `DISMISS` — banner should disappear.
4. Hard-reload — banner should reappear (only dismissed for that session).
5. Navigate to plain http://localhost:3000/dashboard (no `?error=not_admin`) — banner should NOT appear.
6. Report: did the banner appear, dismiss, reload, and stay-hidden-on-clean-URL all behave correctly?

### Task C — O'Toole tool-call verification
On the dashboard chat panel (left side, "Talk to O'Toole" input), send these three messages sequentially and paste back the verbatim O'Toole responses + any visible tool-call indicators (the chat usually shows a "calling tool…" line or a tool-call badge before the answer):

1. **"What's the funding rate on HYPE?"**
   - Expected tool: `get_hl_perp`
   - Expected: a specific funding APR % for HYPE, mark price in $, OI in $.
   - Failure: "I don't have access to live data" or generic / made-up numbers.

2. **"Show me the most overheated perps"**
   - Expected tool: `get_hl_funding_outliers`
   - Expected: list of 3–10 coin tickers with APR % and OI in $.
   - Failure: generic talk about funding without specific tickers.

3. **"Compare BTC perp to Polymarket BTC markets"**
   - Expected tool: `compare_hl_to_predictions`
   - Expected: BTC HL state (mark, funding, OI) **alongside** specific Polymarket question titles + their YES prices.
   - Failure: only HL info OR only Polymarket info, not both.

### Reporting back
One consolidated message with:
- `Task A:` <render time, splash duration, content state>
- `Task B:` <banner appear / dismiss / reload / clean-URL behavior>
- `Task C:` <prompt #1 verbatim answer, #2 verbatim answer, #3 verbatim answer + which tools you saw fire>

If anything's broken, that's actionable feedback for the code session — don't try to fix from the browser.
