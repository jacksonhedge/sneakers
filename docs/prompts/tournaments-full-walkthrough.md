## Crypto Horse Race tournaments — full walkthrough

Goal: walk every surface of the tournament product and report what works, what feels off, and what's missing. Browser-only — no shell, no code edits, no logins beyond what's already cached. Dev server is at http://localhost:3000.

There are three surfaces to evaluate, in this order:

1. **Lobby** at `/dashboard/horse-race`
2. **Spectator** at `/dashboard/horse-race/<id>` (reach by clicking 👁 on a tournament row)
3. **Live demo** at `/horse-race-demo` (reach via JOIN CTA on the spectator surface, or directly)

For each section below: report your findings as one consolidated message at the end.

---

### Surface 1 — Lobby

Open http://localhost:3000/dashboard/horse-race

**Visual / hierarchy:**
- The black "Sneakers Tournaments" branded strip at the top — does it read as a real product/league brand, or does it feel pasted on?
- Hero section ("Tournaments for 5-minute markets") — clean enough, or noisy?
- Tournament cards are at the top (above the formats / math). Does the priority feel right (action first, explanation below)?
- "How it works" is in the right 1/3 sticky column below the tournaments. Does it stay readable as you scroll the left column?

**Tournament card scan-ability:**
- Each card shows: asset badge, title, size badge (1V1 / 5P / 10P), duration, mode (MANUAL / AUTO), status pill (WAITING / LOCKED / STARTING / LIVE / UNDERFILLED), money line, fill bar with player count, countdown clock, BUY IN button, and a small 👁 spectate icon. Are any of these badges too dense or redundant?
- The venue badge ("on Polymarket" / "on Limitless" / etc.) — is the venue logo + name clear at this size? Is the messaging right (does "on X" feel like the right preposition, or should it be "via X" / "settling on X")?
- BTC equivalent on prize pool ("≈ 0.00225 BTC") — useful or noise?

**Interactivity:**
- Click each pill in the size filter at the top (`ALL · 1V1 · 5P · 10P`). Do the cards filter cleanly? Does the count "X of Y" update? Is there a visible transition?
- Click `BUY IN →` on a few tournament rows. A toast should appear top-right: "Registration not live yet — <flavor> · <size> on <venue>." Does the toast read as helpful or annoying? Does it auto-dismiss after ~5s?
- Click the 👁 icon next to a BUY IN button. You should land on the spectator surface for that tournament. Confirm.
- Scroll down to the "Heads up before the gates open" CTA section. Click `NOTIFY ME` (the dark outlined button). A success toast should fire: "You're on the list."
- Click `TRY THE LIVE DEMO →` (gradient pill in the same CTA section). It should take you to /horse-race-demo. Note how this flow compares to clicking 👁 on a row — they're different UX paths to similar surfaces.

**Tournament lifecycle:**
- Watch the lobby for ~30-60 seconds. Tournaments that hit the lock-in window should transition status (WAITING → LOCKED if filled, or → UNDERFILLED if not). When that happens, a toast should fire automatically.
- Sit on the page until you see a status transition fire. Does the toast appear smoothly? Is the wording right?
- Notice that 1V1 tables tend to fill faster than 10P tables — is that visible in the fill bars across rows?

**Settlement options card:**
- Below the sample-math card on the left, there's a "Settlement · open call" section with three cards: Sneakers bankroll · Crypto.com / Coinbase resell · BTC-denominated on-chain. Read them. Does the framing read as a real product question being weighed in the open, or does it look like a designer's afterthought?

---

### Surface 2 — Spectator race

From the lobby, click the 👁 icon next to any BUY IN button. You should land at `/dashboard/horse-race/<some-id>`.

**Header:**
- Top-left: `← LOBBY` link, `LIVE` pill (rose, with pulsing dot), tournament title + truncated ID
- Top-right: `👁 X watching`, `↗ SHARE` button, `JOIN ROUND $5 →` gradient pill, countdown clock
- Click `← LOBBY`. Does it route back cleanly?
- Come back to this race. Click `↗ SHARE`. The current URL should copy to your clipboard, and a toast should appear at the bottom: "Link copied — share to bring people in." Does the toast appear and dismiss correctly?
- Try pasting the copied URL into a new tab. Does it land you on the same tournament's spectator surface?

**Layout:**
- Left column: read-only strike race lanes (top) + tournament leaderboard (bottom). Right column: BTC chart with horse cursor + floating emoji reactions.
- This mirrors the layout of the participant demo. Does it feel sufficiently *different* from the participant view, so you know you're spectating not playing? (Hint: there are no buy/sell buttons, no personal score bar.)

**Strike race lanes (left top):**
- Four strike lanes, sorted by current YES probability. Rank-1 strike gets a yellow "LEADER" chip.
- The horse pill on each lane should slide horizontally as probabilities update.
- Watch for ~30 seconds. Do lanes ever swap order (when one strike's probability passes another's)? If so, does the swap feel smooth or jarring?

**Leaderboard (left bottom):**
- 10 simulated rivals with random-walking equities, no "you" row (you're spectating, not playing).
- Score column should roll digits (RollingNumber).
- When a rival climbs in rank, watch for the ▲+N badge fading in next to their rank. Does it appear and fade out cleanly?

**BTC chart (right):**
- Live BTC line with the 🏇 horse riding the endpoint, pulsing.
- Floating emojis from rivals "buying" should pop up periodically along the chart pane. Do they feel alive or distracting?

**Resolution:**
- Round resolves at T-0 (countdown reaches zero). After ~5 minutes (or pause and switch to /horse-race-demo for a faster simulation).
- When resolved: emerald banner naming the winning strike + lobby CTA. Does the banner clearly tell you the round is over?

---

### Surface 3 — Live participant demo

Reach by clicking `JOIN ROUND $5 →` from the spectator surface, OR `TRY THE LIVE DEMO →` from the lobby CTA, OR direct: http://localhost:3000/horse-race-demo

**Same general layout as spectator (left = strikes + leaderboard, right = BTC chart) but participant.**

**Score bar (top of left column):**
- Black panel with CASH · TOTAL EQUITY · RETURN. As you trade, all three should update live; RETURN is RollingNumber-animated.
- Does the visual hierarchy read right? Cash and Equity in the same row, return as the highlight?

**Strike trade panels:**
- Below the score bar, each strike now has YES + NO trade subpanels with `BUY +$5` and `SELL` buttons.
- Click `BUY +$5` on any strike's YES side. Cash should drop $5; YES position should appear with average cost; floating 🏇 emoji should pop from the right side of the chart pane.
- Click `BUY +$5` on the same strike's NO side. Now you have positions on both sides — confirm.
- Click `SELL` on either position. Cash should rise by the position's mark-to-market value; position should clear.

**Header controls:**
- `🤖 AUTO-TRADE OFF` button at the top right. Click it. It should turn emerald with `🤖 AUTO-TRADE ON`. After ~4 seconds, you should see a 🏇 with a 🤖 tag emoji pop from the chart pane (the bot fired a buy on your behalf).
- Confirm cash drops and a position appears even though you didn't click anything.
- `PAUSE` and `RESET` buttons — confirm they work.

**BTC chart toggle:**
- Right pane has `FULL` / `TAIL 60s` toggle. Click `TAIL 60s`. Chart should snap to last 60 seconds + show horizontal strike-level lines overlaid in emerald with labels. Click back to `FULL`.

**Live behavior over a longer window:**
- Let the page run for 2-3 minutes without interrupting. Probabilities should drift, leaderboard should shuffle, your own equity should mark-to-market, simulated rivals should pop emojis at irregular intervals.
- Does it feel alive or stale?
- Does anything visibly stutter or glitch?

---

### Things to specifically evaluate

After walking through all three surfaces, give a 1-line yes-it-works / felt-off / suggest-X verdict on each:

1. **Brand strip at top of lobby** — does "Sneakers Tournaments" read as a real product brand?
2. **Card density** — is the tournament card showing too many badges / too much info, or right amount?
3. **Venue badges** — does seeing "on Polymarket" / "on Limitless" / "on Hyperliquid" feel valuable?
4. **Two filters at top** — size filter and the "ALL of X" counter — is that pair clear?
5. **BUY IN → toast** — useful feedback or noisy?
6. **Status transitions + toasts** — feel responsive or too aggressive?
7. **Spectator surface** — clearly different from participant? Easy to share?
8. **Spectator "watching count"** — believable?
9. **JOIN ROUND CTA on spectator** — visible and pulling?
10. **Floating emoji reactions** — fun or distracting?
11. **Auto-trade in the demo** — clear what's happening?
12. **TAIL vs FULL chart** — which one would you pick if forced to choose just one?
13. **Settlement options card** — useful framing or out of place?
14. **Overall**: does this feel like a real tournament product or like a tech demo?

### Reporting back

One consolidated message:
- `Lobby:` <findings + verdicts>
- `Spectator:` <findings + verdicts>
- `Live demo:` <findings + verdicts>
- `Cross-cutting:` 14 one-liner verdicts on the items above
- `Top 3 things to fix first:` ranked
- `Top 3 things working well:` ranked

Anything that's broken vs. just-needs-polish — call out which.
