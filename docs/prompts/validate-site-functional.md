# Sneakers Terminal — validate site functionality after the pooler fix

Background: we just unblocked the production 503 storm by switching `POSTGRES_URL` to the Supavisor pooler and adding `ANTHROPIC_API_KEY`. A spot-check showed 0% 503 rate. Now we want to confirm the site **actually works end-to-end** — every nav surface, no broken pages, no dead clicks.

You're a UX QA tester. **Be concrete. Numbers + verbatim error messages, no adjectives.**

## Sign in fresh

1. Go to `https://sneakersterminal.com/login`. Sign in with the credentials the user provides (or stop and ask).
2. Hard refresh once you land on `/dashboard` (Cmd+Shift+R) so we're on the latest deploy, not cached JS.

## Walk every nav surface

For each click below, record only:
- **Did the destination render?** (yes / partial / no / error)
- **Roughly how long?** (snappy <1s · fine 1–3s · slow 3–6s · broken >6s with no skeleton)
- **Any console errors or visible bugs**

Don't time with `performance.now()` this pass — we already validated speed. Just confirm everything works.

### A. Topbar filter pills
1. Click each pill: All · Sports · Politics · Crypto · Economics · Tech.
2. After each, scroll down to confirm the markets list actually loaded with category-filtered rows (not a blank state).

### B. Apps-bar venue logos
1. Click Polymarket logo → confirm popover opens (NOT a page navigation). Click "Manage connection" inside the popover → should land on `/dashboard/settings/autotrade`. Back to /dashboard.
2. Repeat with Kalshi → "View markets" → should land on `/markets?platform=kalshi`. Back.
3. Click "(+39 more)" text → confirm full venue picker drawer opens. Close it.

### C. Hamburger menu (top-right)
Click hamburger → click each enabled item one at a time, navigating back to /dashboard between each:
- Markets · Minute Markets · Alerts · Profile · Settings · Trading & Autotrade · AI API Keys · Billing · Connections
For each: confirm the page renders without errors. Note any that 404, blank, or error.

### D. Market detail (the heavy server query)
1. From `/dashboard`, click the top row in "Biggest Volume" → market detail page should render with chart + buy/sell panel.
2. Hit browser back → /dashboard.
3. Click second row → render again.

### E. /dashboard/connections
1. Open `/dashboard/connections`.
2. Confirm the LIVE pill is green (not "NO DATA") on Polymarket / Kalshi / NoVig / ProphetX.
3. Click CONNECT ↗ on NoVig → new tab opens (note the URL it lands on); the original card should flip to DISCONNECT.

### F. OToole chat (now that the API key works)
1. From any dashboard page, type into the chat input: `take me to crypto markets`. Press Enter.
2. Confirm O'Toole replies AND navigates to /markets?category=crypto within ~10s.
3. Type: `show me the highest volume Kalshi market right now`.
4. Confirm a sensible reply (text or navigation).

### G. Autotrade settings page
1. Go to `/dashboard/settings/autotrade`.
2. Confirm the Polymarket-blue gradient header renders, the credentials form has 5+ input fields (API key, secret, passphrase, private key, funder address), and the "O'Toole co-pilot — LIVE" section is visible below.

## Report back

```
## A. Topbar pills
- All / Sports / Politics / Crypto / Economics / Tech: <one line each — rendered? speed? errors?>

## B. Apps-bar
- Polymarket popover + Manage connection: <result>
- Kalshi popover + View markets: <result>
- (+N more) drawer: <result>

## C. Hamburger menu
- Each item: <result, one line each>
- Any 404 / blank / errored items: <list verbatim>

## D. Market detail
- Two market clicks landed: yes/no, content rendered: yes/no

## E. Connections
- LIVE pill green on Polymarket/Kalshi/NoVig/ProphetX: yes/no
- NoVig CONNECT new-tab URL: <verbatim>
- Card flip after CONNECT: yes/no

## F. OToole
- "take me to crypto markets" navigated: yes/no, latency: <Xs>
- Second prompt got a sensible reply: yes/no

## G. Autotrade settings
- Header + form + co-pilot section all rendered: yes/no

## Anything broken
- <list — verbatim error messages, screenshots if helpful>

## Bottom line
"Everything works" / "X is broken: <details>"
```

Aim for under 500 words. If anything 5xxs or hard-errors, screenshot and stop.
