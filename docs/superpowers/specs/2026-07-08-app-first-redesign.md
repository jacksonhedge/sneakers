# App-First Redesign — sneakersterminal.com front-end & dashboard

**Date:** 2026-07-08 · **Status:** Approved (architecture confirmed with Jackson)
**Foundation:** `docs/audits/2026-07-08-live-site-audit.md` (functional contract + bug list)
**Parent:** `docs/superpowers/specs/2026-07-06-agent-experience-design.md` (agent design language)

## Decision record

- **Architecture: app-first absorption, phased.** `/agent` becomes THE product;
  the dashboard's jobs migrate into it; `/dashboard/*` retires via 301s at the end.
- **Bug triage: P0/P1 fixed immediately (Phase 0)**; remaining audit bugs die
  inside the phase that rebuilds their screen.
- **Desktop: adaptive shell.** <~900px = today's phone app (bottom tab bar);
  ≥900px = left icon rail + wide content pane. Same view components, two chromes,
  CSS-grid off the `agent.css` tokens. The landing phone-frame demo always uses
  the phone chrome.
- **IA: five tabs — Agent · Markets · Models · Balance · Profile.**
  - Markets tab: minute strike ladders, cross-venue browser, perps reference.
  - Models tab: My Model | Trading Agents | NEW Automations section
    (strategies + alerts; kills the "1 of 0 rules" quota bug).
  - Profile tab: account/plan/verification/referrals, connections (44 venues),
    master trading switch, autotrade caps + wallet config, O'Toole config,
    BYO API keys, billing (shared pricing component, not a duplicate page).
  - Dashboard home dies distributed. Coming-soon nav routes (Signals, Portfolio,
    Calendar, Heatmap, Scanner, Order book, Positions, History) are OUT of IA
    until they ship.
- **Data honesty:** migrated surfaces (markets/connections/billing/strategies)
  hit the SAME real APIs the dashboard uses today — real data from day one.
  The agent orb/balance remain mock until the separate Phase-2 agent-API track;
  demo-driven numbers are labeled ("Demo balance", PAPER badge stays) so a
  Free/$0 user is never misled (audit bug #3).
- **Public pages** (/, /pricing, /venues, /login) re-skin to agent tokens in the
  final phase; content/IA unchanged. Button system unification per
  `docs/prompts/design-polish-and-partner-marketplace.md` Part A.

## Phases (each ships independently; spec→plan→subagent build→review→user promote)

- **Phase 0 — prod triage (no redesign):**
  1. `/dashboard/markets` infinite load — root-cause and fix (flagship route DOWN;
     audit: stuck at connect-animation step 1, no console errors → suspected
     stalled/hanging data fetch. Prior context: route was flagged "last heavy
     menu route, refactor pending"; known 24h-freshness LATERAL + work_mem
     pressure history on the markets query path).
  2. AUTOTRADE ON contradiction — chip/panel must reflect reality (manual-only
     today): rename state chip (e.g. MANUAL MODE), align copy with
     /dashboard/settings/autotrade.
  3. Landing caption contrast (scrim) + nav case unification (OPEN APP → vs
     Open App → — pick the button-system answer, apply now).
- **Phase 1 — adaptive shell + Markets v1:** icon-rail chrome at ≥900px; 5th tab
  ships minute ladders against the existing minute-markets API (fix its
  15s-refresh staleness here). Dashboard untouched.
- **Phase 2 — absorption:** Markets completes (cross-venue browser + perps);
  Models gains Automations; Profile absorbs connections/settings/billing/
  O'Toole/API keys (fix /login authed-redirect alongside).
- **Phase 3 — retirement:** /dashboard/* 301 → app equivalents once each
  replacement is prod-verified; navbar DASHBOARD → app; public re-skin.

## Acceptance rule

Every migrated screen must reproduce its dashboard ancestor's data-and-actions
inventory as recorded in the audit doc (that document is the checklist).
Screenshots at 430px and 1280px in both chromes; tests/tsc/build gates; no
route removed until its replacement is verified in production.

## Out of scope here

- Agent-core mock→real (own track: parent spec Phase 2 API).
- Partner marketplace (own prompt/spec).
- iOS port (inherits the same five-tab IA later).
