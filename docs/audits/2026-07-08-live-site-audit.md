# Sneakers Terminal — Full Live-Site Audit (2026-07-08)

> Produced by a browser-automation agent against production, desktop viewport
> (~1250px) only; mobile unverified this session. Input for the front-end/
> dashboard redesign to the agent design language.

## Executive summary
- Three unreconciled public visual languages (dark hero on / and /venues; light SaaS on /pricing and /login; agent dark phone-card) + a fourth dense dark terminal dialect in /dashboard.
- CRITICAL: /dashboard/markets never loads — stuck at step 1 of its 5-step connect animation across 3 visits (45s+), zero console errors. Flagship route down.
- HIGH: "AUTOTRADE ON" chip on dashboard home/rail contradicts /dashboard/settings/autotrade copy ("autotrade is on the roadmap; manual only").
- HIGH: /agent shows funded mock ($1,247.62, Sneakers Pro trial) to a real Free/$0.00 account with no explanation of the relationship.
- MEDIUM: /dashboard/alerts counter "1 of 0 rules used FREE" + New Rule disabled. MEDIUM: /dashboard/minute claims auto-refresh 15s while showing last update 450s ago.
- LOW: /login renders pre-filled while already authenticated (vs /join which redirects); homepage caption contrast; OPEN APP → vs Open App → case mismatch.
- No "scrape/scraper" anywhere user-facing. Tailwind responsive-prefix density ~0.3–1% on dashboard screens (not built mobile-first).

## KEEP / RESTYLE / RETHINK calls (per auditing agent)
- KEEP structurally: /agent (the reference design), /dashboard/strategies, /dashboard/profile, /dashboard/perps/hyperliquid, /dashboard/settings/otoole, /dashboard/settings/api-keys.
- RESTYLE: / (fix caption+case), /venues, /login (plus auth-redirect fix), /dashboard/minute (plus refresh bug), /dashboard/alerts (plus quota bug), /dashboard/connections, /dashboard/billing (consider shared pricing component).
- RETHINK: /pricing (re-skin), /dashboard home (port agent visual system, preserve all data), /dashboard/settings/autotrade (naming/state contradiction).
- UNEVALUATABLE until fixed: /dashboard/markets.

## Dashboard functional contract (must survive the redesign)
Account/session: email, avatar, plan, student verification, university, referrals, sign-out.
Money: total balance, Polymarket on-chain wallet (read-only), today P/L, master trading switch.
Autotrade/co-pilot: bot status, ON/OFF, daily cap $200, per-trade cap $50, wallet key (AES-256-GCM), funder address, O'Toole model picker w/ credit costs, BYO API keys, memory notes.
Markets: cross-venue browser (broken), minute strike ladders (window 5m–4h, asset chips, resolve countdown, platform/strike/direction/yes/Δ5m/volume), perps top-10 (15-min delayed, upgrade gate).
Strategies/alerts: conditions, enable toggles, last-fired, clonable templates, rules w/ trigger/filter/channels, quota counter.
Connections: 44 venues, 4 categories, per-venue status + connect/open.
Billing: current plan + tier grid (dupe of /pricing).
Only-in-dashboard (preserve): market browsing, minute ladders, strategies/alerts, connections, autotrade/wallet settings, O'Toole config, API keys, billing, perps. Already-in-/agent (don't reinvent): balance display, activity feed, model subscribe/equip.

## Bug list (ranked)
1. CRITICAL /dashboard/markets infinite load (stalled data-fetch suspected; no console errors).
2. HIGH autotrade ON/roadmap contradiction (home + rail vs settings copy).
3. HIGH /agent mock-vs-real account mismatch unexplained (incl. Profile "Sneakers Pro trial" copy).
4. MEDIUM alerts quota "1 of 0 used" + disabled New Rule.
5. MEDIUM minute markets not refreshing on stated 15s cadence (450s stale).
6. LOW homepage caption contrast. 7. LOW /login reachable+pre-filled while authed. 8. COSMETIC nav case mismatch.

## Open questions raised
Mobile pass pending (viewport tool limitation); /dashboard/markets known?; intended /agent↔real-account relationship; /login redirect intent; include Coming-Soon nav routes (Signals, Portfolio, Calendar, Heatmap, Scanner, Order book, Positions, History) in the redesign IA?
