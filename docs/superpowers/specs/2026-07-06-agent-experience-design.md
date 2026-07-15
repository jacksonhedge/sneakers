# Sneakers Agent Experience — Design Spec

**Date:** 2026-07-06
**Status:** Approved (prototype iterated with Jackson; visual source of truth below)
**Prototype:** `docs/prototypes/sneakers-app-prototype.html` (interactive, open in any browser)
**Targets:** Web (`apps/platform`, ships first) and iOS (`apps/ios`, SwiftUI port)

## Vision

The bot is the product. One agent-first experience — identical design on web and iOS —
replaces the multi-tab terminal UX for consumer users. Users watch a living "orb" trade
for them, subscribe to better models, fund a wallet, and manage connections. Everything
runs through one shared API so the web app and iOS app are two skins over the same body.

v1 is **paper-live** (Rung 1): real prices from Kalshi + Polymarket, simulated balance,
real Stripe rails in test mode. No real money until custody/KYC/counsel are resolved.

## The four tabs

### 1. Agent — cover-flow of model orbs
- iOS-6-album-style carousel of "model orbs." Each model is a colored, living sphere
  (two counter-rotating plasma layers + breathing animation when equipped + emoji or
  partner logo identity).
- One model **equipped** at a time. Center orb = selected; button reads
  `Equipped ✓` / `Equip` / `Subscribe · <price>`. Equipping is instant; the next
  trading window uses the new model.
- Status line under the orb: live agent state (`scanning | entering | holding | paused`)
  with human explanation ("Scanning 14 markets — BTC · ETH · SOL, 5 & 15-min windows").
- Balance + Today P&L cells; Pause/Resume.
- **Activity feed**: every decision with the venue logo (Kalshi/Polymarket/ProphetX),
  a status badge (✓ settled, → entered, · passed), and the *why* (signal or gate name).
- PAPER badge always visible in paper mode.

### 2. Models — My Model | Trading Agents
- Segmented control, **Trading Agents is the default**.
- **Trading Agents**: 2-col grid of model orbs. Each card: orb, name, author,
  perf line (30d paper) or tagline, price pill, and a **+ button** (top-right) for
  one-tap subscribe (flips to ✓). Tap card → detail sheet (stats, description,
  Subscribe/Equip). Featured partner card (OddsJam) gets a standout treatment:
  logo-on-orb, blue glow card, tagline "The best sports/predictions agent",
  price "From $1 per day", no metrics.
- **My Model**: user's own model (name + 30d perf), an editable **strategy prompt**
  (natural language, re-read by the worker each window), preset chips
  (default: Longshot 10–35¢), Run this model / Backtest buttons.
- Model catalog v1: Up/Down 🎢 (flagship, included with plan, equipped by default,
  trades all BTC/crypto up-down markets), OddsJam (featured partner, subscribable),
  Wave Rider 🏄, Overnight Drift 🦉, Cent Sniper 🎯 (paid), News Reactor 🗞️ (in review),
  Longshot v3 🐎 (user's own).

### 2b. Add Agent (creator flow)

- Entry points: a dashed **"Add Agent"** card at the end of the Trading Agents grid,
  and an **＋ Add Agent** button in My Model.
- Bottom sheet with two paths (segmented control):
  - **Build with prompt** — name, emoji picker, color picker, strategy prompt.
    Runs on the Sneakers worker like My Model; zero user infra.
  - **Connect your bot** — name/emoji/color plus endpoint URL + API key.
    Contract: we POST market signals to the endpoint; the bot returns orders.
    Connected bots trade the user's paper balance only.
- Created agents become orbs in the owner's carousel immediately (equippable,
  private). A **Submit to marketplace** action (detail sheet) moves them to
  `review` status — the same state News Reactor models; approved agents become
  subscribable and the creator gets Stripe Connect payouts (post-v1 for payouts).
- Safety: connected bots are rate-limited, sandboxed to paper balances until
  approved, keys stored encrypted, and every order passes the same core gates
  (ceilings, breaker) as first-party models.

### 3. Balance (Funds)
- Tab bar item shows the **live balance number** ("$1,248" over the label "Balance").
- Wallet hero + 7-day sparkline (hover/touch tooltip), Add cash / Withdraw.
- Add cash = Stripe Payment Element, **test mode**, feeding the paper ledger.
  The UI does not change when live keys land later.
- History: trade settlements (grouped), deposits, starting balance.

### 4. Profile
- Account card (avatar, name, email, edit), **Your plan** (Sneakers Pro via Stripe
  Billing), **Trading venues** (Kalshi ✓ connected, Polymarket ✓ connected,
  ProphetX = soon), **Data & bots** (OddsJam data plan = soon, pointer to Trading
  Agents), Sign out.

## Design system (from prototype)

- Surface `#0B0D10`, card `#14181D`, border `#1e242a`, ink `#F2F5F3`,
  secondary `#98A2A8`, green `#2FD37A`, red `#FF5C5C` (negative only),
  OddsJam blue `#18AFE8`. SF Pro / `-apple-system`; tabular numerals for money.
- Orb = layered: halo (blurred radial), blob (radial gradient from per-model
  CSS vars), swirl (two counter-rotating blurred plasma layers), emoji/logo, sheen.
  Breathing keyframe when live; grayscale-frozen when paused. All motion respects
  `prefers-reduced-motion`.
- Never surface "scrape/scraper" in user copy — "live prices", "live data".

## Architecture (contract-first)

```
apps/platform (Next.js)        apps/agent-worker (Railway)      apps/ios (SwiftUI)
  /agent route group  ──────►    loop.ts paper-live runner        4-tab port (M2)
  /api/agent/* etc.   ◄──────    writes state to Postgres
  (single shared API)            reads config each window
```

- **Web ships first** inside `apps/platform` as an `/agent` route group — same
  Supabase auth/session as the rest of the platform. "Combining functionality into
  one" = the agent experience lives in the main web app, not a separate deploy.
- iOS consumes the identical API later; zero server changes for the iOS port.
- Worker: `apps/agent-worker` (already has loop/feeds/dryrun) runs continuously on
  Railway, persists every decision + state transition.

## API contract

```
GET  /api/agent/state        orb state, equipped model, sim balance, today P&L, last decision
GET  /api/agent/activity     paginated decision feed (venue, action, why, amount, ts)
GET  /api/agent/models       catalog + user's subscription/equip status
POST /api/agent/models/:id/subscribe    (Stripe subscription, test mode)
POST /api/agent/models/:id/equip
POST /api/agent/models       create user agent {kind: prompt|connected, name, emoji, color, prompt?|endpoint+key?}
POST /api/agent/models/:id/submit       submit own agent for marketplace review
GET  /api/agent/config       my-model prompt, preset, risk band
PUT  /api/agent/config       update prompt/preset (worker re-reads next window)
POST /api/agent/pause | resume
GET  /api/wallet             balance, pending, ledger
POST /api/wallet/deposit     Stripe PaymentIntent (test mode)
POST /api/wallet/withdraw    test-mode stub
GET  /api/connections        venue/data connections + status
GET  /api/plans              subscribed plans (Sneakers tier, OddsJam future)
```

Auth: Supabase JWT (cookie session on web, Authorization header on iOS).
All rows user-scoped. Web polls `/api/agent/state` every 5s while visible.

## Data model (new tables, Supabase = user data)

- `agent_models` — catalog: id, name, emoji/logo, color, author, price_cents,
  billing_period, tagline, description, status (live|review|coming_soon|private),
  featured, included, owner_user_id (null = first-party), kind (prompt|connected),
  endpoint_url, api_key_encrypted (connected only)
- `user_agent_state` — user_id, equipped_model_id, paused, sim_balance_cents
- `agent_model_subs` — user_id, model_id, stripe_subscription_id, status
- `agent_configs` — user_id, prompt, preset, risk band (worker reads)
- `agent_decisions` — user_id, model_id, venue, market, action (entered|settled|passed),
  qty, price_cents, pnl_cents, reason, created_at  ← feed + P&L derive from this
- `wallet_ledger` — user_id, kind (deposit|withdraw|settlement), amount_cents,
  stripe_ref, created_at

Market prices continue to come from the Railway Postgres pipeline (two-DB split holds;
no cross-joins — worker joins in memory).

## Phases

1. **Web shell** — `/agent` route group in `apps/platform`: port the prototype to
   React/Tailwind components (Orb, CoverFlow, ModelGrid, DetailSheet, Feed, Sparkline),
   mock data module, all four tabs interactive. Mobile-web = full-bleed app frame;
   desktop = centered column (~430px) like the prototype.
2. **Contract** — implement the API routes against fixtures; migrations for the tables;
   swap the UI from mock module to live endpoints (one env flag).
3. **Worker paper-live** — agent-worker writes decisions/state per window using the
   equipped model's preset + prompt; state endpoint goes real; feed goes real.
4. **Stripe test rails** — deposit flow (Payment Element), model subscriptions
   (Products/Prices in test mode), plan card on Profile.
5. **iOS port** — SwiftUI 4-tab app against the same API (existing `apps/ios`
   scaffolding: auth, biometry survive; tabs rebuilt to match prototype).

## Error handling & testing

- Worker unreachable / stale state (> 2 windows old): orb shows "Reconnecting…"
  amber state; feed stays readable (last known data, timestamped).
- Every external call (Stripe, venues) logs entry + success, not just errors.
- Vitest: state reducers, P&L derivation from `agent_decisions`, config validation.
  Playwright: tab flows, subscribe→equip loop, add-cash test-mode flow.
- Paper-mode guardrail: `PAPER` badge is driven by server flag, not client constant.

## Phase 1 status + Phase 2 carry-ins (updated 2026-07-07)

Phase 1 (web shell) is BUILT, reviewed, and live at sneakersterminal.com/agent
(commits `d704cf1..fbda033` on `feat/sneakers-agent`; implementation at
`apps/platform/src/app/agent/`; runs on the mock reducer in `lib/engine.ts`;
local QA via `AGENT_PREVIEW=1 pnpm platform`).

Carry-ins the final review flagged for Phase 2 — do not lose these:

- **Editable My Model prompt** — spec requires it; Phase 1 renders it static.
  Wire to `GET/PUT /api/agent/config`.
- **`todayPnlCents` must become date-filtered** once decisions are live data
  (it currently sums all seed decisions); add to contract tests.
- **Server-side id validation** for subscribe/equip (client reducer accepts
  unknown ids into `subscribedIds`).
- **Subscribe asymmetry**: carousel equip is one-tap subscribe+equip; the sheet
  is two-step. Real Stripe billing forces both through a payment step — resolve
  in the contract design.
- **Accessibility batch**: carousel keyboard access (side orbs unreachable by
  keyboard), sheet Esc/focus-trap/aria-modal/scroll-lock, grid + button
  keyboard path.
- **CSS prefixing**: `agent.css` classes (`.sheet`, `.conn`, `.orb`, `.mcell`,
  `.cf`) are globally scoped; prefix `.ag-*` on next touch.
- **Replace the hardcoded profile identity** (name/email in `profile/page.tsx`)
  with real account data; page can become a server component.
- **My-Agents list in the Models tab** — user-created agents currently appear
  only in the Agent carousel (spec-consistent for Phase 1).
- **Negative-money formatting**: `formatMoney`/`formatMoneyWhole` don't handle
  negatives — becomes real when withdrawals ship (route through `formatSigned`).
- **`formatPerf` uses ASCII `-`** while `formatSigned` uses U+2212 — unify when
  a negative-perf model can exist.

## Phase 2 scope decision (2026-07-07)

Confirmed with Jackson: Phase 2 proceeds as specced above (real API routes,
migrations, live subscribe/equip, Stripe test-mode subscriptions for
flagship + partner models) but explicitly **excludes community creator
payouts**. The `POST /api/agent/models` (create) and `/submit` (submit for
review) endpoints are still in scope — a user can build a prompt-based or
connected-bot agent and submit it for review — but Stripe Connect payout
wiring for approved community creators stays parked post-v1, same as
already noted below. No architecture changes from this decision; it only
resolves which parts of the existing contract Phase 2 actually implements.

## Open questions (parked, not blockers)

- OddsJam: partnership terms (rev-share vs reselling their API) — affects nothing
  in phases 1–3.
- Model marketplace creator onboarding (Stripe Connect payouts) — post-v1.
- Voice interaction on the orb — post-v1.

## Phase 2 status (updated 2026-07-15)

Phase 2 (contract) is BUILT on `feat/sneakers-agent`: migration 048, `/api/agent/*`
+ `/api/wallet*` routes, live store behind `AGENT_API_LIVE=1`. Stripe rails are
presence-gated (paper fallback while keys are empty). Carry-ins resolved: editable
My Model prompt, date-filtered today P&L, server-side subscribe/equip validation,
subscribe asymmetry (paid → sheet → Checkout), My-Agents list, negative-money
formatting. Still parked for the follow-up UI batch: accessibility (carousel
keyboard, sheet focus-trap), remaining CSS prefixing. GET /api/connections and
GET /api/plans deferred to the iOS-port phase (web Profile reads these server-side
already).
