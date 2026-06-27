# Sneakers Terminal — Diagnose click-through latency (pass 3)

Site: https://sneakersterminal.com

You're a UX QA tester for Sneakers Terminal, third pass. Two prior passes already landed: pass 1 fixed the hydration race + 22s blank screens; pass 2 is supposed to have killed an RSC prefetch storm (587 prefetches per 8-nav session was saturating the server and 503ing ~50% of requests). Your job: verify the prefetch storm is gone and the 503s with it. **Numbers, not adjectives.**

## Sign in first — and FORCE a hard refresh

1. Go to `https://sneakersterminal.com/login`
2. Use the credentials the user provides (or stop and ask if not given)
3. After landing on `/dashboard`, **do a hard refresh** (Cmd+Shift+R / Ctrl+Shift+F5) so you're testing the latest deploy, not a cached bundle. Two prior passes were poisoned by stale JS — don't repeat that.
4. Wait for the trading panels (Biggest Volume / Arbitrage / etc.) to actually render — not just the skeleton.

## Headline numbers to capture (NEW vs. last pass)

Open DevTools → Network tab → filter for `_rsc`. Do the full click sequence below, then report:

- **Total `_rsc` request count** across the session. Last pass was 587 across 8 navs — should now be **under 80**.
- **503 rate** on `_rsc` requests. Last pass was ~50% — should now be **~0%**.
- **`/dashboard` "All" pill crash** — last pass clicking All while on /dashboard caused a "This page couldn't load" Chrome error. Verify it doesn't crash now.

## What to measure

For every click below, record:
- **t_to_skeleton** (ms) — time from click to *anything* visually changing (a skeleton, a spinner, the splash screen)
- **t_to_content** (ms) — time from click to the real page content rendering (no more skeletons)
- **observed lag** — your subjective rating: snappy / sluggish / broken (>3s with no skeleton)

If a click shows the branded ticker-tape splash, the site IS responsive — note that explicitly. If a click results in nothing happening for >500ms, that's the bug.

Use `performance.now()` in the DevTools console before each click and again on first paint to get exact numbers. Or count "one Mississippi, two Mississippi" if performance API is awkward.

## Click sequence (do them in order, don't skip)

### A. Top-nav filter pills (these reload the markets list)
Starting from `/dashboard`:
1. Click "Sports" pill in the topbar → should land on `/markets?category=sports`
2. Click "Politics" pill
3. Click "Crypto" pill
4. Click "Economics" pill
5. Click "Tech" pill
6. Click "All" pill

### B. Apps-bar venue logos (top-right, next to + button)
1. Click the Polymarket logo → small popover should drop down (not navigate)
2. Click "Manage connection" link in the popover → should land on `/dashboard/settings/autotrade`
3. Click ← back (browser back)
4. Click the Kalshi logo → popover
5. Click "View markets" → should land on `/markets?platform=kalshi`
6. Click "(+39 more)" text → should open the full venue picker drawer

### C. Hamburger menu (far right)
1. Click the hamburger
2. Click each item that's enabled (Alerts, Billing, Connections, Settings, Profile, etc.) — one at a time, then come back to /dashboard between each

### D. Market detail (this should now be fast — we shipped a targeted query)
1. From `/dashboard`, click the first row in "Biggest Volume" → market detail page
2. Click ← back
3. Click a second market row
4. Click ← back

### E. The OToole chat panel (left side)
1. Type "show me crypto markets" into the prompt box and hit Enter
2. Wait for O'Toole's reply + observe whether it auto-navigates the page
3. Type "find me Polymarket trades in the 10 to 35 cent range"
4. If a confirm card appears above the chat, note how long it took from "Send" to card appearing

### F. Connections page
1. Go to `/dashboard/connections`
2. Click "CONNECT ↗" on the NoVig card → should open https://novig.onelink.me/... in a new tab
3. The card should flip green immediately (the original card on the original tab)
4. Note any lag between click and tab opening / card flipping

## Report format (markdown)

```markdown
## Summary
One paragraph on overall feel. "Most clicks land in 200-400ms but X, Y, Z take >2s."

## Worst offenders (ranked)
1. **<route>** — t_to_skeleton: Xms · t_to_content: Yms · <one-sentence why it feels bad>
2. ...
3. ...

## Snappy routes (mention if anything is fast — confirms the loading.tsx work landed)
- /dashboard/markets/<...>/<...> — skeleton in <Xms, content in Yms

## Surprises
- Anything weird: clicks that do nothing, double-renders, layout shift, etc.

## Specific failures
- Any 500s, network errors, console errors. Paste the exact text.
```

## Anti-fluff guardrails

- No "the site feels modern" / "the UI is clean" stuff. The user already knows what they built.
- Numbers > adjectives. "Click → render: 2,340ms" beats "very slow."
- If a click does nothing for >5s, screenshot the browser + report the URL + console errors.
- If a route DOES have a loading skeleton/splash, say so — that route's perceived perf is good even if data is slow.

Aim for under 600 words in the report. Stop and ask if the credentials don't work.
