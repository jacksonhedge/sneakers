# Sneakers Agent Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic decision core of the Sneakers Agent — the pure functions that turn a short-interval crypto market window + live price into a trade decision, gate it against risk rules, and settle its dry-run P&L.

**Architecture:** A dependency-free TypeScript library under `packages/core/src/agent/`. Every module is a pure function over plain data — no DB, no network, no clock reads passed-in-not-read. The live Railway worker (Plan 2) and the `/agent` route (Plan 3) consume these functions; this plan ships none of that I/O. Fully unit-tested with `node:test`.

**Tech Stack:** TypeScript 5.4, `node:test` + `node:assert/strict` run via `tsx` (`node --import tsx --test`), pnpm workspaces (`@sneakers/core`).

## Global Constraints

- Node `>=20.0.0`, pnpm `>=9.0.0` (root `package.json` engines).
- Test runner is `node:test`, run with `node --import tsx --test "src/**/*.test.ts"` — mirror the pattern already in `apps/platform/package.json`. Do NOT introduce vitest/jest.
- `packages/core` adds **no new runtime dependencies** in this plan — the agent core is pure logic. `tsx` and `typescript` are already devDependencies.
- Probabilities and market prices are numbers in `[0, 1]`. Sizes and P&L are USDC numbers. Money is rounded to cents (2 decimal places) at settlement.
- All functions take the current time as an explicit `nowMs: number` (epoch milliseconds) parameter — never read the clock inside core (keeps everything deterministic and testable).
- Risk-preset ladder values for `minEdgeBps` and `actWindowSec` are fixed by the spec; the dollar values (`maxSizeUsdc`, `perDayCapUsdc`, `maxWindowsPerHour`) are the simulated-balance defaults defined in Task 2 and may be tuned later.
- New files live in `packages/core/src/agent/`. Each module has a colocated `*.test.ts`.

---

### Task 1: Package test wiring + window domain model

**Files:**
- Modify: `packages/core/package.json` (add a `test` script)
- Create: `packages/core/src/agent/window.ts`
- Test: `packages/core/src/agent/window.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types `Venue = 'polymarket' | 'kalshi'`, `Asset = 'BTC' | 'ETH' | 'SOL' | 'XRP'`, `Side = 'YES' | 'NO'`, `Outcome = 'up' | 'down'`, `WindowStatus = 'upcoming' | 'live' | 'settled'`.
  - Interface `MarketWindow { venue: Venue; asset: Asset; intervalSec: number; opensAt: number; closesAt: number; referenceOracle: string; openRefPrice: number | null; settleRefPrice: number | null }`.
  - `secondsToClose(w: MarketWindow, nowMs: number): number`
  - `windowStatus(w: MarketWindow, nowMs: number): WindowStatus`

- [ ] **Step 1: Add the test script to the core package**

In `packages/core/package.json`, add to `"scripts"` (keep existing entries):

```json
"test": "node --import tsx --test \"src/**/*.test.ts\""
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/src/agent/window.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { secondsToClose, windowStatus, type MarketWindow } from './window'

const w: MarketWindow = {
  venue: 'polymarket', asset: 'BTC', intervalSec: 300,
  opensAt: 1_000_000, closesAt: 1_300_000, referenceOracle: 'chainlink:BTC-USD',
  openRefPrice: null, settleRefPrice: null,
}

describe('secondsToClose', () => {
  test('floors remaining seconds', () => {
    assert.equal(secondsToClose(w, 1_299_400), 0) // 600ms left -> 0
    assert.equal(secondsToClose(w, 1_295_000), 5)
  })
  test('never negative', () => {
    assert.equal(secondsToClose(w, 1_400_000), 0)
  })
})

describe('windowStatus', () => {
  test('upcoming before open', () => assert.equal(windowStatus(w, 999_999), 'upcoming'))
  test('live during window', () => assert.equal(windowStatus(w, 1_150_000), 'live'))
  test('settled at/after close', () => {
    assert.equal(windowStatus(w, 1_300_000), 'settled')
    assert.equal(windowStatus(w, 1_400_000), 'settled')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./window`.

- [ ] **Step 4: Write minimal implementation**

Create `packages/core/src/agent/window.ts`:

```ts
export type Venue = 'polymarket' | 'kalshi'
export type Asset = 'BTC' | 'ETH' | 'SOL' | 'XRP'
export type Side = 'YES' | 'NO'
export type Outcome = 'up' | 'down'
export type WindowStatus = 'upcoming' | 'live' | 'settled'

export interface MarketWindow {
  venue: Venue
  asset: Asset
  intervalSec: number
  opensAt: number
  closesAt: number
  referenceOracle: string
  openRefPrice: number | null
  settleRefPrice: number | null
}

export function secondsToClose(w: MarketWindow, nowMs: number): number {
  return Math.max(0, Math.floor((w.closesAt - nowMs) / 1000))
}

export function windowStatus(w: MarketWindow, nowMs: number): WindowStatus {
  if (nowMs < w.opensAt) return 'upcoming'
  if (nowMs >= w.closesAt) return 'settled'
  return 'live'
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS — all window tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/core/src/agent/window.ts packages/core/src/agent/window.test.ts
git commit -m "feat(agent-core): window domain model + test wiring"
```

---

### Task 2: Risk presets

**Files:**
- Create: `packages/core/src/agent/presets.ts`
- Test: `packages/core/src/agent/presets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Type `RiskPreset = 'bunker' | 'cautious' | 'balanced' | 'aggressive' | 'max'`.
  - Interface `RiskThresholds { minEdgeBps: number; actWindowSec: number; maxSizeUsdc: number; perDayCapUsdc: number; maxWindowsPerHour: number }`.
  - `const PRESETS: Record<RiskPreset, RiskThresholds>`.
  - `thresholdsFor(preset: RiskPreset): RiskThresholds`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/presets.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS, thresholdsFor, type RiskPreset } from './presets'

const ORDER: RiskPreset[] = ['bunker', 'cautious', 'balanced', 'aggressive', 'max']

describe('PRESETS ladder', () => {
  test('spec-fixed edge + act-window values', () => {
    assert.equal(PRESETS.bunker.minEdgeBps, 1000)
    assert.equal(PRESETS.max.minEdgeBps, 200)
    assert.equal(PRESETS.bunker.actWindowSec, 2)
    assert.equal(PRESETS.max.actWindowSec, 20)
  })
  test('minEdgeBps decreases monotonically as risk rises', () => {
    for (let i = 1; i < ORDER.length; i++) {
      assert.ok(PRESETS[ORDER[i]].minEdgeBps < PRESETS[ORDER[i - 1]].minEdgeBps)
    }
  })
  test('actWindow, size, daily cap, hourly cap increase monotonically', () => {
    for (let i = 1; i < ORDER.length; i++) {
      const a = PRESETS[ORDER[i - 1]], b = PRESETS[ORDER[i]]
      assert.ok(b.actWindowSec > a.actWindowSec)
      assert.ok(b.maxSizeUsdc > a.maxSizeUsdc)
      assert.ok(b.perDayCapUsdc > a.perDayCapUsdc)
      assert.ok(b.maxWindowsPerHour > a.maxWindowsPerHour)
    }
  })
})

describe('thresholdsFor', () => {
  test('returns the matching preset', () => {
    assert.deepEqual(thresholdsFor('balanced'), PRESETS.balanced)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./presets`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/agent/presets.ts`:

```ts
export type RiskPreset = 'bunker' | 'cautious' | 'balanced' | 'aggressive' | 'max'

export interface RiskThresholds {
  minEdgeBps: number
  actWindowSec: number
  maxSizeUsdc: number
  perDayCapUsdc: number
  maxWindowsPerHour: number
}

// minEdgeBps + actWindowSec are spec-fixed; dollar/count values are
// simulated-balance defaults (tunable later).
export const PRESETS: Record<RiskPreset, RiskThresholds> = {
  bunker:     { minEdgeBps: 1000, actWindowSec: 2,  maxSizeUsdc: 5,   perDayCapUsdc: 25,   maxWindowsPerHour: 2 },
  cautious:   { minEdgeBps: 750,  actWindowSec: 4,  maxSizeUsdc: 15,  perDayCapUsdc: 60,   maxWindowsPerHour: 4 },
  balanced:   { minEdgeBps: 500,  actWindowSec: 7,  maxSizeUsdc: 40,  perDayCapUsdc: 150,  maxWindowsPerHour: 8 },
  aggressive: { minEdgeBps: 350,  actWindowSec: 11, maxSizeUsdc: 100, perDayCapUsdc: 400,  maxWindowsPerHour: 15 },
  max:        { minEdgeBps: 200,  actWindowSec: 20, maxSizeUsdc: 250, perDayCapUsdc: 1000, maxWindowsPerHour: 30 },
}

export function thresholdsFor(preset: RiskPreset): RiskThresholds {
  return PRESETS[preset]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/presets.ts packages/core/src/agent/presets.test.ts
git commit -m "feat(agent-core): 5 risk presets with monotonic ladder"
```

---

### Task 3: Normal CDF helper

**Files:**
- Create: `packages/core/src/agent/mathx.ts`
- Test: `packages/core/src/agent/mathx.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `erf(x: number): number`, `normCdf(x: number): number`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/mathx.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { normCdf } from './mathx'

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`)

describe('normCdf', () => {
  test('symmetric around 0.5 at x=0', () => near(normCdf(0), 0.5, 1e-9))
  test('approaches 1 for large positive x', () => near(normCdf(8), 1, 1e-6))
  test('approaches 0 for large negative x', () => near(normCdf(-8), 0, 1e-6))
  test('known value at x=1 (~0.8413)', () => near(normCdf(1), 0.8413))
  test('symmetry: normCdf(-x) == 1 - normCdf(x)', () => near(normCdf(-0.7), 1 - normCdf(0.7), 1e-9))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./mathx`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/agent/mathx.ts`:

```ts
// Abramowitz & Stegun 7.1.26 approximation of the error function.
export function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return x >= 0 ? y : -y
}

// Standard normal cumulative distribution function.
export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/mathx.ts packages/core/src/agent/mathx.test.ts
git commit -m "feat(agent-core): normal CDF helper for implied probability"
```

---

### Task 4: Signal engine — implied probability + edge

**Files:**
- Create: `packages/core/src/agent/signal.ts`
- Test: `packages/core/src/agent/signal.test.ts`

**Interfaces:**
- Consumes: `normCdf` from `./mathx`; `Side` from `./window`.
- Produces:
  - Interface `PriceState { openRefPrice: number; spot: number; secondsToClose: number; recentVolPerSec: number }` (`recentVolPerSec` = stdev of 1-second price moves, in price units).
  - Interface `MarketQuote { yesPrice: number }`.
  - Interface `SignalDecision { side: Side; impliedProb: number; marketProb: number; edgeBps: number }`.
  - `impliedProbUp(s: PriceState): number`.
  - `evaluateSignal(s: PriceState, q: MarketQuote): SignalDecision | null`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/signal.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { impliedProbUp, evaluateSignal, type PriceState } from './signal'

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`)
const base: PriceState = { openRefPrice: 100, spot: 100, secondsToClose: 4, recentVolPerSec: 1 }

describe('impliedProbUp', () => {
  test('0.5 when spot equals open with time left', () => near(impliedProbUp(base), 0.5, 1e-9))
  test('~1 when far above open and tiny vol', () => {
    near(impliedProbUp({ openRefPrice: 100, spot: 105, secondsToClose: 2, recentVolPerSec: 0.2 }), 1, 1e-3)
  })
  test('deterministic at the close: above open -> 1', () => {
    assert.equal(impliedProbUp({ openRefPrice: 100, spot: 100.5, secondsToClose: 0, recentVolPerSec: 1 }), 1)
  })
  test('deterministic at the close: below open -> 0', () => {
    assert.equal(impliedProbUp({ openRefPrice: 100, spot: 99.5, secondsToClose: 0, recentVolPerSec: 1 }), 0)
  })
})

describe('evaluateSignal', () => {
  test('buys YES when implied prob beats the YES price', () => {
    const s: PriceState = { openRefPrice: 100, spot: 103, secondsToClose: 1, recentVolPerSec: 0.8 }
    const d = evaluateSignal(s, { yesPrice: 0.88 })
    assert.ok(d)
    assert.equal(d!.side, 'YES')
    assert.ok(d!.edgeBps > 0)
    assert.ok(d!.impliedProb > 0.88)
  })
  test('buys NO when down is underpriced', () => {
    // pUp ~ 0.30, yesPrice 0.45 -> NO implied 0.70 vs NO market 0.55 -> 1500 bps
    const s: PriceState = { openRefPrice: 100, spot: 99.58, secondsToClose: 1, recentVolPerSec: 0.8 }
    const d = evaluateSignal(s, { yesPrice: 0.45 })
    assert.ok(d)
    assert.equal(d!.side, 'NO')
    assert.equal(d!.edgeBps, 1500)
  })
  test('returns null when there is no edge', () => {
    const s: PriceState = { openRefPrice: 100, spot: 100, secondsToClose: 4, recentVolPerSec: 1 }
    assert.equal(evaluateSignal(s, { yesPrice: 0.5 }), null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./signal`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/agent/signal.ts`:

```ts
import { normCdf } from './mathx'
import type { Side } from './window'

export interface PriceState {
  openRefPrice: number
  spot: number
  secondsToClose: number
  recentVolPerSec: number
}

export interface MarketQuote {
  yesPrice: number
}

export interface SignalDecision {
  side: Side
  impliedProb: number
  marketProb: number
  edgeBps: number
}

// Probability the price finishes on the "up" side (spot_close >= openRef),
// modeling the remaining move as Normal(0, vol * sqrt(secondsToClose)).
export function impliedProbUp(s: PriceState): number {
  const gap = s.spot - s.openRefPrice
  if (s.secondsToClose <= 0) return gap >= 0 ? 1 : 0
  const sigma = s.recentVolPerSec * Math.sqrt(s.secondsToClose)
  if (sigma <= 0) return gap >= 0 ? 1 : 0
  return normCdf(gap / sigma)
}

// Pick the side whose true probability exceeds its market price. The two
// sides' edges are exact negatives, so at most one is positive; equality
// means no edge.
export function evaluateSignal(s: PriceState, q: MarketQuote): SignalDecision | null {
  const pUp = impliedProbUp(s)
  if (pUp > q.yesPrice) {
    const edge = pUp - q.yesPrice
    return { side: 'YES', impliedProb: pUp, marketProb: q.yesPrice, edgeBps: Math.round(edge * 10000) }
  }
  const noImplied = 1 - pUp
  const noMarket = 1 - q.yesPrice
  if (noImplied > noMarket) {
    const edge = noImplied - noMarket
    return { side: 'NO', impliedProb: noImplied, marketProb: noMarket, edgeBps: Math.round(edge * 10000) }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/signal.ts packages/core/src/agent/signal.test.ts
git commit -m "feat(agent-core): last-second mispricing signal engine"
```

---

### Task 5: Execution gate

**Files:**
- Create: `packages/core/src/agent/gate.ts`
- Test: `packages/core/src/agent/gate.test.ts`

**Interfaces:**
- Consumes: `RiskPreset`, `thresholdsFor` from `./presets`; `SignalDecision` from `./signal`.
- Produces:
  - `const COOLDOWN_MS = 2000`.
  - Interface `BotState { preset: RiskPreset; paused: boolean; killed: boolean; spentTodayUsdc: number; windowsThisHour: number; lastTradeAtMs: number | null }`.
  - Interface `GateContext { secondsToClose: number; nowMs: number }`.
  - Type `GateResult = { action: 'trade'; sizeUsdc: number } | { action: 'skip'; reason: string }`.
  - `evaluateGate(bot: BotState, decision: SignalDecision, ctx: GateContext): GateResult`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/gate.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGate, COOLDOWN_MS, type BotState } from './gate'
import type { SignalDecision } from './signal'

const decision: SignalDecision = { side: 'YES', impliedProb: 0.97, marketProb: 0.88, edgeBps: 900 }
const bot = (over: Partial<BotState> = {}): BotState => ({
  preset: 'balanced', paused: false, killed: false,
  spentTodayUsdc: 0, windowsThisHour: 0, lastTradeAtMs: null, ...over,
})
const ctx = (over: Partial<{ secondsToClose: number; nowMs: number }> = {}) => ({
  secondsToClose: 3, nowMs: 1_000_000, ...over,
})

describe('evaluateGate skips', () => {
  test('killed', () => assert.deepEqual(evaluateGate(bot({ killed: true }), decision, ctx()), { action: 'skip', reason: 'killed' }))
  test('paused', () => assert.deepEqual(evaluateGate(bot({ paused: true }), decision, ctx()), { action: 'skip', reason: 'paused' }))
  test('outside act window (balanced = 7s, ctx 9s)', () =>
    assert.deepEqual(evaluateGate(bot(), decision, ctx({ secondsToClose: 9 })), { action: 'skip', reason: 'outside_act_window' }))
  test('edge below preset min (balanced = 500)', () =>
    assert.deepEqual(evaluateGate(bot(), { ...decision, edgeBps: 400 }, ctx()), { action: 'skip', reason: 'edge_below_min' }))
  test('hourly cap reached (balanced = 8)', () =>
    assert.deepEqual(evaluateGate(bot({ windowsThisHour: 8 }), decision, ctx()), { action: 'skip', reason: 'hourly_cap' }))
  test('cooldown not elapsed', () =>
    assert.deepEqual(
      evaluateGate(bot({ lastTradeAtMs: 1_000_000 - (COOLDOWN_MS - 1) }), decision, ctx()),
      { action: 'skip', reason: 'cooldown' },
    ))
  test('daily cap exhausted (balanced = 150)', () =>
    assert.deepEqual(evaluateGate(bot({ spentTodayUsdc: 150 }), decision, ctx()), { action: 'skip', reason: 'daily_cap' }))
})

describe('evaluateGate trades', () => {
  test('happy path uses full preset size (balanced maxSize 40)', () =>
    assert.deepEqual(evaluateGate(bot(), decision, ctx()), { action: 'trade', sizeUsdc: 40 }))
  test('size clamped to remaining daily room', () =>
    assert.deepEqual(evaluateGate(bot({ spentTodayUsdc: 130 }), decision, ctx()), { action: 'trade', sizeUsdc: 20 }))
  test('cooldown elapsed is fine', () =>
    assert.deepEqual(
      evaluateGate(bot({ lastTradeAtMs: 1_000_000 - COOLDOWN_MS }), decision, ctx()),
      { action: 'trade', sizeUsdc: 40 },
    ))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./gate`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/agent/gate.ts`:

```ts
import { thresholdsFor, type RiskPreset } from './presets'
import type { SignalDecision } from './signal'

export const COOLDOWN_MS = 2000

export interface BotState {
  preset: RiskPreset
  paused: boolean
  killed: boolean
  spentTodayUsdc: number
  windowsThisHour: number
  lastTradeAtMs: number | null
}

export interface GateContext {
  secondsToClose: number
  nowMs: number
}

export type GateResult = { action: 'trade'; sizeUsdc: number } | { action: 'skip'; reason: string }

export function evaluateGate(bot: BotState, decision: SignalDecision, ctx: GateContext): GateResult {
  if (bot.killed) return { action: 'skip', reason: 'killed' }
  if (bot.paused) return { action: 'skip', reason: 'paused' }

  const t = thresholdsFor(bot.preset)
  if (ctx.secondsToClose > t.actWindowSec) return { action: 'skip', reason: 'outside_act_window' }
  if (decision.edgeBps < t.minEdgeBps) return { action: 'skip', reason: 'edge_below_min' }
  if (bot.windowsThisHour >= t.maxWindowsPerHour) return { action: 'skip', reason: 'hourly_cap' }
  if (bot.lastTradeAtMs !== null && ctx.nowMs - bot.lastTradeAtMs < COOLDOWN_MS) {
    return { action: 'skip', reason: 'cooldown' }
  }

  const remaining = t.perDayCapUsdc - bot.spentTodayUsdc
  if (remaining <= 0) return { action: 'skip', reason: 'daily_cap' }

  return { action: 'trade', sizeUsdc: Math.min(t.maxSizeUsdc, remaining) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/gate.ts packages/core/src/agent/gate.test.ts
git commit -m "feat(agent-core): execution gate with risk caps and kill switches"
```

---

### Task 6: Dry-run settlement + P&L

**Files:**
- Create: `packages/core/src/agent/settle.ts`
- Test: `packages/core/src/agent/settle.test.ts`

**Interfaces:**
- Consumes: `Side`, `Outcome` from `./window`.
- Produces:
  - Type `TradeStatus = 'won' | 'lost'`.
  - Interface `Fill { side: Side; sizeUsdc: number; entryPrice: number }` (`entryPrice` in `(0, 1]`).
  - Interface `Settlement { outcome: Outcome }`.
  - Interface `TradeResult { status: TradeStatus; pnlUsdc: number }`.
  - `settleTrade(fill: Fill, s: Settlement): TradeResult`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/settle.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { settleTrade, type Fill } from './settle'

describe('settleTrade', () => {
  test('YES wins when outcome is up: profit = size*(1-entry)/entry', () => {
    const fill: Fill = { side: 'YES', sizeUsdc: 88, entryPrice: 0.88 }
    // shares = 100, payout = 100, pnl = 12.00
    assert.deepEqual(settleTrade(fill, { outcome: 'up' }), { status: 'won', pnlUsdc: 12 })
  })
  test('YES loses when outcome is down: pnl = -size', () => {
    const fill: Fill = { side: 'YES', sizeUsdc: 88, entryPrice: 0.88 }
    assert.deepEqual(settleTrade(fill, { outcome: 'down' }), { status: 'lost', pnlUsdc: -88 })
  })
  test('NO wins when outcome is down', () => {
    const fill: Fill = { side: 'NO', sizeUsdc: 55, entryPrice: 0.55 }
    // shares = 100, payout = 100, pnl = 45.00
    assert.deepEqual(settleTrade(fill, { outcome: 'down' }), { status: 'won', pnlUsdc: 45 })
  })
  test('NO loses when outcome is up', () => {
    const fill: Fill = { side: 'NO', sizeUsdc: 55, entryPrice: 0.55 }
    assert.deepEqual(settleTrade(fill, { outcome: 'up' }), { status: 'lost', pnlUsdc: -55 })
  })
  test('pnl rounded to cents', () => {
    const fill: Fill = { side: 'YES', sizeUsdc: 10, entryPrice: 0.93 }
    // pnl = 10*(0.07/0.93) = 0.752688... -> 0.75
    assert.deepEqual(settleTrade(fill, { outcome: 'up' }), { status: 'won', pnlUsdc: 0.75 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./settle`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/agent/settle.ts`:

```ts
import type { Side, Outcome } from './window'

export type TradeStatus = 'won' | 'lost'

export interface Fill {
  side: Side
  sizeUsdc: number
  entryPrice: number
}

export interface Settlement {
  outcome: Outcome
}

export interface TradeResult {
  status: TradeStatus
  pnlUsdc: number
}

const roundCents = (n: number): number => Math.round(n * 100) / 100

export function settleTrade(fill: Fill, s: Settlement): TradeResult {
  const won = (fill.side === 'YES' && s.outcome === 'up') || (fill.side === 'NO' && s.outcome === 'down')
  if (won) {
    // Each $1 share cost entryPrice and pays $1. Profit per dollar staked = (1 - entry) / entry.
    const pnl = fill.sizeUsdc * ((1 - fill.entryPrice) / fill.entryPrice)
    return { status: 'won', pnlUsdc: roundCents(pnl) }
  }
  return { status: 'lost', pnlUsdc: roundCents(-fill.sizeUsdc) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/settle.ts packages/core/src/agent/settle.test.ts
git commit -m "feat(agent-core): dry-run settlement and P&L"
```

---

### Task 7: Per-tick orchestrator + package barrel

**Files:**
- Create: `packages/core/src/agent/evaluate.ts`
- Create: `packages/core/src/agent/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/agent/evaluate.test.ts`

**Interfaces:**
- Consumes: `MarketWindow` from `./window`; `PriceState`, `MarketQuote`, `SignalDecision`, `evaluateSignal` from `./signal`; `BotState`, `GateResult`, `evaluateGate` from `./gate`.
- Produces:
  - Interface `WindowTick { window: MarketWindow; price: PriceState; quote: MarketQuote; bot: BotState; nowMs: number }`.
  - Interface `TickOutcome { decision: SignalDecision | null; gate: GateResult | null }`.
  - `evaluateTick(t: WindowTick): TickOutcome`.
  - `packages/core/src/agent/index.ts` re-exports every agent module.
  - `packages/core/src/index.ts` re-exports `./agent`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/evaluate.test.ts`:

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateTick, type WindowTick } from './evaluate'
import type { MarketWindow } from './window'
import type { BotState } from './gate'

const window: MarketWindow = {
  venue: 'polymarket', asset: 'BTC', intervalSec: 300,
  opensAt: 0, closesAt: 300_000, referenceOracle: 'chainlink:BTC-USD',
  openRefPrice: 100, settleRefPrice: null,
}
const bot: BotState = {
  preset: 'balanced', paused: false, killed: false,
  spentTodayUsdc: 0, windowsThisHour: 0, lastTradeAtMs: null,
}

describe('evaluateTick', () => {
  test('edge present + within gate -> decision and trade', () => {
    const t: WindowTick = {
      window,
      price: { openRefPrice: 100, spot: 103, secondsToClose: 1, recentVolPerSec: 0.8 },
      quote: { yesPrice: 0.85 },
      bot,
      nowMs: 299_000,
    }
    const out = evaluateTick(t)
    assert.equal(out.decision?.side, 'YES')
    assert.equal(out.gate?.action, 'trade')
  })

  test('no edge -> both null', () => {
    const t: WindowTick = {
      window,
      price: { openRefPrice: 100, spot: 100, secondsToClose: 4, recentVolPerSec: 1 },
      quote: { yesPrice: 0.5 },
      bot,
      nowMs: 296_000,
    }
    assert.deepEqual(evaluateTick(t), { decision: null, gate: null })
  })

  test('edge present but gate skips (paused)', () => {
    const t: WindowTick = {
      window,
      price: { openRefPrice: 100, spot: 103, secondsToClose: 1, recentVolPerSec: 0.8 },
      quote: { yesPrice: 0.85 },
      bot: { ...bot, paused: true },
      nowMs: 299_000,
    }
    const out = evaluateTick(t)
    assert.ok(out.decision)
    assert.deepEqual(out.gate, { action: 'skip', reason: 'paused' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sneakers/core test`
Expected: FAIL — cannot find module `./evaluate`.

- [ ] **Step 3: Write the orchestrator**

Create `packages/core/src/agent/evaluate.ts`:

```ts
import type { MarketWindow } from './window'
import { evaluateSignal, type PriceState, type MarketQuote, type SignalDecision } from './signal'
import { evaluateGate, type BotState, type GateResult } from './gate'

export interface WindowTick {
  window: MarketWindow
  price: PriceState
  quote: MarketQuote
  bot: BotState
  nowMs: number
}

export interface TickOutcome {
  decision: SignalDecision | null
  gate: GateResult | null
}

export function evaluateTick(t: WindowTick): TickOutcome {
  const decision = evaluateSignal(t.price, t.quote)
  if (!decision) return { decision: null, gate: null }
  const gate = evaluateGate(t.bot, decision, { secondsToClose: t.price.secondsToClose, nowMs: t.nowMs })
  return { decision, gate }
}
```

- [ ] **Step 4: Write the agent barrel**

Create `packages/core/src/agent/index.ts`:

```ts
export * from './window'
export * from './presets'
export * from './mathx'
export * from './signal'
export * from './gate'
export * from './settle'
export * from './evaluate'
```

- [ ] **Step 5: Re-export agent from the package root**

Replace the contents of `packages/core/src/index.ts` with (preserve any existing exports by appending this line if the file is non-empty):

```ts
export * from './agent'
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm --filter @sneakers/core test`
Expected: PASS — all files (`window`, `presets`, `mathx`, `signal`, `gate`, `settle`, `evaluate`) green.

- [ ] **Step 7: Typecheck the package**

Run: `pnpm --filter @sneakers/core build`
Expected: `tsc` exits 0 with no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/agent/evaluate.ts packages/core/src/agent/evaluate.test.ts packages/core/src/agent/index.ts packages/core/src/index.ts
git commit -m "feat(agent-core): per-tick orchestrator + package exports"
```

---

## Self-Review

**Spec coverage (Rung 1 deterministic core):**
- Per-window model → Task 1 ✅
- 5 risk presets (Bunker→Max, spec-fixed edge/act-window) → Task 2 ✅
- Last-second mispricing signal + implied prob (conservative vol model) → Tasks 3–4 ✅
- Execution gate: act window, min edge, hourly cap, cooldown, daily-loss cap, kill/pause → Task 5 ✅
- Dry-run settlement marked to real outcome with real P&L → Task 6 ✅
- Orchestration of signal→gate for one window tick → Task 7 ✅
- Out of scope here (later plans): DB migration + persistence, live PM/Kalshi/spot feeds, Railway worker runtime, `/agent` route, circuit-breaker side effects, per-day/hour counter resets (the worker owns counter state; core reads it via `BotState`).

**Placeholder scan:** none — every step has complete code and exact commands.

**Type consistency:** `Side`/`Outcome` defined once in `window.ts` and imported by `signal.ts`/`settle.ts`. `SignalDecision` defined in `signal.ts`, consumed by `gate.ts`/`evaluate.ts`. `BotState`/`GateResult` defined in `gate.ts`, consumed by `evaluate.ts`. `thresholdsFor`/`RiskThresholds` field names (`minEdgeBps`, `actWindowSec`, `maxSizeUsdc`, `perDayCapUsdc`, `maxWindowsPerHour`) are identical across Tasks 2 and 5. `evaluateTick` passes `secondsToClose` from `price.secondsToClose` (consistent with `PriceState`). Consistent.
