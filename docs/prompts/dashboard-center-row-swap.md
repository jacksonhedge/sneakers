## Dashboard center-row swap — verify Tournaments + Teach-Your-Bot tiles

Two tiles on `/dashboard` were just replaced. Verify the new layout looks right and behaves correctly. Browser-only — no shell, no code edits.

Dev server: http://localhost:3000

---

## Setup

1. Make sure you're signed in. If not, sign in at http://localhost:3000/login.
2. Go to http://localhost:3000/dashboard
3. Locate the **center 3-column row** (between the four category cards on top and the Biggest Movers row below). It should have **three** tiles side-by-side at xl breakpoint:
   - Left: `Biggest Volume`
   - Middle: `Tournaments` (NEW — was Cross-Book Spread)
   - Right: `Teach your AI bot to trade` (NEW — was Normalized Market Performance)

If you still see "Cross-Book Spread" or "Normalized Market Performance" anywhere on this page, hard-refresh (Cmd+Shift+R). The dev server may need to recompile.

---

## Task A — The old tiles are gone

1. Search the rendered page for the strings:
   - `Cross-Book Spread` → should NOT appear anywhere
   - `Normalized Market Performance` → should NOT appear anywhere
   - `+1 PAIR / X PAIRS` chip → should NOT appear
2. Report PASS/FAIL.

---

## Task B — Tournaments tile (middle column)

1. Confirm the header reads `Tournaments` with a small pink/fuchsia `NEW` pill to its left.
2. Top-right of the header has an `ALL →` link. Click it — should navigate to `/dashboard/horse-race`. Click back.
3. The tile body shows up to **5 rows**. Each row should have:
   - A **circular asset badge** (orange ₿, indigo Ξ, or violet/fuchsia ◎)
   - **Flavor text** (e.g. `BTC sprint`, `ETH sprint`, `SOL classic`, `BTC classic`, `BTC marathon`)
   - A **size pill** (`1V1 DUEL` / `5P TABLE` / `10P TABLE`)
   - A subtle line: `$N · <Venue> · X/Y` (buy-in · settlement venue · registered/cap)
   - A thin **fill bar** under that text
   - A **countdown** on the right (`MM:SS` or `0:NN` or `NOW`), font-mono, tabular-nums
   - A small fuchsia/rose **`BUY IN →`** button at bottom-right of the row
4. Wait ~3 seconds. The countdown digits on at least one row should TICK DOWN (decrement by 1 per second). Confirm the timer is alive.
5. The footer reads: `Crypto Horse Race · 5/15/30-min strike markets` with an `OPEN LOBBY →` link. Click it — should land at `/dashboard/horse-race`. Click back.
6. The tile body should NEVER show a row with status `live` or `resolved` — only WAITING / LOCKED / STARTING / UNDERFILLED-style countdowns. (Easiest check: no rose `LIVE NOW` strip or `WATCH` button on any row.)
7. Each `BUY IN →` button has a `title` attribute. Hover one — tooltip should read like `"Buy in to BTC sprint on Polymarket"`.

---

## Task C — Teach-Your-Bot tile (right column)

1. Confirm the header reads `🤖  Teach your AI bot to trade` with a small `5 PICKS` chip on the right.
2. Body shows **5 cards** stacked vertically. Each card has:
   - A **kind chip** in the top-left: black `𝕏 TWEET`, emerald `✎ ARTICLE`, or rose `▶ VIDEO`
   - An **author** label next to it (e.g. `@cryptoTrader`, `Sneakers`, `Aaronson + co.`)
   - On the top-right: a yellow `COMING SOON` badge (because all URLs are placeholders right now)
   - A **bold title line** underneath
   - A **2-line hook description** below the title (line-clamp-2)
3. Hover any card — cursor stays as the default arrow (NOT pointer), card visual stays static. (They're disabled until URLs are filled.)
4. Click a card — nothing should happen (no nav, no new tab). Confirm.
5. Footer reads: `Tweets · articles · walkthroughs to sharpen your prompt + strategy.` with a `STRATEGY →` link to `/dashboard/settings/otoole`. Click it — should navigate. Click back.

Expected list of 5 cards in order:
1. ARTICLE — Sneakers — `How O'Toole reads markets — strategy, not signal`
2. TWEET — @cryptoTrader — `Fading Polymarket overround on settled events`
3. ARTICLE — Aaronson + co. — `Prompting an LLM to size positions like a trader`
4. TWEET — @kalshi_quant — `Cross-venue arb on weather contracts`
5. VIDEO — @predictionalpha — `Building a Polymarket bot in 30 minutes`

---

## Task D — Layout sanity

1. **xl breakpoint** (≥ 1280px wide): the row is 3 columns side-by-side, `1fr · 1fr · 1.5fr`. Tournaments takes ~the same width as Biggest Volume; Teach-your-bot is ~50% wider than each of those.
2. **Below xl** (resize down to ~1200px): the three tiles stack vertically, full-width.
3. All three tiles in the row should be the **same height** (tournaments + bot tile use `h-full`).
4. No horizontal overflow / scrollbars.

---

## Task E — Visual polish

Open the page and look at the row holistically. Answer briefly:
- Does the new center-row reading order (volume → tournaments → bot training) feel like it tells a story (what's hot · what's playable · how to get better)? Or does it feel disconnected?
- Tournaments tile: does the row density feel right, or is it cramped / sparse?
- Teach-your-bot tile: do the COMING SOON badges feel like a "we're working on it" promise, or like a half-finished feature?
- Any single visual that should change before this ships to prod?

---

## Reporting back

```
Task A (old tiles gone): PASS/FAIL · note
Task B (Tournaments tile): PASS/FAIL per sub-step (1-7)
Task C (Teach-Your-Bot tile): PASS/FAIL per sub-step (1-5) + list of titles seen
Task D (layout): xl=PASS/FAIL · stacked=PASS/FAIL · heights=PASS/FAIL · overflow=PASS/FAIL
Task E (polish): 4 short answers

Top 3 to fix before prod:
  1.
  2.
  3.

Anything broken vs. just polish — call out which.
```
