# Sneakers Agent — Live Ingestion + Dry-Run Worker (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the always-on backend that turns the Plan 1 decision core into a running paper-trading bot — ingest live Bitcoin short-interval windows from Polymarket + Kalshi, track a spot/reference price, evaluate each window with the agent core, and write dry-run trades + P&L to Railway Postgres.

**Architecture:** A new long-running Node process `apps/agent-worker` (run via `tsx`, deployed as a Railway service). It depends on `@sneakers/core` (Plan 1 agent functions) and a new DB layer in `packages/core/db`. All time-critical logic is a **pure evaluation loop** driven by injected **feed interfaces** and a **repository interface** — so the heart is unit-tested with fakes, and the real Polymarket/Kalshi/spot adapters are thin I/O behind those interfaces, integration-tested separately. **Dry-run only: this plan never places a real order.**

**Tech Stack:** TypeScript 5.4, `tsx`, `node:test` + `node:assert/strict`, `pg` (Postgres) against Railway, `@sneakers/core`. WebSocket via `ws` where streaming is used.

## Global Constraints

- Node `>=20`, pnpm `>=9`. Tests run with `node --import tsx --test "src/**/*.test.ts"` (mirror Plan 1 / `apps/platform`). No vitest/jest.
- **Reuse `@sneakers/core`** — import `evaluateTick`, `secondsToClose`, `windowStatus`, `settleTrade`, `thresholdsFor`, and the types (`MarketWindow`, `PriceState`, `BotState`, `Side`, `Outcome`, etc.). Do NOT reimplement signal/gate/settlement logic.
- **Dry-run only.** No order-placement code, no venue trading credentials. Market data is read from **house-level** (not per-user) endpoints. Per-user keys / live execution are out of scope (later rungs).
- DB is **Railway Postgres** via `DATABASE_URL`. Migrations live in `packages/core/db/migrations/NNN_*.sql` (next number is `004`) and follow the existing file style. The repo already depends on `pg`.
- Time enters the loop as an injected `now()` function — never read the clock inside pure logic (keeps loop tests deterministic).
- Money/P&L in USDC, rounded to cents at settlement (handled by `settleTrade`). Prices/probabilities in `[0,1]`.
- Respect venue limits: Kalshi market-data ~10 req/s; poll Polymarket politely. Prefer websockets where available; fall back to polling.
- Integration tests that hit live venues or a real DB are **gated on an env var** (`RUN_LIVE` / `TEST_DATABASE_URL`) and **skip** when unset, so the default `pnpm test` stays green offline.
- New worker code lives under `apps/agent-worker/src/`. DB layer under `packages/core/db/`.

---

## File Structure

- `docs/research/2026-06-27-feeds-oracle-spike.md` — Task 1 findings (endpoints + oracle decision).
- `packages/core/db/migrations/004_agent_tables.sql` — the 4 tables.
- `packages/core/db/agent-repo.ts` (+ `.test.ts`) — typed persistence/repository.
- `apps/agent-worker/package.json`, `tsconfig.json` — new workspace package `@sneakers/agent-worker`.
- `apps/agent-worker/src/feeds/types.ts` — feed + repo interfaces, `WindowSeed`, `PriceTick`.
- `apps/agent-worker/src/feeds/fake.ts` (+ `.test.ts`) — in-memory fakes for tests.
- `apps/agent-worker/src/vol.ts` (+ `.test.ts`) — rolling realized-volatility estimator (pure).
- `apps/agent-worker/src/loop.ts` (+ `.test.ts`) — the pure evaluation loop (the heart).
- `apps/agent-worker/src/feeds/polymarket.ts` — Polymarket MarketFeed (Gamma + CLOB).
- `apps/agent-worker/src/feeds/kalshi.ts` — Kalshi MarketFeed (REST/WS).
- `apps/agent-worker/src/feeds/spot.ts` (+ `.test.ts`) — SpotFeed/RefPriceSource per spike.
- `apps/agent-worker/src/index.ts` — entrypoint wiring real feeds + repo + clock.
- `apps/agent-worker/railway.json` (or `Procfile`) — Railway service config.

---

### Task 1: Spike — verify endpoints + resolve oracle parity (#1 risk)

**Files:**
- Create: `docs/research/2026-06-27-feeds-oracle-spike.md`

This is a research task (no code). It de-risks every adapter task and the bot's correctness. Produce a findings doc that answers the checklist below with concrete, copy-pasteable values (URLs, example responses, field names).

- [ ] **Step 1: Polymarket discovery + price.** Using the Gamma API (`https://gamma-api.polymarket.com`) and CLOB (`https://clob.polymarket.com`), document: how to list the live **BTC 5-minute and 15-minute "Up or Down"** markets; the exact fields that give `opensAt`/`closesAt` and the window's `openRefPrice` (start price); the `clobTokenIds` for the YES outcome; and the CLOB **midpoint** endpoint that returns the YES price. Paste one real example response for each.
- [ ] **Step 2: Polymarket RTDS.** Document the Real-Time Data Socket (`https://docs.polymarket.com/market-data/websocket/rtds`) — whether it can stream live YES price + the live reference BTC price per window, and the subscribe message shape. Note if polling CLOB midpoint every ~1s is the simpler v1 path.
- [ ] **Step 3: Kalshi discovery + price.** Document the REST endpoints (`https://api.kalshi.com/trade-api/v2`) to list **BTC 15-minute** markets (series/event/ticker pattern, e.g. `KXBTC*`), the fields giving open/close times + reference price + the YES (`yes_bid`/`yes_ask`/`last_price`) price, and the WS `ticker` channel subscribe shape (`wss://api.kalshi.com/trade-api/ws/v2`). Note which reads are public vs need a service key.
- [ ] **Step 4: Resolve oracle parity (the decision).** Polymarket 5-min BTC settles on **Chainlink Data Streams** BTC/USD (snapshot at exact end). Decide the v1 **spot/reference source** for the bot and write the decision + rationale:
  - Option A — consume the same Chainlink Data Streams BTC/USD feed (best parity; document access/cost/auth).
  - Option B — a low-latency proxy (Binance `BTCUSDT` or Polymarket RTDS reference) accepting small basis risk; **quantify** expected basis vs Chainlink and the adverse-selection cost near close.
  Pick one for v1, state it explicitly, and define the `referenceOracle` string the windows will record.
- [ ] **Step 5: Acceptance.** The doc has, for Polymarket and Kalshi: a discovery call, a price call, the open/close + ref-price fields, and a real example payload each; plus the chosen spot source with rationale. Commit:

```bash
git add docs/research/2026-06-27-feeds-oracle-spike.md
git commit -m "research(agent): live feeds + oracle parity spike"
```

---

### Task 2: DB migration 004 — agent tables

**Files:**
- Create: `packages/core/db/migrations/004_agent_tables.sql`

**Interfaces:**
- Produces tables `short_windows`, `short_signals`, `short_trades`, `short_bot_configs` (columns per the design spec). Later tasks' repo queries depend on these exact column names.

- [ ] **Step 1: Write the migration** (match the existing `001_catalog.sql` style — plain SQL, `IF NOT EXISTS`):

```sql
-- 004_agent_tables.sql — Sneakers Agent (dry-run) state

CREATE TABLE IF NOT EXISTS short_windows (
  id              BIGSERIAL PRIMARY KEY,
  venue           TEXT NOT NULL,
  asset           TEXT NOT NULL,
  interval_sec    INTEGER NOT NULL,
  external_id     TEXT NOT NULL,
  opens_at        TIMESTAMPTZ NOT NULL,
  closes_at       TIMESTAMPTZ NOT NULL,
  reference_oracle TEXT NOT NULL,
  open_ref_price  DOUBLE PRECISION,
  settle_ref_price DOUBLE PRECISION,
  outcome         TEXT,                    -- 'up' | 'down' | NULL
  status          TEXT NOT NULL DEFAULT 'upcoming',  -- upcoming|live|settled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue, external_id)
);
CREATE INDEX IF NOT EXISTS short_windows_status_idx ON short_windows (status, closes_at);

CREATE TABLE IF NOT EXISTS short_bot_configs (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  mode                TEXT NOT NULL DEFAULT 'dry_run',   -- dry_run|live
  sim_deposit_usdc    DOUBLE PRECISION NOT NULL DEFAULT 2000,
  sim_liquidity_usdc  DOUBLE PRECISION NOT NULL DEFAULT 500,
  risk_preset         TEXT NOT NULL DEFAULT 'balanced',  -- bunker|cautious|balanced|aggressive|max
  assets              TEXT[] NOT NULL DEFAULT ARRAY['BTC'],
  enabled_venues      TEXT[] NOT NULL DEFAULT ARRAY['polymarket','kalshi'],
  paused              BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS short_signals (
  id              BIGSERIAL PRIMARY KEY,
  window_id       BIGINT NOT NULL REFERENCES short_windows(id),
  kind            TEXT NOT NULL DEFAULT 'last_second_mispricing',
  side            TEXT NOT NULL,            -- YES|NO
  edge_bps        INTEGER NOT NULL,
  market_prob     DOUBLE PRECISION NOT NULL,
  implied_prob    DOUBLE PRECISION NOT NULL,
  seconds_to_close INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS short_trades (
  id              BIGSERIAL PRIMARY KEY,
  bot_config_id   BIGINT NOT NULL REFERENCES short_bot_configs(id),
  window_id       BIGINT NOT NULL REFERENCES short_windows(id),
  signal_id       BIGINT REFERENCES short_signals(id),
  mode            TEXT NOT NULL DEFAULT 'dry_run',
  side            TEXT NOT NULL,            -- YES|NO
  size_usdc       DOUBLE PRECISION NOT NULL,
  entry_price     DOUBLE PRECISION NOT NULL,
  settle_price    DOUBLE PRECISION,
  pnl_usdc        DOUBLE PRECISION,
  status          TEXT NOT NULL DEFAULT 'open',  -- open|won|lost
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_config_id, window_id)         -- one trade per bot per window
);
CREATE INDEX IF NOT EXISTS short_trades_status_idx ON short_trades (status);
```

- [ ] **Step 2: Apply + verify** against Railway (requires `DATABASE_URL`):

Run: `pnpm --filter @sneakers/core db:migrate`
Then verify the tables exist (psql or the existing `db:verify`): expect `short_windows`, `short_signals`, `short_trades`, `short_bot_configs` present.
Expected: migrate runs clean; `\dt short_*` lists all four.

- [ ] **Step 3: Commit**

```bash
git add packages/core/db/migrations/004_agent_tables.sql
git commit -m "feat(agent-db): migration 004 — windows/signals/trades/bot_configs"
```

---

### Task 3: Repository layer

**Files:**
- Create: `packages/core/db/agent-repo.ts`
- Test: `packages/core/db/agent-repo.test.ts` (integration — gated on `TEST_DATABASE_URL`)

**Interfaces:**
- Consumes: `pg.Pool`; `@sneakers/core` types (`Venue`, `Asset`, `Side`, `Outcome`).
- Produces:
  - `interface WindowSeed { venue: Venue; asset: Asset; intervalSec: number; externalId: string; opensAt: number; closesAt: number; referenceOracle: string }`
  - `interface WindowRow extends WindowSeed { id: number; openRefPrice: number | null; settleRefPrice: number | null; outcome: Outcome | null; status: 'upcoming'|'live'|'settled' }`
  - `class AgentRepo` with: `upsertWindow(seed): Promise<WindowRow>`, `setOpenRef(id, price): Promise<void>`, `setSettle(id, price, outcome): Promise<void>`, `setStatus(id, status): Promise<void>`, `loadOpenWindows(now): Promise<WindowRow[]>` (status in upcoming/live and not past close+grace), `loadBotConfigs(): Promise<BotConfigRow[]>`, `insertSignal(s): Promise<number>`, `insertTrade(t): Promise<number|null>` (returns null on the unique-conflict = already traded this window), `openTradesForWindow(windowId): Promise<TradeRow[]>`, `markTradeSettled(id, settlePrice, pnl, status): Promise<void>`, `pnlSummary(botConfigId): Promise<{ todayUsdc: number; allTimeUsdc: number; spentTodayUsdc: number; windowsThisHour: number }>`.

- [ ] **Step 1: Write the failing integration test** (skips if no DB):

```ts
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { AgentRepo } from './agent-repo'

const url = process.env.TEST_DATABASE_URL
const maybe = url ? describe : describe.skip

maybe('AgentRepo', () => {
  let pool: Pool, repo: AgentRepo
  before(async () => { pool = new Pool({ connectionString: url }); repo = new AgentRepo(pool) })
  after(async () => { await pool.end() })

  test('upsert window is idempotent and round-trips', async () => {
    const seed = { venue: 'polymarket' as const, asset: 'BTC' as const, intervalSec: 300,
      externalId: 'test-' + Math.floor(Math.random()*1e9), opensAt: Date.now(), closesAt: Date.now()+300000,
      referenceOracle: 'chainlink-datastreams:BTC-USD' }
    const a = await repo.upsertWindow(seed)
    const b = await repo.upsertWindow(seed)
    assert.equal(a.id, b.id)            // idempotent on (venue, external_id)
    assert.equal(a.status, 'upcoming')
  })

  test('open ref + settle update outcome and status', async () => {
    const seed = { venue: 'kalshi' as const, asset: 'BTC' as const, intervalSec: 900,
      externalId: 'test-' + Math.floor(Math.random()*1e9), opensAt: Date.now(), closesAt: Date.now()+900000,
      referenceOracle: 'cf-benchmarks:BRTI' }
    const w = await repo.upsertWindow(seed)
    await repo.setOpenRef(w.id, 100000)
    await repo.setSettle(w.id, 100050, 'up')
    const open = await repo.loadOpenWindows(Date.now() + 1_000_000) // far future → none open
    assert.ok(!open.find(x => x.id === w.id))
  })
})
```

- [ ] **Step 2: Run (skips without DB, passes with):**

Run: `pnpm --filter @sneakers/core test`
Expected without `TEST_DATABASE_URL`: the `AgentRepo` suite is **skipped**, others pass. With it set against a migrated DB: PASS.

- [ ] **Step 3: Implement `agent-repo.ts`.** Write the class with parameterized `pg` queries mapping to the Task 2 columns. Map epoch-ms ↔ `TIMESTAMPTZ` (`to_timestamp(ms/1000.0)` on write; `extract(epoch …)*1000` on read). `insertTrade` uses `INSERT ... ON CONFLICT (bot_config_id, window_id) DO NOTHING RETURNING id` and returns `null` when no row. `pnlSummary` computes `today`/`all-time` sums of `pnl_usdc` for settled trades, `spentTodayUsdc` = sum of `size_usdc` for today's trades, and `windowsThisHour` = count of trades in the last hour. (Full method bodies are mechanical given the schema; keep one query per method, no ORM.)

- [ ] **Step 4: Re-run with a DB to confirm**, then **Commit**

```bash
git add packages/core/db/agent-repo.ts packages/core/db/agent-repo.test.ts
git commit -m "feat(agent-db): typed repository for windows/signals/trades + P&L"
```

---

### Task 4: Worker package + feed/repo interfaces + fakes

**Files:**
- Create: `apps/agent-worker/package.json`, `apps/agent-worker/tsconfig.json`
- Create: `apps/agent-worker/src/feeds/types.ts`
- Create: `apps/agent-worker/src/feeds/fake.ts`
- Test: `apps/agent-worker/src/feeds/fake.test.ts`

**Interfaces:**
- Produces:
  - `interface PriceTick { windowExternalId: string; yesPrice: number; atMs: number }`
  - `interface MarketFeed { venue: Venue; discoverWindows(nowMs: number): Promise<WindowSeed[]>; latestYesPrice(externalId: string): Promise<number | null> }`
  - `interface SpotFeed { spot(): number; recentVolPerSec(): number }`
  - `interface RefPriceSource { refPriceAt(atMs: number): Promise<number> }`
  - `interface WindowStore` — the subset of `AgentRepo` the loop needs (so the loop can be tested with a fake): `upsertWindow`, `setOpenRef`, `setSettle`, `setStatus`, `loadOpenWindows`, `loadBotConfigs`, `insertSignal`, `insertTrade`, `openTradesForWindow`, `markTradeSettled`, `pnlSummary` (same signatures as Task 3).
  - `FakeMarketFeed`, `FakeSpotFeed`, `FakeRefSource`, `InMemoryStore` implementing the above for tests.

- [ ] **Step 1: Scaffold the package.** `package.json` name `@sneakers/agent-worker`, private, `"type": "module"`, scripts: `"test": "node --import tsx --test \"src/**/*.test.ts\""`, `"start": "tsx src/index.ts"`; deps `@sneakers/core` (workspace), `pg`, `ws`; devDeps `tsx`, `typescript`, `@types/ws`, `@types/pg`. `tsconfig.json` extends the repo base.

- [ ] **Step 2: Write the failing test for the fakes:**

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeMarketFeed, InMemoryStore } from './fake'

describe('fakes', () => {
  test('FakeMarketFeed returns seeded windows + prices', async () => {
    const f = new FakeMarketFeed('polymarket', [
      { seed: { venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w1',
                opensAt: 0, closesAt: 300000, referenceOracle: 'x' }, yesPrice: 0.88 },
    ])
    const ws = await f.discoverWindows(0)
    assert.equal(ws.length, 1)
    assert.equal(await f.latestYesPrice('w1'), 0.88)
  })
  test('InMemoryStore upsert is idempotent', async () => {
    const s = new InMemoryStore()
    const seed = { venue: 'polymarket' as const, asset: 'BTC' as const, intervalSec: 300,
      externalId: 'w1', opensAt: 0, closesAt: 300000, referenceOracle: 'x' }
    const a = await s.upsertWindow(seed); const b = await s.upsertWindow(seed)
    assert.equal(a.id, b.id)
  })
})
```

- [ ] **Step 3: Run to verify it fails, then implement `types.ts` + `fake.ts`** (in-memory maps; assign incremental ids; `insertTrade` enforces one-per-(bot,window) returning null on repeat).

Run: `pnpm --filter @sneakers/agent-worker test` → FAIL then PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/agent-worker/package.json apps/agent-worker/tsconfig.json apps/agent-worker/src/feeds/types.ts apps/agent-worker/src/feeds/fake.ts apps/agent-worker/src/feeds/fake.test.ts
git commit -m "feat(agent-worker): package scaffold + feed/store interfaces + fakes"
```

---

### Task 5: Rolling realized-volatility estimator (pure)

**Files:**
- Create: `apps/agent-worker/src/vol.ts`
- Test: `apps/agent-worker/src/vol.test.ts`

**Interfaces:**
- Produces: `class RollingVol { constructor(windowSec: number); push(price: number, atMs: number): void; perSec(): number }` — maintains recent 1-second price changes and returns the stdev of per-second moves (the `recentVolPerSec` the core's `impliedProbUp` expects). Returns a small positive floor when insufficient data.

- [ ] **Step 1: Failing test:**

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { RollingVol } from './vol'

describe('RollingVol', () => {
  test('flat prices -> ~0 vol (floored positive)', () => {
    const v = new RollingVol(60)
    for (let t = 0; t < 10; t++) v.push(100, t * 1000)
    assert.ok(v.perSec() >= 0)
    assert.ok(v.perSec() < 1e-6 + 1e-9)
  })
  test('steady +1/sec moves -> perSec near 1', () => {
    const v = new RollingVol(60)
    for (let t = 0; t < 30; t++) v.push(100 + t, t * 1000)
    assert.ok(Math.abs(v.perSec() - 1) < 0.2)
  })
})
```

- [ ] **Step 2–4:** Run (fail) → implement (`push` records `(atMs, price)`, drops entries older than `windowSec`, computes per-second deltas and their sample stdev; `perSec()` returns `max(stdev, FLOOR)` with `FLOOR = 1e-6`) → run (pass) → commit `feat(agent-worker): rolling realized-vol estimator`.

---

### Task 6: The evaluation loop (the heart)

**Files:**
- Create: `apps/agent-worker/src/loop.ts`
- Test: `apps/agent-worker/src/loop.test.ts`

**Interfaces:**
- Consumes: `MarketFeed[]`, `SpotFeed`, `RefPriceSource`, `WindowStore` (Task 4); `RollingVol` (Task 5); `evaluateTick`, `secondsToClose`, `windowStatus`, `settleTrade`, `thresholdsFor` and types from `@sneakers/core`.
- Produces: `class AgentLoop { constructor(deps: { feeds; spot; ref; store; now: () => number }); discoverTick(): Promise<void>; priceTick(): Promise<void>; settleTick(): Promise<void> }`.
  - `discoverTick` — for each feed, `discoverWindows(now)` → `store.upsertWindow`; when a window crosses `opensAt` and has no `openRefPrice`, set it from `ref.refPriceAt(opensAt)` and status `live`.
  - `priceTick` — for each live window: pull `latestYesPrice`; build `PriceState` (`openRefPrice` from the row, `spot` from `SpotFeed`, `secondsToClose`, `recentVolPerSec`); for each enabled bot config whose `assets`/`enabled_venues` include this window, build `BotState` from `pnlSummary` + config, call `evaluateTick`; on `gate.action === 'trade'`, `insertSignal` then `insertTrade` (entry price = current YES/NO price for the chosen side); skip silently on unique-conflict (already traded).
  - `settleTick` — for windows past `closesAt`: set `settleRefPrice` from `ref.refPriceAt(closesAt)`, compute `outcome` (`up` if settle ≥ open else `down`), `setSettle`, status `settled`; for each open trade on the window call `settleTrade` and `markTradeSettled`.

- [ ] **Step 1: Failing test — end-to-end on fakes** (the crucial coverage). Seed one BTC 5M window with a clear last-second edge, a `balanced` bot config, run `discover → price (near close) → settle`, assert a dry-run trade is recorded and settles **won** with positive P&L:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentLoop } from './loop'
import { FakeMarketFeed, FakeSpotFeed, FakeRefSource, InMemoryStore } from './feeds/fake'

describe('AgentLoop', () => {
  test('clear last-second edge -> dry-run trade recorded and settles won', async () => {
    const opensAt = 0, closesAt = 300_000
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false,
      simDepositUsdc: 2000, simLiquidityUsdc: 500 })
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w1',
      opensAt, closesAt, referenceOracle: 'x' }, yesPrice: 0.85 }])
    // spot 103 vs open 100 with low vol → implied ~1.0, YES underpriced at 0.85 → edge
    const spot = new FakeSpotFeed(103, 0.8)
    const ref = new FakeRefSource({ [opensAt]: 100, [closesAt]: 101 }) // ends up
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })

    t = 0;        await loop.discoverTick()   // window opens, openRef=100
    t = 299_000;  await loop.priceTick()      // 1s to close → trade
    t = 301_000;  await loop.settleTick()     // settle up

    const trades = await store.allTrades()
    assert.equal(trades.length, 1)
    assert.equal(trades[0].side, 'YES')
    assert.equal(trades[0].status, 'won')
    assert.ok(trades[0].pnlUsdc > 0)
  })

  test('no edge -> no trade', async () => {
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false, simDepositUsdc: 2000, simLiquidityUsdc: 500 })
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w2',
      opensAt: 0, closesAt: 300_000, referenceOracle: 'x' }, yesPrice: 0.50 }])
    const spot = new FakeSpotFeed(100, 1), ref = new FakeRefSource({ 0: 100, 300_000: 100 })
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })
    t = 0; await loop.discoverTick(); t = 299_000; await loop.priceTick(); t = 301_000; await loop.settleTick()
    assert.equal((await store.allTrades()).length, 0)
  })
})
```

> Note: extend `InMemoryStore` (Task 4) with the test helpers used here — `seedBotConfig`, `allTrades` — when implementing this task; add them to `fake.ts` and keep `fake.test.ts` green.

- [ ] **Step 2: Run (fail) → implement `loop.ts` → run (pass).** Keep each of the three tick methods small and independently callable. Maintain a per-window `RollingVol` keyed by window id, fed in `priceTick`.

- [ ] **Step 3: Commit** `feat(agent-worker): pure evaluation loop (discover/price/settle) on the core`.

---

### Task 7: Polymarket adapter

**Files:**
- Create: `apps/agent-worker/src/feeds/polymarket.ts`
- Test: `apps/agent-worker/src/feeds/polymarket.test.ts` (integration, gated on `RUN_LIVE`)

**Interfaces:**
- Produces: `class PolymarketFeed implements MarketFeed` (`venue='polymarket'`). `discoverWindows` queries the **Gamma API** for live BTC 5M/15M "Up or Down" markets and maps each to a `WindowSeed` (`externalId` = market id; capture `clobTokenIds[YES]`, `opensAt`/`closesAt`). `latestYesPrice` calls the **CLOB midpoint** endpoint for the YES token id. Use the exact endpoints + field names documented in Task 1's spike doc.

- [ ] **Step 1: Integration test (skips without `RUN_LIVE`)** — asserts `discoverWindows(Date.now())` returns ≥1 BTC window with sane `opensAt < closesAt` and `latestYesPrice` for its external id is in `[0,1]`. Use `const maybe = process.env.RUN_LIVE ? describe : describe.skip`.
- [ ] **Step 2: Implement** against the spike's endpoints (Gamma discover → map → CLOB midpoint). Add a small in-memory cache of `externalId → yesTokenId`. Handle missing/closed markets by omitting them. Respect polite polling.
- [ ] **Step 3: Run with `RUN_LIVE=1` to confirm against production data; Commit** `feat(agent-worker): Polymarket feed (Gamma discovery + CLOB midpoint)`.

---

### Task 8: Kalshi adapter

**Files:**
- Create: `apps/agent-worker/src/feeds/kalshi.ts`
- Test: `apps/agent-worker/src/feeds/kalshi.test.ts` (integration, gated on `RUN_LIVE`)

**Interfaces:**
- Produces: `class KalshiFeed implements MarketFeed` (`venue='kalshi'`). `discoverWindows` lists live **BTC 15-minute** markets via REST `/markets` (series/ticker pattern from the spike); maps to `WindowSeed`. `latestYesPrice` returns the YES price (`yes_bid`/`yes_ask` mid or `last_price`, per spike) normalized to `[0,1]`. REST polling for v1 (WS `ticker` optional follow-up). Respect ~10 req/s.

- [ ] **Step 1–3:** Same gated-integration pattern as Task 7 (skip without `RUN_LIVE`; assert ≥1 BTC 15M window + price in `[0,1]`), implement against the spike endpoints, run with `RUN_LIVE=1`, commit `feat(agent-worker): Kalshi feed (REST markets + price)`.

---

### Task 9: Spot/reference source

**Files:**
- Create: `apps/agent-worker/src/feeds/spot.ts`
- Test: `apps/agent-worker/src/feeds/spot.test.ts` (vol/mapping pure tests always run; live fetch gated on `RUN_LIVE`)

**Interfaces:**
- Produces: `class LiveSpot implements SpotFeed, RefPriceSource` — per the **Task 1 oracle decision**. Maintains a live BTC price (streaming or short-poll from the chosen source), feeds a `RollingVol`, and serves `spot()`, `recentVolPerSec()`, and `refPriceAt(atMs)` (the reference price used to open/settle windows — the chosen source's snapshot nearest `atMs`). `referenceOracle` string matches what windows record.

- [ ] **Step 1:** Pure unit tests for the internal price-buffer → `refPriceAt(atMs)` nearest-snapshot selection and the vol wiring (deterministic, always run). Live-connection test gated on `RUN_LIVE`.
- [ ] **Step 2–4:** Implement the chosen source (Chainlink Data Streams or the documented proxy), run, commit `feat(agent-worker): live spot + reference price source`.

---

### Task 10: Worker entrypoint + Railway deploy

**Files:**
- Create: `apps/agent-worker/src/index.ts`
- Create: `apps/agent-worker/railway.json` (or `Procfile`)

**Interfaces:**
- Consumes everything above. Wires real feeds (`PolymarketFeed`, `KalshiFeed`), `LiveSpot`, `AgentRepo` (as the `WindowStore`), and `now = () => Date.now()` into `AgentLoop`. Runs three timers: `discoverTick` (~every 5s), `priceTick` (~every 1s), `settleTick` (~every 2s). Reads `DATABASE_URL` from env. Graceful shutdown on SIGTERM (close pool + sockets). Structured success/error logs on each external call (per the project's "log external-API success path" convention).

- [ ] **Step 1:** Implement `index.ts` (assemble deps, start the three intervals, install signal handlers, log a heartbeat with counts of windows tracked / trades today).
- [ ] **Step 2:** Add `railway.json` declaring the service start command `pnpm --filter @sneakers/agent-worker start` and that it needs `DATABASE_URL` (Railway Postgres) — document required env in a short `apps/agent-worker/README.md`.
- [ ] **Step 3: Local smoke run** against Railway Postgres + `RUN_LIVE`: confirm it discovers real BTC windows, writes rows to `short_windows`, and records/settles at least one dry-run trade over ~15 min. Capture the log + a `SELECT count(*) FROM short_trades` in the README.
- [ ] **Step 4: Commit** `feat(agent-worker): entrypoint + Railway service config`.

---

## Self-Review

**Spec coverage (Plan 2 = live ingestion + dry-run worker):**
- DB schema (4 tables) → Task 2 ✅; repository → Task 3 ✅.
- Aggregation / Window Tracker (discover + open-ref) → loop `discoverTick` (Task 6) + adapters (7,8) ✅.
- Venue feeds (Polymarket 5M/15M, Kalshi 15M) → Tasks 7, 8 ✅.
- Spot/oracle feed + **oracle parity (#1 risk)** → Task 1 spike + Task 9 ✅.
- Signal Engine + Execution Gate + dry-run execution → reused from `@sneakers/core` via loop `priceTick` (Task 6) ✅.
- Dry-run settlement + real P&L → loop `settleTick` (Task 6) + `settleTrade` + repo ✅.
- Always-on worker runtime + Railway deploy → Task 10 ✅.
- **Out of scope (later):** real order placement / live trading, per-user credentials, the `/agent` frontend route (Plan 3), circuit-breaker side-effects beyond the gate's kill flags, WS upgrades for Kalshi/Polymarket (REST/poll is the v1 path; WS noted as optional).

**Placeholder scan:** the adapter tasks (7–9) intentionally defer exact endpoint field names to the Task 1 spike doc — that is a real, committed artifact (not a vague TODO), and the interfaces they implement are fully specified in Task 4. The deterministic tasks (2,3,5,6) carry complete code/SQL.

**Type consistency:** `WindowSeed`/`WindowRow` defined in Task 3 and reused by Task 4 interfaces, the loop (6), and adapters (7–9). `MarketFeed`/`SpotFeed`/`RefPriceSource`/`WindowStore` defined in Task 4, consumed by Task 6 and implemented by 7–10. The loop uses only `@sneakers/core` exports for signal/gate/settlement (no reimplementation). `PriceState` fields (`openRefPrice`, `spot`, `secondsToClose`, `recentVolPerSec`) are produced in `priceTick` exactly as the core expects.

**Scope check:** one coherent subsystem (the ingestion worker) producing working, testable software — the loop is fully unit-tested on fakes, adapters are integration-tested live, and Task 10 yields a deployable Railway service. Plan 3 (the `/agent` route) consumes these tables read-only.
