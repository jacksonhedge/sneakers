# Sneakers Agent — Live Execution (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the bot place **real, non-custodial orders** on Polymarket for short-interval BTC up/down markets — gated behind a legal consent gate, a non-skippable dry-run proof period, hard caps, and four kill-switch layers — so a user can fund their own venue account and turn the bot on for real.

**Architecture:** Live execution is **the same Plan 2 evaluation loop, with the Execution Gate routing a `trade` decision to a real `OrderRouter` instead of simulating.** Every other safety property (caps, presets, kill switches) is reused from the agent core. The user is the principal; Sneakers never custodies funds — it authenticates the user's own scoped Polymarket CLOB credentials. This plan is grounded in `docs/HANDOFF_AUTOTRADE.md` (the autotrade safety blueprint) and the Rung-2 section of `docs/superpowers/specs/2026-06-25-sneakers-crypto-bot-terminal-design.md`.

**Tech Stack:** TypeScript, `@polymarket/clob-client` + `ethers` (order signing), `pg` (Railway), `node:test` via `tsx`, AES-256-GCM for credential encryption, `@sneakers/core`.

## ⚠️ DEPENDENCIES & GATES (read first)
- **Depends on Plan 2** (the worker: evaluation loop + Polymarket adapter + repo). Live execution wires into the worker's Execution Gate. Plan 2's loop/adapters must exist first.
- **Depends on Plan 3** (the `/agent` route) for the Go-Live UI (Task 8).
- **HARD GATE — legal/TOS (Task 1) must clear before ANY order-placement code ships.** Sneakers is not a registered investment advisor; the user retains full responsibility; non-custodial. Do not implement Tasks 4/6 (the router + live path) until Task 1's consent gate is in place and the user has signed off with counsel.
- **HARD GATE — dry-run proof period.** No bot can go live until it has paper-traded a minimum period AND a minimum number of settled dry-run trades. This is non-skippable in v1.

## Global Constraints
- Node `>=20`, pnpm `>=9`. Tests: `node:test` via `node --import tsx --test`. No vitest/jest.
- **Polymarket only, market orders only, v1.** No limit orders, no Kalshi live (Kalshi 15-min crypto is illiquid anyway). The schema carries `venue` for later.
- **Non-custodial.** Sneakers stores only the user's *encrypted, scoped* Polymarket CLOB API credentials (key + secret + passphrase) — never private keys/seed phrases, never funds. Credentials decrypt only inside the worker process, never logged, never returned to the client.
- **Hard ceilings (absolute — config/admin cannot exceed without a code change):** per-trade ≤ **$50** (Rung-2 v1; conservative), per-day ≤ **$200**, min cooldown 5 min between live fires per bot, ≤ 20 concurrent open positions. (Lower than the autotrade brief's $5k ceilings — this is the first-money build; raise later with review.)
- **Dry-run proof gate:** live unlocks only after **≥7 days** since bot creation **AND ≥50 settled dry-run trades**. Non-skippable.
- **Immutable audit:** every attempt (dry_run | live | blocked) is recorded with reason, venue order id, raw response, and fill status. Append-only.
- **Four kill layers:** per-bot `paused`, per-user `live_enabled`, admin global env kill (`AGENT_LIVE_KILL=1`), and an auto circuit-breaker (daily-loss-cap breach / stale feed / N consecutive errors → halt + block).
- **No live order calls in CI.** Order-router integration tests are gated on `RUN_LIVE_TRADE` and target Polymarket's test/sandbox path; default `pnpm test` never places an order.
- New code under `apps/agent-worker/src/exec/` (worker) and `packages/core/src/agent/` (pure gates). Migration in `packages/core/db/migrations/` (next number after 004).

---

### Task 1: Legal/TOS consent gate (HARD GATE — do first)

**Files:**
- Modify: `docs/autotrade-tos-checklist.md` (extend for the agent/bot)
- Create: migration `005_agent_consent.sql` — `agent_consents` table + `short_bot_configs.live_enabled`
- Create: `packages/core/db/consent-repo.ts` (+ gated test)

**Interfaces:**
- Produces: `agent_consents (id, user_id, version, accepted_at)`; `short_bot_configs.live_enabled boolean default false`; `ConsentRepo.latestConsent(userId)` / `recordConsent(userId, version)`.

- [ ] **Step 1:** Extend `docs/autotrade-tos-checklist.md` with the agent-specific consent text (copy the four explicit-language clauses from `docs/HANDOFF_AUTOTRADE.md` Phase 1: not an investment advisor; non-custodial; user is principal; revocable). **The user reviews this with counsel and signs off before Tasks 4/6 ship.**
- [ ] **Step 2:** Write migration `005_agent_consent.sql`: `agent_consents` (user_id, version TEXT, accepted_at TIMESTAMPTZ) + `ALTER TABLE short_bot_configs ADD COLUMN IF NOT EXISTS live_enabled BOOLEAN NOT NULL DEFAULT false`.
- [ ] **Step 3:** Implement `ConsentRepo` (record + fetch latest by user). Gated integration test (`TEST_DATABASE_URL`).
- [ ] **Step 4:** Commit `feat(agent-exec): legal consent gate (TOS + consent record)`.

---

### Task 2: Live-eligibility gate (pure, the heart of safety)

**Files:**
- Create: `packages/core/src/agent/eligibility.ts`
- Test: `packages/core/src/agent/eligibility.test.ts`

**Interfaces:**
- Consumes: `BotState` (Plan 1).
- Produces:
  - `interface LiveContext { botCreatedAtMs: number; settledDryRunTrades: number; consentVersionAccepted: string | null; currentConsentVersion: string; venueConnected: boolean; nowMs: number }`
  - `const PROOF_MIN_DAYS = 7, PROOF_MIN_TRADES = 50`
  - `type EligibilityResult = { eligible: true } | { eligible: false; reason: string }`
  - `function liveEligibility(ctx: LiveContext): EligibilityResult` — eligible only if: `now - createdAt ≥ 7d` AND `settledDryRunTrades ≥ 50` AND `consentVersionAccepted === currentConsentVersion` AND `venueConnected`. Returns the first failing reason otherwise (`proof_period`, `proof_trades`, `consent_required`, `not_connected`).

- [ ] **Step 1: Failing test** — covers each reason + the happy path (use explicit `nowMs`/`createdAt`). E.g. 6 days → `proof_period`; 49 trades → `proof_trades`; stale consent → `consent_required`; not connected → `not_connected`; all good → eligible.
- [ ] **Step 2–4:** Run (fail) → implement the ordered checks → run (pass) → commit `feat(agent-exec): live-eligibility gate (proof + consent + connection)`.

---

### Task 3: Hard-ceiling sizing (pure)

**Files:**
- Create: `packages/core/src/agent/ceilings.ts`
- Test: `packages/core/src/agent/ceilings.test.ts`

**Interfaces:**
- Produces:
  - `const CEIL = { perTradeUsd: 50, perDayUsd: 200, cooldownMs: 300_000, maxOpenPositions: 20 }` (absolute).
  - `interface LiveSizeInput { requestedUsd: number; spentTodayUsd: number; openPositions: number; lastLiveTradeAtMs: number | null; nowMs: number }`
  - `type LiveSizeResult = { ok: true; sizeUsd: number } | { ok: false; reason: string }`
  - `function clampToCeilings(i: LiveSizeInput): LiveSizeResult` — blocks on cooldown (`cooldownMs`), open-position cap, daily ceiling exhausted; else `sizeUsd = min(requestedUsd, perTradeUsd, perDayUsd - spentTodayUsd)`; block if ≤ 0.

- [ ] **Step 1: Failing test** — cooldown block, open-position block, daily-ceiling block, per-trade clamp, daily-remaining clamp, happy path. (Mirror the Plan 1 gate test style.)
- [ ] **Step 2–4:** Run → implement → run → commit `feat(agent-exec): absolute hard-ceiling sizing`.

---

### Task 4: Order router — interface + Polymarket CLOB market orders

**Files:**
- Create: `apps/agent-worker/src/exec/router.ts` (interface + types)
- Create: `apps/agent-worker/src/exec/polymarket-router.ts`
- Test: `apps/agent-worker/src/exec/polymarket-router.test.ts` (integration, gated on `RUN_LIVE_TRADE`)

**Interfaces:**
- Produces:
  - `interface OrderRequest { venue: 'polymarket'; tokenId: string; side: 'BUY'; sizeUsd: number; clientId: string }`
  - `interface OrderResult { ok: boolean; venueOrderId?: string; filledUsd?: number; avgPrice?: number; status: 'filled'|'rejected'|'error'|'pending'; raw?: unknown; error?: string }`
  - `interface OrderRouter { placeMarketOrder(req: OrderRequest, creds: PolymarketCreds): Promise<OrderResult> }`
  - `class PolymarketRouter implements OrderRouter` using `@polymarket/clob-client` (create client from the user's decrypted API creds; place a FOK/market buy on the YES/NO token; map the response to `OrderResult`). `clientId` is an idempotency key so a retried tick can't double-fire.
  - `class FakeRouter implements OrderRouter` (records calls, returns a canned fill) for the worker tests in Task 6.

- [ ] **Step 1:** Implement the interface + `FakeRouter`. **Do NOT implement `PolymarketRouter` until Task 1's consent gate is merged and the user has signed off** (note this in the file header).
- [ ] **Step 2:** Implement `PolymarketRouter` against `@polymarket/clob-client` (grounded in the Plan 2 spike's CLOB findings — exact order params/signing). Add an integration test gated on `RUN_LIVE_TRADE` that places **one minimum-size order on the smallest live market and immediately verifies/handles it** — never runs in CI. Idempotency: same `clientId` must not double-submit.
- [ ] **Step 3:** Commit `feat(agent-exec): order router interface + Polymarket CLOB market orders`.

---

### Task 5: Immutable audit log

**Files:**
- Create: migration `006_agent_audit.sql` — `agent_trade_audit` (append-only)
- Create: `packages/core/db/audit-repo.ts` (+ gated test)

**Interfaces:**
- Produces: table `agent_trade_audit (id, bot_config_id, window_id, mode CHECK in dry_run|live|blocked, side, requested_usd, size_usd, blocked_reason, venue_order_id, status, filled_usd, avg_price, raw JSONB, created_at)`; `AuditRepo.record(entry): Promise<number>` (insert-only — no update/delete methods exposed).

- [ ] **Step 1–4:** Migration → `AuditRepo.record` (single insert) → gated integration test asserting a row round-trips and the repo exposes no mutation methods → commit `feat(agent-exec): immutable trade audit log`.

---

### Task 6: Live execution path in the worker (wires it together)

**Files:**
- Create: `apps/agent-worker/src/exec/execute.ts`
- Test: `apps/agent-worker/src/exec/execute.test.ts`

**Interfaces:**
- Consumes: `evaluateTick`/`GateResult` (Plan 1), `liveEligibility` (Task 2), `clampToCeilings` (Task 3), `OrderRouter` (Task 4), `AuditRepo` (Task 5), the admin kill env `AGENT_LIVE_KILL`.
- Produces: `async function executeDecision(args: { bot: BotState; live: LiveContext; gate: GateResult; window; quote; router: OrderRouter; audit: AuditRepo; creds; nowMs }): Promise<void>` — the single entry the worker calls when the gate says `trade`:
  1. If `AGENT_LIVE_KILL` set OR bot not `live_enabled` OR `liveEligibility` not eligible → **dry-run/simulate** (record `mode: 'dry_run'` or `'blocked'` with reason), never touches the router.
  2. Else compute size via `clampToCeilings`; if blocked → audit `mode:'blocked'` + reason, stop.
  3. Else `router.placeMarketOrder(...)` with an idempotency `clientId = botId:windowId`; audit `mode:'live'` with the result (filled/rejected/error). On error → audit + increment the circuit-breaker counter.

- [ ] **Step 1: Failing test (the critical coverage), all on fakes:**
  - kill env set → no router call, audit `blocked` reason `admin_kill`.
  - not eligible (proof not met) → no router call, audit `dry_run`/`blocked`.
  - eligible + ceiling-blocked → no router call, audit `blocked`.
  - eligible + ok → exactly one `router.placeMarketOrder` call with clamped size + idempotency id, audit `live` with the fill.
  - same (bot,window) twice → second call does not double-submit (idempotency).
- [ ] **Step 2–3:** Implement → run (pass) → commit `feat(agent-exec): worker live-execution path (gate → router → audit)`.

---

### Task 7: Kill switches + circuit breaker

**Files:**
- Create: `packages/core/src/agent/breaker.ts` (+ test)
- Modify: `apps/agent-worker/src/index.ts` (wire env kill + breaker into the loop)

**Interfaces:**
- Produces: `class CircuitBreaker { constructor(cfg:{maxConsecutiveErrors:number; dailyLossCapUsd:number}); recordError(): void; recordPnl(usd:number): void; tripped(): { tripped: boolean; reason?: string }; reset(): void }` — trips on N consecutive router errors or cumulative daily loss ≥ cap; once tripped, `executeDecision` blocks all live orders (audit `blocked` reason `breaker`).
- The four layers: per-bot `paused` (Plan 1 gate), per-user `live_enabled` (Task 1), admin `AGENT_LIVE_KILL` (Task 6), breaker (here).

- [ ] **Step 1: Failing test** — trips after N consecutive errors; trips on daily-loss breach; `reset()` clears; a success between errors resets the consecutive count.
- [ ] **Step 2–4:** Implement → wire into the worker (env kill check + breaker gating) → run → commit `feat(agent-exec): circuit breaker + kill-switch wiring`.

---

### Task 8: Go-Live UI in `/agent` (make the prototype ceremony real)

**Files:**
- Create: `apps/platform/src/app/agent/go-live.tsx` (client)
- Create: `apps/platform/src/app/api/agent/go-live/route.ts`
- Modify: `apps/platform/src/app/agent/rules-bar.tsx` (mode badge → real toggle)

**Interfaces:**
- Consumes: `liveEligibility` status + `ConsentRepo` (Task 1) + the credential connect/test-connection flow (existing `user_venue_connections` + credential wizard).
- Produces: the real version of the prototype's ceremony — DRY-RUN badge shows the **proof-gate countdown** ("live in X days · Y/50 trades"); when eligible, clicking opens the **consent click-through** + risk summary + "I understand" → POST `/api/agent/go-live` which records consent + sets `live_enabled=true` (server-validates eligibility again — never trust the client). Reverting sets `live_enabled=false`. The connect-keys modal runs a real **test-connection** (read-only balance fetch) before showing "connected".

- [ ] **Step 1:** Build the API route (re-checks `liveEligibility` server-side, records consent, flips `live_enabled`). **Step 2:** Build the UI (proof countdown, consent gate, toggle) reusing the prototype's design. **Step 3:** Verify with the `run` skill: a bot past its proof period + consent can flip live; one that isn't shows why. **Commit** `feat(agent-route): real Go-Live ceremony wired to eligibility + consent`.

---

## Self-Review

**Spec coverage (Plan 4 = non-custodial live execution / Rung 2):**
- Legal/TOS + consent (hard gate) → Task 1 ✅
- Dry-run proof gate (≥7d + ≥50 trades, non-skippable) → Task 2 ✅
- Hard ceilings (per-trade/day, cooldown, open-positions) → Task 3 ✅
- Order placement (Polymarket CLOB, market-only, idempotent) → Task 4 ✅
- Immutable audit → Task 5 ✅
- Wired live path (gate → eligibility → ceilings → router → audit) → Task 6 ✅
- Four kill layers + circuit breaker → Tasks 6,7 ✅
- Go-Live UI (proof countdown + consent + toggle, server-validated) → Task 8 ✅
- **Out of scope (later):** Kalshi live, limit orders, raising ceilings, custodial flow (KYC), multi-bot/group execution.

**Placeholder note:** Task 4's `PolymarketRouter` intentionally defers exact CLOB order params to the Plan 2 feeds/oracle spike doc and is **blocked behind Task 1's legal gate** — the interface + `FakeRouter` are fully specified so Tasks 6/7 are TDD-able without live calls. All gate/ceiling/breaker/eligibility logic (Tasks 2,3,6,7) carries complete code and is unit-tested on fakes.

**Type consistency:** `LiveContext`/`EligibilityResult` (Task 2), `LiveSizeInput`/`LiveSizeResult` + `CEIL` (Task 3), `OrderRequest`/`OrderResult`/`OrderRouter` (Task 4) all consumed by `executeDecision` (Task 6). `BotState` reused from Plan 1. Audit `mode` enum (dry_run|live|blocked) matches across Tasks 5 and 6. The worker calls `executeDecision` exactly where Plan 2's loop currently simulates.

**Safety review:** Real orders are unreachable unless ALL of: consent recorded (Task 1) + proof period met (Task 2) + connected (Task 2) + `live_enabled` (Task 8, server-validated) + not killed (env) + not breaker-tripped (Task 7) + within ceilings (Task 3). Any one failing → simulate or block + audit. This is intentionally hard to turn on.
