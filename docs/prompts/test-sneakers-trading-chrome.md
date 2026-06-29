You are testing the **Sneakers** trading prototype running on a LOCAL dev server. Sneakers is a Bitcoin-focused, ~90% automatic **up/down trading bot** for short-interval crypto markets (5/10/15-min), currently in a **paper-trading (dry-run)** stage. Your job: exercise the whole trading experience in the browser, focus on **"turning on the trading aspect,"** and report what works, what's broken, and what's missing.

## SAFETY RULES (follow exactly)
- This is a prototype with demo / dry-run data. **Do NOT enter any real API keys, passwords, seed phrases, or payment details** anywhere.
- **Do NOT fund any wallet** or attempt any real-money action.
- No real trades can execute (execution isn't built yet) — don't try to force one.
- If a form asks for credentials, you may type obviously-fake placeholders (e.g. `test-key-123`) to test the flow, then cancel/close — never real secrets.

## URLs (local dev server, already running)
1. Markets grid: `http://127.0.0.1:8765/docs/prototypes/sneakers-markets-grid.html`
2. Agent dashboard: `http://127.0.0.1:8765/docs/prototypes/sneakers-agent.html`

(If a page says "Couldn't reach the live feed," the local proxy isn't running — note it and stop.)

## PART A — Markets grid
1. Confirm it loads: a grid of crypto "Up/Down" market cards, a header with "N live" + a Refresh button, and filter chips.
2. **Live data per site:** confirm there are cards labeled **Polymarket** (with real odds like `.47 / .53`, `.51 / .49`) AND **Kalshi**. Kalshi cards may show **"no book"** with `—` odds — that's expected (those markets are thinly traded). Count how many of each.
3. **Filters:** click the interval chips (All / 5M / 10M / 15M) and the site chips (All sites / Polymarket / Kalshi). Confirm the grid filters correctly each time. Read the count text ("X shown · Y priced · Polymarket N · Kalshi K").
4. **Real-time:** watch ~20s. Confirm countdowns tick down, and at least some Polymarket odds update / flash green-red (they poll every 6s). Note anything frozen or wrong.
5. Click **Refresh**; confirm a brief loading (skeleton) state then repopulation.

## PART B — Agent dashboard & "turning on trading" (the key test)
1. Confirm it loads: a **Returns** headline number + P&L chart, a **venue desk** (Polymarket / Kalshi / Coinbase / Robinhood logos), a markets list, and a bottom **Rules** bar.
2. **Speed control:** find Off / Calm / Active / Turbo. Click through them and describe what changes on the venue desk (logos should glow green/red and float +$ / −$ amounts as simulated trades fire; Turbo = several per second, stacking numbers).
3. **Chart:** hover/drag across the P&L chart — confirm the headline number updates to the hovered point. Try the range toggle (1D / 1W / 1M / 3M / ALL).
4. **TURNING ON THE TRADING ASPECT** (focus here):
   a. In the bottom **Rules** bar, find the risk preset (e.g. "Balanced"), loss cap, and deposit. Click **Edit rules** / the controls; describe what's adjustable. Try changing the risk preset across the 5 options (Bunker → Cautious → Balanced → Aggressive → Max) if possible.
   b. Click the **gear (⚙)** → a **"Connect your venues"** modal opens. This is the gateway to real trading. Describe it: the Polymarket fields (CLOB API Key / Secret / Passphrase), the Kalshi fields (API Key ID / Private Key), and the **"OAuth · soon"** buttons. Type FAKE placeholder values, hit **Save keys**, and confirm what happens (the venues should mark "✓ connected"). Then judge: **is there a clear "go live / turn on live trading" switch, or is it only dry-run?**
   c. Find the **Kill** switch — confirm it's present and obvious.
5. **Assess the flow:** as a user trying to "turn the bot on and let it trade," how clear is it? Where do you get stuck? What's missing to actually start trading?

## REPORT BACK
- **A) Live data per site:** does each site show live markets (Polymarket real odds + Kalshi present)?
- **B) Interactions:** which work vs. broken — filters, countdowns, odds updates, speed control, chart scrub, rules edit, connect-keys modal, kill switch.
- **C) "Turn on trading" flow:** how far can a user get, where does it gate, what's confusing or missing to actually go live?
- **D) Issues:** any visual/UX problems, console errors, or things that look fake/placeholder.
- **E) Top 5 next steps** to make "turning on trading" real and trustworthy.

Be specific, and screenshot the key states (grid with both sites, the speed/Turbo desk, the connect-keys modal, the rules editor).
