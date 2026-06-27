# Sneakers Agent — `/agent` Route (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the real, user-facing Sneakers Agent dashboard as a `/agent` route in `apps/platform`, reading live bot state (windows, trades, P&L, config) from Railway Postgres — turning the static prototype into a working page backed by the Plan 2 worker.

**Architecture:** A Next.js 16 App Router route. A **server-only data layer** reads the `short_*` tables from Railway Postgres (the same "Path A" connection `apps/platform` already uses for markets). The route renders the returns header, P&L graph, recent-trades list, venue desk + live markets, and an editable rules form. The **visual design is ported verbatim from `docs/prototypes/sneakers-agent.html`** (red/white/blue, venue desk, scrubbable chart). Bot config writes go through a Next API route to `short_bot_configs`.

**Tech Stack:** Next.js 16 (App Router, React Server Components), TypeScript, `pg` (Railway), Supabase magic-link auth (existing), the `@sneakers/core` types where useful.

## Global Constraints

- **This is Next.js 16 with breaking changes.** Before writing any route/server code, read the relevant guide in `node_modules/next/dist/docs/` (per `apps/platform/AGENTS.md`). Follow existing patterns in `apps/platform/src/app` (e.g. the `dashboard/` and `markets/` routes) — do not invent new conventions.
- **Data source = Railway Postgres** (Path A). Reuse the existing Postgres pool/helper in `apps/platform/src/lib/` (the same one `markets-data.ts` uses) — do NOT open a second pool or add a new DB client. Supabase remains auth + user data only; no cross-DB joins.
- **Read-mostly.** The page reads the `short_*` tables (written by the Plan 2 worker). The only write is the user editing their own bot config (`short_bot_configs`), via an API route, scoped to the authenticated user.
- **Auth:** reuse the existing Supabase magic-link gate used by `/dashboard`. `/agent` requires a signed-in user; the bot config is keyed to `user_id`.
- **No real trading.** The page shows dry-run state only; the speed control and venue-desk animation are presentation (driven by recent real trades, falling back to the prototype's demo motion when idle).
- Tests: data-layer mappers are unit-tested with `node:test` (gated DB integration where needed); the route itself is validated with the `run`/`verify` skill (load it, see real data). No vitest/jest.
- Copy rule: never surface internal infra vocab ("scrape"/"scraper") in UI — use "live prices / live data / update".

## File Structure

- `apps/platform/src/lib/agent/queries.ts` (+ `.test.ts`) — server-only reads: P&L summary, cumulative P&L series, recent trades, live windows, bot config.
- `apps/platform/src/lib/agent/config.ts` — read-or-create + update `short_bot_configs` for a user.
- `apps/platform/src/app/api/agent/config/route.ts` — POST handler to update the signed-in user's bot config.
- `apps/platform/src/app/agent/page.tsx` — the route (server component) — auth gate + data fetch + composition.
- `apps/platform/src/app/agent/returns-chart.tsx` — client: headline number + scrubbable P&L chart (ported from prototype).
- `apps/platform/src/app/agent/venue-desk.tsx` — client: venue logos + trade-flash motion.
- `apps/platform/src/app/agent/actions-list.tsx` — server: recent trades table.
- `apps/platform/src/app/agent/rules-bar.tsx` — client: risk preset / sim deposit / loss cap editor → API route.
- `apps/platform/src/app/agent/agent.module.css` (or Tailwind, matching the app's convention).

---

### Task 1: Agent read queries (server-only data layer)

**Files:**
- Create: `apps/platform/src/lib/agent/queries.ts`
- Test: `apps/platform/src/lib/agent/queries.test.ts` (mapper unit tests always run; DB integration gated on `TEST_DATABASE_URL`)

**Interfaces:**
- Consumes: the existing Railway `pg` pool helper from `apps/platform/src/lib/` (find the export `markets-data.ts` uses; reuse it).
- Produces (all reading the `short_*` tables for a given `botConfigId`):
  - `interface PnlSummary { todayUsdc: number; allTimeUsdc: number; tradeCountToday: number }`
  - `interface PnlPoint { atMs: number; cumUsdc: number }`
  - `interface TradeRow { id: number; venue: string; asset: string; intervalSec: number; side: 'YES'|'NO'; sizeUsdc: number; entryPrice: number; settlePrice: number|null; pnlUsdc: number|null; status: 'open'|'won'|'lost'; createdAtMs: number }`
  - `interface LiveWindowRow { id: number; venue: string; asset: string; intervalSec: number; closesAtMs: number; yesPrice: number|null; heldSide: 'YES'|'NO'|null }`
  - `getPnlSummary(botConfigId): Promise<PnlSummary>`
  - `getPnlSeries(botConfigId, sinceMs): Promise<PnlPoint[]>` — cumulative settled P&L ordered by settle time.
  - `getRecentTrades(botConfigId, limit): Promise<TradeRow[]>`
  - `getLiveWindows(venues: string[]): Promise<LiveWindowRow[]>` — `status='live'`, joined to this bot's open trade (if any) for `heldSide`.
  - A pure exported helper `rowToTrade(dbRow): TradeRow` (epoch mapping) so the mapping is unit-testable without a DB.

- [ ] **Step 1: Failing unit test for `rowToTrade`** (pure, always runs): feed a fake DB row (TIMESTAMPTZ as JS Date + numeric strings as `pg` returns them) and assert the mapped `TradeRow` types/values (e.g. `createdAtMs` is a number, `pnlUsdc` parsed to number, `status` passthrough).
- [ ] **Step 2: Run (fail) → implement `queries.ts`.** Each query is one parameterized SQL statement against the reused pool; map rows via `rowToTrade` and small inline mappers. `getPnlSeries` runs a window-function cumulative sum of `pnl_usdc` over settled trades. Add a gated integration test (`TEST_DATABASE_URL`) that inserts a window+trade and asserts `getRecentTrades` returns it.
- [ ] **Step 3: Run (pass) → Commit** `feat(agent-route): server-only read queries for P&L/trades/windows`.

---

### Task 2: Bot config read-or-create + update

**Files:**
- Create: `apps/platform/src/lib/agent/config.ts`
- Create: `apps/platform/src/app/api/agent/config/route.ts`
- Test: `apps/platform/src/lib/agent/config.test.ts` (validation pure-tests always run)

**Interfaces:**
- Produces:
  - `interface BotConfig { id: number; riskPreset: 'bunker'|'cautious'|'balanced'|'aggressive'|'max'; simDepositUsdc: number; simLiquidityUsdc: number; lossCapUsdc: number; enabledVenues: string[]; paused: boolean; mode: 'dry_run'|'live' }`
  - `getOrCreateBotConfig(userId: string): Promise<BotConfig>` — returns the user's config, creating a default (`balanced`, `$2000`/`$500`, dry-run) on first call.
  - `updateBotConfig(userId: string, patch: Partial<Pick<BotConfig,'riskPreset'|'simDepositUsdc'|'simLiquidityUsdc'|'lossCapUsdc'|'enabledVenues'|'paused'>>): Promise<BotConfig>`
  - `validateConfigPatch(patch): { ok: true; value } | { ok: false; error: string }` (pure: risk preset is one of 5; dollars ≥ 0; venues ⊆ {polymarket,kalshi}).
  - `POST /api/agent/config` — authenticates via Supabase (same helper `/dashboard` uses), validates, calls `updateBotConfig`, returns the updated config as JSON. Rejects unauthenticated with 401.

- [ ] **Step 1: Failing test for `validateConfigPatch`** — rejects bad preset, negative dollars, unknown venue; accepts a valid patch.
- [ ] **Step 2: Run (fail) → implement** `config.ts` (queries `short_bot_configs` by `user_id`; default-insert; whitelisted updates) and the API route (auth → validate → update → JSON; 400 on invalid, 401 on no session).
- [ ] **Step 3: Commit** `feat(agent-route): bot-config read/create/update + API route`.

---

### Task 3: The `/agent` route shell (server component) + auth gate

**Files:**
- Create: `apps/platform/src/app/agent/page.tsx`

**Interfaces:**
- Consumes: the Supabase auth helper (redirect to `/login` when unauthenticated — copy the pattern from `dashboard/`), `getOrCreateBotConfig` (Task 2), and the Task 1 queries.
- Produces: a server component that gates on auth, loads `BotConfig` + `PnlSummary` + `PnlSeries` + `RecentTrades` + `LiveWindows`, and composes the child components (Tasks 4–7). Page-level layout/spacing matches the prototype (max-width ~900px, the top patriotic hairline, white background).

- [ ] **Step 1:** Read the Next 16 routing/data-fetching guide in `node_modules/next/dist/docs/`. Implement `page.tsx`: auth gate, parallel data fetch, render a static composition (children can be stubs that render their props). Verify the route loads for a signed-in user and 302s to login otherwise.
- [ ] **Step 2: Commit** `feat(agent-route): /agent server route with auth gate + data load`.

---

### Task 4: Returns header + P&L chart (client)

**Files:**
- Create: `apps/platform/src/app/agent/returns-chart.tsx`

**Interfaces:**
- Consumes: `{ summary: PnlSummary; series: PnlPoint[] }`.
- Produces: a client component rendering the headline returns number (today/all-time toggle) + the cumulative P&L line chart with the prototype's scrubber interaction. Port the SVG path + scrubber JS from `docs/prototypes/sneakers-agent.html` into React state. Blue line, gain/loss coloring per sign.

- [ ] **Step 1:** Implement the component (translate the prototype's chart/scrubber into React; range toggle over the series; empty-state when no settled trades yet — "No settled trades yet. Your bot is warming up."). 
- [ ] **Step 2:** Verify with the `run` skill: header number + chart render from real `series`. **Commit** `feat(agent-route): returns header + P&L chart`.

---

### Task 5: Actions list (recent trades, server)

**Files:**
- Create: `apps/platform/src/app/agent/actions-list.tsx`

**Interfaces:**
- Consumes: `{ trades: TradeRow[] }`.
- Produces: a server component rendering the prototype's "Actions performed" rows — `time · ASSET intervalSec · SIDE entry → WON/LOST ±$pnl`, colored green/red; open trades show "live". Empty state: "No trades yet."

- [ ] **Step 1:** Implement + style to match the prototype. **Step 2:** Verify renders from real trades; **Commit** `feat(agent-route): actions/trades list`.

---

### Task 6: Venue desk + live markets (client)

**Files:**
- Create: `apps/platform/src/app/agent/venue-desk.tsx`

**Interfaces:**
- Consumes: `{ liveWindows: LiveWindowRow[]; recentTrades: TradeRow[] }`.
- Produces: a client component with the venue logo desk (real logos from `public/SneakersLogos/partners/`) + the live markets list (countdowns from `closesAtMs`, YES/NO prices, held-side highlight). The desk flashes a venue green/red when a recent real trade on it settles; when idle, falls back to the prototype's ambient demo motion. Reuse the prototype's stacking-float effect for trade pulses.

- [ ] **Step 1:** Implement (port the desk + countdown + flash logic into React; drive flashes from `recentTrades` deltas, poll for fresh data on an interval). **Step 2:** Verify; **Commit** `feat(agent-route): venue desk + live markets`.

---

### Task 7: Rules bar editor (client) → API

**Files:**
- Create: `apps/platform/src/app/agent/rules-bar.tsx`

**Interfaces:**
- Consumes: `{ config: BotConfig }`.
- Produces: a client component showing risk preset (5-rung selector), loss cap, sim deposit/liquidity, enabled sources, dry-run badge, and an Edit/Save flow that POSTs to `/api/agent/config` (Task 2) and reflects the saved result. Includes the prominent Kill (pause) toggle that sets `paused`.

- [ ] **Step 1:** Implement the editor (optimistic UI; on save call the API, show the returned config; error toast on 400). **Step 2:** Verify a preset/loss-cap change persists (round-trip through the API and DB). **Commit** `feat(agent-route): rules editor wired to config API`.

---

### Task 8: End-to-end verification + nav entry

**Files:**
- Modify: the app nav/topbar to add an "Agent" link (follow the existing nav pattern in `dashboard/topbar-v2.tsx` or the platform nav).

- [ ] **Step 1:** Add the `/agent` nav link.
- [ ] **Step 2: Full-story verification** with the `run`/`verify` skill against Railway Postgres seeded by the Plan 2 worker (or hand-seeded rows): sign in → `/agent` shows real returns, chart, trades, live windows; edit a rule → persists; reload reflects it. Capture a screenshot.
- [ ] **Step 3: Commit** `feat(agent-route): nav entry + verified end-to-end`.

---

## Self-Review

**Spec coverage (Plan 3 = the user-facing `/agent` route):**
- Returns header + P&L graph → Task 4 ✅
- Actions/trades list → Task 5 ✅
- Venue desk + live markets → Task 6 ✅
- Rules editor (risk preset / loss cap / sim deposit / pause) → Tasks 2 + 7 ✅
- Server data layer over Railway Postgres `short_*` tables → Task 1 ✅
- Auth gating + per-user bot config → Tasks 2, 3 ✅
- Visual fidelity to the prototype → Tasks 4–7 (ported from `docs/prototypes/sneakers-agent.html`) ✅
- **Out of scope (later):** real-money / live execution + credential connect (Rung 2), iOS remote, OAuth venue connect. The connect-keys modal from the prototype is presentation-only here.

**Placeholder note:** frontend tasks specify component prop contracts + the prototype as the visual source of truth rather than full TSX bodies, because (a) `apps/platform` is Next 16 with breaking changes that must be read from `node_modules/next/dist/docs/` at implementation time, and (b) the exact styling is a verbatim port of an existing committed file. The data layer (Tasks 1–2) carries concrete query/validation contracts and is unit-tested.

**Type consistency:** `PnlSummary`/`PnlPoint`/`TradeRow`/`LiveWindowRow` defined in Task 1 and consumed by Tasks 4–6; `BotConfig` defined in Task 2 and consumed by Tasks 3, 7. The `short_*` column names match Plan 2's migration `004`. Risk-preset values match the 5 presets in `@sneakers/core`.

**Dependency:** Plan 3 reads the tables written by Plan 2's worker. It can be built against hand-seeded rows before the worker is live, but real data requires Plan 2 running.
