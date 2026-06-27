## Crypto Horse Race · live 5-minute round visual test

Goal: walk a full 5-minute simulated tournament round end-to-end and report on what feels right vs. what needs dialing. Browser-only — no auth, no shell, no code edits. The dev server is running at http://localhost:3000.

### Setup
1. Open http://localhost:3000/horse-race-demo
2. The page should load instantly (no auth wall, simulated data only).
3. Hit `RESET` to start a clean round at $80,000 BTC, $18 starting cash, 5:00 on the clock.
4. Make sure the chart pane on the right has the toggle showing — `FULL` and `TAIL 60s`.

### Task A · Layout impressions (no clicking yet, just look)
- **Two-pane balance** — left column (strikes + leaderboard) vs right column (BTC chart). Does the 1:2 ratio feel right at your viewport, or does one side feel cramped/over-large?
- **Top-left strike trades** — 4 strike lanes stacked. Is the BUY YES / BUY NO / SELL button density legible, or is it too dense?
- **Bottom-left leaderboard** — collapsed by default to 5 rows. Find your row (avatar 🏇, name "you", emerald highlight). Is the YOU treatment subtle enough or does it read as obnoxious?
- **Right pane BTC chart** — does the 🏇 horse emoji riding the line endpoint feel cool, or does it feel like a sticker stuck on?

### Task B · The 5-minute round (start the timer)
1. Click `RESUME` if paused. Round is 5:00.
2. **First minute** — don't trade. Just watch. The line builds, leaderboard ranks reorder via FLIP animations, score bar (top-left of strikes block) updates equity in real time.
3. **Minute 2** — buy something. Click `BUY +$5` on a YES side that looks promising (e.g., the lowest strike — most likely to resolve). Watch your cash drop and the position appear with mark-to-market value.
4. **Minute 3** — try the chart toggle. Click `TAIL 60s` on the right. The view should snap to the last 60 seconds with horizontal strike levels overlaid. Click back to `FULL`.
5. **Minute 4** — `EXPAND ▾` the leaderboard. Watch ranks shuffle as scores walk. Click `COLLAPSE ▴`.
6. **Minute 5** — the timer turns red and pulses at ≤15s. Round resolves. Banner at top says winner, your final cash, return %.

### Task C · Specific things to watch and report on
For each, give a one-line yes-it-works / felt-off / suggest-X verdict:

1. **Horse emoji on the chart** — pulses smoothly? Right size? Does it occlude the price tooltip when you hover the chart?
2. **TAIL 60s mode** — does it make the price action more readable, or just feel zoomed-in? Are the dashed strike-level horizontal lines useful or noisy?
3. **FULL mode** — at minute 5, the chart shows ~200 points across 5 minutes. Is the line crisp enough at that density, or does it look choppy?
4. **Auto-scaled Y axis** — over 5 minutes BTC moves maybe ±$300. Does the line use the full chart vertical, or does it look squashed?
5. **Strike probabilities deriving from BTC** — when BTC ticks up noticeably, do all four strike lanes' percentages move in concert (lower strikes ↑, higher strikes ↓)? Does that read as "natural" or "computed"?
6. **Leaderboard rank changes** — when your equity climbs, does your row rise smoothly? Does the rank-change badge (`▲ +1`) appear next to your rank? Does it fade out cleanly?
7. **Trade buttons** — clicking `BUY +$5` on a strike with very low probability (e.g., 5%) should give you a lot of shares. Does the shares-bought feel comprehensible, or like a black box?
8. **Resolution banner** — when the round ends, does the banner clearly tell you who won, your final cash, and your return %? Or is it cluttered/confusing?

### Task D · The two graph options head-to-head
The user explicitly wants to compare two graph styles:

- **Style 1 — FULL session** — entire 5 minutes, dashed line marks start price, no strike-level overlays. Best for "where has BTC been all round."
- **Style 2 — TAIL 60s + strike levels** — last minute only, horizontal lines at $79.5k, $80k, $80.5k, $81k. Best for "where is BTC right now relative to my strikes."

After running through one full round, **state your preference** between the two and explain in 2-3 sentences:
- Which one would you keep as the default if you had to pick one?
- Or should both stay as a user-toggle (current behavior)?
- Anything missing from either that would tip the balance?

### Task E · Edge cases worth poking
1. Buy YES on the *highest* strike (lowest probability). When BTC spikes up, do you actually win money?
2. Buy NO on the *lowest* strike (highest YES probability — so NO is cheap). When BTC drops, do you win?
3. Hit `PAUSE` mid-round. Does everything freeze cleanly — leaderboard, BTC chart, position values?
4. Spam `BUY +$5` until cash hits zero. Does the button disable correctly? Do positions still mark-to-market?

### Reporting back
One consolidated message:
- `Task A:` <layout impressions>
- `Task B:` <round walkthrough — anything visibly wrong>
- `Task C:` <eight one-liners on the specifics>
- `Task D:` <preference between the two graph options + reasoning>
- `Task E:` <edge case findings>

Anything that's broken vs. just-needs-polish — call out which.
