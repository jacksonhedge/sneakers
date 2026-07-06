# Agent Web Shell (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4-tab agent experience (Agent orbs / Models + Add Agent / Balance / Profile) as an `/agent` route group in `apps/platform`, pixel-matched to `docs/prototypes/sneakers-app-prototype.html`, running on a mock in-browser engine so it is fully demoable before the API exists.

**Architecture:** A server layout handles auth and wraps a client-side store (React context over a pure, unit-tested reducer). Four client pages share that store; all interactivity (subscribe → equip → create-agent → deposit) mutates reducer state. The mock engine's shape mirrors the future `/api/agent/*` contract exactly, so Phase 2 swaps the store's data source without touching components.

**Tech Stack:** Next 16 App Router, React 19, TypeScript, Tailwind v4 present but agent UI uses a scoped plain-CSS token sheet (ports the prototype), vitest (added to platform) for the pure logic.

**Spec:** `docs/superpowers/specs/2026-07-06-agent-experience-design.md`
**Visual source of truth:** `docs/prototypes/sneakers-app-prototype.html`

## Global Constraints

- Never use "scrape"/"scraper" in user-facing copy — say "live prices", "live data".
- `PAPER` badge visible on Agent and Models headers; Balance shows `STRIPE TEST`.
- All money text uses `font-variant-numeric: tabular-nums`; cents stored as integers.
- All orb/sheet animation respects `prefers-reduced-motion: reduce`.
- Design tokens (from prototype): surface `#0B0D10`, card `#14181D`, border `#1e242a`, ink `#F2F5F3`, secondary `#98A2A8`, green `#2FD37A`, red `#FF5C5C` (negatives only), OddsJam blue `#18AFE8`, Gambly green `#3ee06e`. Font: `-apple-system` stack inside the agent frame.
- File names kebab-case; components colocated under `src/app/agent/` (matches `dashboard/` pattern).
- Commit after every task; prefix `feat(agent-web):`.
- Run all workspace commands from the repo root (`~/sneakers-trading`).

---

### Task 1: Vitest in platform + agent lib types & formatters

**Files:**
- Modify: `apps/platform/package.json` (add vitest devDep + test script)
- Create: `apps/platform/vitest.config.ts`
- Create: `apps/platform/src/app/agent/lib/types.ts`
- Create: `apps/platform/src/app/agent/lib/format.ts`
- Test: `apps/platform/src/app/agent/lib/format.test.ts`

**Interfaces:**
- Produces: all types below (used by every later task); `formatMoney(cents: number): string`, `formatMoneyWhole(cents: number): string`, `formatSigned(cents: number): string`, `formatPerf(perf30d: number | null): string`.

- [ ] **Step 1: Install vitest and add the test script**

```bash
pnpm add -D vitest --filter @sneakers/platform
```

Then in `apps/platform/package.json` scripts add:

```json
"test": "vitest run"
```

- [ ] **Step 2: Create `apps/platform/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/app/agent/lib/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 3: Create `src/app/agent/lib/types.ts`**

```ts
export type OrbColor =
  | 'green' | 'blue' | 'purple' | 'gold' | 'red' | 'cyan'
  | 'updown' | 'oddsjam' | 'gambly'

export type AgentPhase = 'scanning' | 'entering' | 'holding'
export type ModelStatus = 'live' | 'review' | 'coming_soon' | 'private'
export type Venue = 'kalshi' | 'polymarket' | 'prophetx'

export interface AgentModel {
  id: string
  name: string
  color: OrbColor
  emoji?: string
  /** partner logo baked into the orb via CSS class; no emoji when set */
  brand?: 'oddsjam' | 'gambly'
  by: string
  /** 30-day paper performance in percent, e.g. 14.6; null = no metrics shown */
  perf30d: number | null
  runners: number
  priceCents: number | null
  /** overrides "$X/mo" display, e.g. "From $1 per day" */
  priceLabel?: string
  tagline?: string
  description: string
  featured?: boolean
  included?: boolean
  mine?: boolean
  status: ModelStatus
  kind: 'prompt' | 'connected'
}

export interface Decision {
  id: string
  venue: Venue
  action: 'settled' | 'entered' | 'passed'
  title: string
  detail: string
  pnlCents: number | null
  at: string
}

export interface LedgerEntry {
  id: string
  kind: 'deposit' | 'withdraw' | 'settlement' | 'starting'
  label: string
  detail: string
  amountCents: number
  at: string
}

export interface CreateAgentInput {
  name: string
  emoji: string
  color: OrbColor
  kind: 'prompt' | 'connected'
  prompt?: string
  endpointUrl?: string
  apiKey?: string
}
```

- [ ] **Step 4: Write the failing formatter test — `src/app/agent/lib/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { formatMoney, formatMoneyWhole, formatSigned, formatPerf } from './format'

describe('format', () => {
  it('formats cents as dollars', () => {
    expect(formatMoney(124762)).toBe('$1,247.62')
    expect(formatMoney(0)).toBe('$0.00')
  })
  it('formats whole-dollar for the tab bar', () => {
    expect(formatMoneyWhole(124762)).toBe('$1,248')
  })
  it('formats signed money', () => {
    expect(formatSigned(3814)).toBe('+$38.14')
    expect(formatSigned(-1248)).toBe('−$12.48')
  })
  it('formats perf or em-dash', () => {
    expect(formatPerf(14.6)).toBe('+14.6%')
    expect(formatPerf(null)).toBe('—')
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm --filter @sneakers/platform test`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 6: Implement `src/app/agent/lib/format.ts`**

```ts
export function formatMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMoneyWhole(cents: number): string {
  return '$' + Math.round(cents / 100).toLocaleString('en-US')
}

export function formatSigned(cents: number): string {
  const sign = cents < 0 ? '−' : '+'
  return sign + formatMoney(Math.abs(cents))
}

export function formatPerf(perf30d: number | null): string {
  if (perf30d === null) return '—'
  return (perf30d >= 0 ? '+' : '') + perf30d + '%'
}
```

- [ ] **Step 7: Run to verify pass**

Run: `pnpm --filter @sneakers/platform test`
Expected: 4 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/platform/package.json apps/platform/vitest.config.ts apps/platform/src/app/agent/lib pnpm-lock.yaml
git commit -m "feat(agent-web): agent lib types, formatters, vitest in platform"
```

---

### Task 2: Model catalog + partner logo assets

**Files:**
- Create: `apps/platform/public/agents/oddsjam.png` (from `~/Downloads/OddsJam.png`)
- Create: `apps/platform/public/agents/gambly.jpg` (from `~/Downloads/Gambly.jpg`)
- Create: `apps/platform/src/app/agent/lib/catalog.ts`
- Test: `apps/platform/src/app/agent/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `AgentModel` from Task 1.
- Produces: `CATALOG: AgentModel[]` (carousel order), `marketplaceModels(models: AgentModel[]): AgentModel[]` (grid order: featured first, stable), `VENUE_META: Record<Venue, { label: string; abbr: string; bg: string }>`.

- [ ] **Step 1: Resize logo assets into public/**

```bash
mkdir -p apps/platform/public/agents
sips -z 320 320 ~/Downloads/OddsJam.png --out apps/platform/public/agents/oddsjam.png
sips -z 320 320 -s format jpeg -s formatOptions 80 ~/Downloads/Gambly.jpg --out apps/platform/public/agents/gambly.jpg
```

Expected: both files exist, < 40 KB each (`ls -la apps/platform/public/agents`).

- [ ] **Step 2: Write the failing catalog test — `catalog.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { CATALOG, marketplaceModels } from './catalog'

describe('catalog', () => {
  it('has unique ids', () => {
    const ids = CATALOG.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('starts the carousel with the equipped flagship Up/Down', () => {
    expect(CATALOG[0].id).toBe('updown')
    expect(CATALOG[0].included).toBe(true)
  })
  it('orders the marketplace featured-first, excluding my models', () => {
    const ids = marketplaceModels(CATALOG).map(m => m.id)
    expect(ids).toEqual(['oddsjam', 'gambly', 'updown', 'wave', 'drift', 'sniper', 'news'])
  })
  it('partner cards carry no metrics but do carry taglines', () => {
    for (const id of ['oddsjam', 'gambly']) {
      const m = CATALOG.find(x => x.id === id)!
      expect(m.perf30d).toBeNull()
      expect(m.tagline).toBeTruthy()
      expect(m.featured).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Run to verify fail** — `pnpm --filter @sneakers/platform test` → FAIL (no catalog module).

- [ ] **Step 4: Implement `catalog.ts`** (content mirrors the prototype MODELS array)

```ts
import type { AgentModel, Venue } from './types'

export const CATALOG: AgentModel[] = [
  {
    id: 'updown', name: 'Up/Down', color: 'updown', emoji: '🎢', by: 'Sneakers Labs',
    perf30d: 14.6, runners: 2340, priceCents: null, included: true, featured: false,
    status: 'live', kind: 'prompt',
    description: 'The flagship. Trades every Bitcoin and crypto up/down market on Kalshi and Polymarket — 5 and 15-minute windows, both directions. Included with your Sneakers plan.',
  },
  {
    id: 'longshot', name: 'Longshot v3', color: 'green', emoji: '🐎', by: 'you',
    perf30d: 9.4, runners: 1, priceCents: null, mine: true, status: 'private', kind: 'prompt',
    description: 'Your model. Trades 5 & 15-minute crypto windows, favoring longshots priced 10–35¢ with momentum confirmation. Max 5% of bankroll per trade.',
  },
  {
    id: 'oddsjam', name: 'OddsJam', color: 'oddsjam', brand: 'oddsjam', by: 'OddsJam',
    perf30d: null, runners: 0, priceCents: 1999, priceLabel: 'From $1 per day',
    featured: true, status: 'live', kind: 'connected',
    tagline: 'The best sports/predictions agent',
    description: 'The best sports & predictions agent. Powered by OddsJam’s live odds data across every major sportsbook and prediction market — finds +EV lines and trades them for you.',
  },
  {
    id: 'gambly', name: 'Gambly', color: 'gambly', brand: 'gambly', by: 'Gambly.com',
    perf30d: null, runners: 0, priceCents: 1499, featured: true, status: 'live', kind: 'connected',
    tagline: 'Gambly.com’s official agent',
    description: 'Gambly.com’s official trading agent. Brings Gambly’s picks and community signal straight to your bankroll — it plays, you watch the balance.',
  },
  {
    id: 'wave', name: 'Wave Rider', color: 'blue', emoji: '🏄', by: 'Sneakers Labs',
    perf30d: 18.2, runners: 1204, priceCents: 999, status: 'live', kind: 'prompt',
    description: 'Rides momentum across consecutive 5-minute windows. Enters on book imbalance, exits into strength. Best in trending sessions.',
  },
  {
    id: 'drift', name: 'Overnight Drift', color: 'purple', emoji: '🦉', by: 'Sneakers Labs',
    perf30d: 11.7, runners: 862, priceCents: 499, status: 'live', kind: 'prompt',
    description: 'Trades the quiet hours — fades overreactions on low-liquidity overnight windows when spreads widen.',
  },
  {
    id: 'sniper', name: 'Cent Sniper', color: 'gold', emoji: '🎯', by: '@quantfrat',
    perf30d: 8.9, runners: 315, priceCents: 299, status: 'live', kind: 'prompt',
    description: 'Hunts mispriced 1–5¢ tails minutes before settle. Small size, high frequency, strict loss ceiling.',
  },
  {
    id: 'news', name: 'News Reactor', color: 'red', emoji: '🗞️', by: 'community',
    perf30d: null, runners: 0, priceCents: null, status: 'review', kind: 'prompt',
    description: 'Reacts to headline momentum within seconds. Currently in review — subscribable once it clears the vetting run.',
  },
]

export function marketplaceModels(models: AgentModel[]): AgentModel[] {
  return models
    .filter(m => !m.mine)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
}

export const VENUE_META: Record<Venue, { label: string; abbr: string; bg: string }> = {
  kalshi:     { label: 'Kalshi',     abbr: 'K',  bg: '#2FD37A' },
  polymarket: { label: 'Polymarket', abbr: 'P',  bg: '#8fb0ff' },
  prophetx:   { label: 'ProphetX',   abbr: 'Px', bg: '#e3c56b' },
}
```

- [ ] **Step 5: Run to verify pass** — `pnpm --filter @sneakers/platform test` → all passing.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/public/agents apps/platform/src/app/agent/lib
git commit -m "feat(agent-web): model catalog + partner logo assets"
```

---

### Task 3: Mock engine — pure reducer + status machine

**Files:**
- Create: `apps/platform/src/app/agent/lib/engine.ts`
- Test: `apps/platform/src/app/agent/lib/engine.test.ts`

**Interfaces:**
- Consumes: `CATALOG` (Task 2), types (Task 1).
- Produces (used by the store in Task 4 and all pages):

```ts
interface AgentUIState {
  models: AgentModel[]; equippedId: string; subscribedIds: string[]
  paused: boolean; tick: number; balanceCents: number
  decisions: Decision[]; ledger: LedgerEntry[]; spark: number[]; customCount: number
}
type AgentAction =
  | { type: 'subscribe'; id: string } | { type: 'equip'; id: string }
  | { type: 'togglePaused' } | { type: 'tick' }
  | { type: 'deposit'; cents: number }
  | { type: 'createAgent'; input: CreateAgentInput }
initialState(): AgentUIState
agentReducer(s: AgentUIState, a: AgentAction): AgentUIState
isOwned(s: AgentUIState, id: string): boolean
currentStatus(s: AgentUIState): { phase: AgentPhase | 'paused'; title: string; sub: string }
todayPnlCents(s: AgentUIState): number
```

- [ ] **Step 1: Write the failing engine test — `engine.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { initialState, agentReducer, isOwned, currentStatus, todayPnlCents } from './engine'

describe('engine', () => {
  it('starts equipped with updown, unpaused, seeded balance', () => {
    const s = initialState()
    expect(s.equippedId).toBe('updown')
    expect(s.paused).toBe(false)
    expect(s.balanceCents).toBe(124762)
    expect(isOwned(s, 'updown')).toBe(true)   // included
    expect(isOwned(s, 'longshot')).toBe(true) // mine
    expect(isOwned(s, 'wave')).toBe(false)
  })
  it('subscribe marks owned; equip auto-subscribes', () => {
    let s = agentReducer(initialState(), { type: 'subscribe', id: 'wave' })
    expect(isOwned(s, 'wave')).toBe(true)
    s = agentReducer(initialState(), { type: 'equip', id: 'drift' })
    expect(s.equippedId).toBe('drift')
    expect(isOwned(s, 'drift')).toBe(true)
  })
  it('cannot equip a model in review', () => {
    const s = agentReducer(initialState(), { type: 'equip', id: 'news' })
    expect(s.equippedId).toBe('updown')
  })
  it('tick advances the status machine; paused freezes it', () => {
    const s0 = initialState()
    const s1 = agentReducer(s0, { type: 'tick' })
    expect(currentStatus(s1).title).not.toBe(currentStatus(s0).title)
    const p = agentReducer(s0, { type: 'togglePaused' })
    expect(currentStatus(p).phase).toBe('paused')
    expect(agentReducer(p, { type: 'tick' }).tick).toBe(p.tick)
  })
  it('deposit grows balance and prepends ledger + spark', () => {
    const s = agentReducer(initialState(), { type: 'deposit', cents: 10000 })
    expect(s.balanceCents).toBe(134762)
    expect(s.ledger[0].kind).toBe('deposit')
    expect(s.spark[s.spark.length - 1]).toBe(134762)
  })
  it('createAgent appends an owned private model and can default the name', () => {
    const s = agentReducer(initialState(), {
      type: 'createAgent',
      input: { name: '', emoji: '🤖', color: 'cyan', kind: 'prompt', prompt: 'buy dips' },
    })
    const m = s.models[s.models.length - 1]
    expect(m.name).toBe('My Agent 1')
    expect(m.status).toBe('private')
    expect(isOwned(s, m.id)).toBe(true)
  })
  it('derives today P&L from settled decisions', () => {
    expect(todayPnlCents(initialState())).toBe(3580) // +$21.60 + $14.20 seeds
  })
})
```

- [ ] **Step 2: Run to verify fail** — `pnpm --filter @sneakers/platform test` → FAIL (no engine module).

- [ ] **Step 3: Implement `engine.ts`**

```ts
import type { AgentModel, AgentPhase, CreateAgentInput, Decision, LedgerEntry } from './types'
import { CATALOG } from './catalog'

export interface AgentUIState {
  models: AgentModel[]
  equippedId: string
  subscribedIds: string[]
  paused: boolean
  tick: number
  balanceCents: number
  decisions: Decision[]
  ledger: LedgerEntry[]
  spark: number[]
  customCount: number
}

export type AgentAction =
  | { type: 'subscribe'; id: string }
  | { type: 'equip'; id: string }
  | { type: 'togglePaused' }
  | { type: 'tick' }
  | { type: 'deposit'; cents: number }
  | { type: 'createAgent'; input: CreateAgentInput }

const PHASES: { phase: AgentPhase; title: string; sub: string }[] = [
  { phase: 'scanning', title: 'Scanning 14 markets', sub: 'BTC · ETH · SOL — 5 & 15-min windows on Kalshi + Polymarket' },
  { phase: 'entering', title: 'Entering position', sub: 'ETH above $3,410 at 2:30p · buying Yes at 27¢' },
  { phase: 'holding',  title: 'Holding 2 positions', sub: 'Next settle in 4m 12s' },
  { phase: 'scanning', title: 'Scanning 14 markets', sub: 'Last window: +$21.60 · 12 trades today' },
]

const SEED_DECISIONS: Decision[] = [
  { id: 'd1', venue: 'kalshi', action: 'settled', title: 'Settled: BTC above $109,250 at 2:15p — Yes hit', detail: 'Kalshi · +$21.60 · 2:15 PM', pnlCents: 2160, at: '2026-07-06T14:15:00Z' },
  { id: 'd2', venue: 'polymarket', action: 'entered', title: 'Entered ETH above $3,410 at 2:30p · 27¢ × 80', detail: 'Polymarket · momentum + book imbalance · 2:11 PM', pnlCents: null, at: '2026-07-06T14:11:00Z' },
  { id: 'd3', venue: 'prophetx', action: 'settled', title: 'Settled: Thunder −4.5 vs Pacers — covered', detail: 'ProphetX · +$14.20 · 1:48 PM', pnlCents: 1420, at: '2026-07-06T13:48:00Z' },
  { id: 'd4', venue: 'kalshi', action: 'passed', title: 'Passed on SOL range 2:15p — spread too wide', detail: 'Kalshi · gate: liquidity floor · 2:08 PM', pnlCents: null, at: '2026-07-06T14:08:00Z' },
]

const SEED_LEDGER: LedgerEntry[] = [
  { id: 'l1', kind: 'settlement', label: 'Trade settlements (12)', detail: 'Today', amountCents: 3814, at: '2026-07-06' },
  { id: 'l2', kind: 'deposit', label: 'Added cash', detail: 'Jul 3 · Visa ··4242', amountCents: 50000, at: '2026-07-03' },
  { id: 'l3', kind: 'settlement', label: 'Trade settlements (31)', detail: 'Jul 1 – Jul 2', amountCents: -1248, at: '2026-07-02' },
  { id: 'l4', kind: 'starting', label: 'Starting balance', detail: 'Jun 30', amountCents: 72196, at: '2026-06-30' },
]

export function initialState(): AgentUIState {
  return {
    models: [...CATALOG],
    equippedId: 'updown',
    subscribedIds: [],
    paused: false,
    tick: 0,
    balanceCents: 124762,
    decisions: SEED_DECISIONS,
    ledger: SEED_LEDGER,
    spark: [72196, 74820, 73110, 81240, 129870, 128620, 120948, 124762],
    customCount: 0,
  }
}

export function isOwned(s: AgentUIState, id: string): boolean {
  const m = s.models.find(x => x.id === id)
  if (!m) return false
  return Boolean(m.mine || m.included || s.subscribedIds.includes(id))
}

export function currentStatus(s: AgentUIState): { phase: AgentPhase | 'paused'; title: string; sub: string } {
  if (s.paused) {
    return { phase: 'paused', title: 'Paused', sub: 'The agent will not enter new positions.' }
  }
  return PHASES[s.tick % PHASES.length]
}

export function todayPnlCents(s: AgentUIState): number {
  return s.decisions.reduce((sum, d) => sum + (d.pnlCents ?? 0), 0)
}

export function agentReducer(s: AgentUIState, a: AgentAction): AgentUIState {
  switch (a.type) {
    case 'subscribe': {
      if (isOwned(s, a.id)) return s
      return { ...s, subscribedIds: [...s.subscribedIds, a.id] }
    }
    case 'equip': {
      const m = s.models.find(x => x.id === a.id)
      if (!m || m.status === 'review' || m.status === 'coming_soon') return s
      const owned = isOwned(s, a.id)
      return {
        ...s,
        equippedId: a.id,
        paused: false,
        subscribedIds: owned ? s.subscribedIds : [...s.subscribedIds, a.id],
      }
    }
    case 'togglePaused':
      return { ...s, paused: !s.paused }
    case 'tick':
      return s.paused ? s : { ...s, tick: s.tick + 1 }
    case 'deposit': {
      const balanceCents = s.balanceCents + a.cents
      const entry: LedgerEntry = {
        id: 'dep-' + (s.ledger.length + 1), kind: 'deposit', label: 'Added cash',
        detail: 'Just now · Visa ··4242 (test)', amountCents: a.cents, at: new Date().toISOString(),
      }
      return { ...s, balanceCents, ledger: [entry, ...s.ledger], spark: [...s.spark, balanceCents] }
    }
    case 'createAgent': {
      const n = s.customCount + 1
      const model: AgentModel = {
        id: 'custom-' + n,
        name: a.input.name.trim() || 'My Agent ' + n,
        color: a.input.color,
        emoji: a.input.emoji,
        by: 'you',
        perf30d: null,
        runners: 1,
        priceCents: null,
        mine: true,
        status: 'private',
        kind: a.input.kind,
        description:
          a.input.kind === 'connected'
            ? 'Your connected bot. We send it market signals; it returns orders. Trading your paper balance while in review for the marketplace.'
            : (a.input.prompt?.trim() || 'Your prompt-built agent, running on the Sneakers worker against your paper balance.'),
      }
      return { ...s, models: [...s.models, model], customCount: n }
    }
  }
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @sneakers/platform test` → all passing.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/agent/lib
git commit -m "feat(agent-web): pure mock engine (reducer + status machine) with tests"
```

---

### Task 4: Route scaffold — auth layout, store provider, frame, tab bar, stub pages

**Files:**
- Create: `apps/platform/src/app/agent/layout.tsx`
- Create: `apps/platform/src/app/agent/agent.css`
- Create: `apps/platform/src/app/agent/lib/store.tsx`
- Create: `apps/platform/src/app/agent/components/agent-frame.tsx`
- Create: `apps/platform/src/app/agent/components/tab-bar.tsx`
- Create: `apps/platform/src/app/agent/page.tsx` (stub, replaced in Task 6)
- Create: `apps/platform/src/app/agent/models/page.tsx` (stub, replaced in Task 8)
- Create: `apps/platform/src/app/agent/balance/page.tsx` (stub, replaced in Task 9)
- Create: `apps/platform/src/app/agent/profile/page.tsx` (stub, replaced in Task 10)

**Interfaces:**
- Consumes: engine (Task 3), formatters (Task 1).
- Produces: `useAgent()` hook returning `{ state, status, todayPnl, owned(id), dispatch }` where `status = currentStatus(state)`, `todayPnl = todayPnlCents(state)`, `owned(id) = isOwned(state, id)`. All page tasks consume exactly this.

- [ ] **Step 1: Create `lib/store.tsx`**

```tsx
'use client'
import { createContext, useContext, useEffect, useReducer } from 'react'
import { agentReducer, currentStatus, initialState, isOwned, todayPnlCents } from './engine'
import type { AgentAction, AgentUIState } from './engine'

interface AgentCtx {
  state: AgentUIState
  status: ReturnType<typeof currentStatus>
  todayPnl: number
  owned: (id: string) => boolean
  dispatch: (a: AgentAction) => void
}

const Ctx = createContext<AgentCtx | null>(null)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, undefined, initialState)

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick' }), 4500)
    return () => clearInterval(id)
  }, [])

  return (
    <Ctx.Provider
      value={{
        state,
        status: currentStatus(state),
        todayPnl: todayPnlCents(state),
        owned: id => isOwned(state, id),
        dispatch,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAgent(): AgentCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAgent outside AgentProvider')
  return ctx
}
```

- [ ] **Step 2: Create `agent.css`** — tokens + frame + shared pieces (ported from the prototype; class names are renamed `c-*` → `orb--*` later in Task 5)

```css
/* Agent app — scoped design tokens (see docs/prototypes/sneakers-app-prototype.html) */
.agent-app {
  --ag-surface: #0B0D10;
  --ag-card: #14181D;
  --ag-border: #1e242a;
  --ag-ink: #F2F5F3;
  --ag-sub: #98A2A8;
  --ag-green: #2FD37A;
  --ag-red: #FF5C5C;
  --ag-oddsjam: #18AFE8;
  --ag-gambly: #3ee06e;

  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  background: var(--ag-surface);
  color: var(--ag-ink);
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
/* Desktop: centered phone-width column, like the prototype */
@media (min-width: 700px) {
  .agent-app { max-width: 430px; margin: 0 auto; border-left: 1px solid var(--ag-border); border-right: 1px solid var(--ag-border); }
}
.agent-main { flex: 1; overflow-y: auto; padding: 10px 20px 18px; }
.ag-num { font-variant-numeric: tabular-nums; }
.ag-pos { color: var(--ag-green); }
.ag-neg { color: var(--ag-red); }
.ag-card { background: var(--ag-card); border: 1px solid var(--ag-border); border-radius: 18px; padding: 16px; margin-bottom: 12px; }
.ag-sechead { font-size: 12px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: var(--ag-sub); margin: 18px 2px 10px; }
.ag-sub { font-size: 12.5px; color: var(--ag-sub); line-height: 1.45; }
.ag-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ag-apphead { display: flex; align-items: center; justify-content: space-between; padding: 6px 2px 14px; }
.ag-brand { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.ag-badge { font-size: 10px; font-weight: 700; letter-spacing: .1em; padding: 4px 9px; border-radius: 99px; }
.ag-badge--paper { color: var(--ag-surface); background: var(--ag-green); }
.ag-badge--test { color: #8fd7ff; background: rgba(78,168,255,.14); border: 1px solid rgba(78,168,255,.35); letter-spacing: .06em; }
.ag-pill { font-family: inherit; border: none; cursor: pointer; border-radius: 14px; font-weight: 600; font-size: 15px; padding: 14px 0; flex: 1; letter-spacing: -0.01em; }
.ag-pill--primary { background: var(--ag-green); color: var(--ag-surface); }
.ag-pill--ghost { background: #1a2026; color: #fff; }
.ag-pill:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.ag-linkish { font-family: inherit; background: none; border: 1px solid #2a323a; color: var(--ag-ink); font-size: 12px; font-weight: 600; border-radius: 99px; padding: 7px 13px; cursor: pointer; }

/* tab bar */
.ag-tabbar { flex-shrink: 0; display: flex; padding: 8px 10px calc(10px + env(safe-area-inset-bottom)); gap: 4px; background: rgba(16,19,23,.92); border-top: 1px solid #1c2126; backdrop-filter: blur(12px); position: sticky; bottom: 0; }
.ag-tabbtn { flex: 1; background: none; border: none; color: #fff; font-family: inherit; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; padding: 6px 0 2px; cursor: pointer; border-radius: 12px; text-decoration: none; }
.ag-tabbtn svg { width: 24px; height: 24px; }
.ag-tabbtn .ag-tabnum { height: 24px; display: flex; align-items: center; font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.ag-tabbtn--on { color: var(--ag-green); }
.ag-tabbtn:focus-visible { outline: 2px solid var(--ag-green); outline-offset: -2px; }
```

- [ ] **Step 3: Create `components/tab-bar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAgent } from '../lib/store'
import { formatMoneyWhole } from '../lib/format'

const ORB_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
  </svg>
)
const MODELS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 17l5-5 4 3 7-8" /><path d="M16 7h4v4" />
  </svg>
)
const PROFILE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.4-3.2 4-4.8 7-4.8s5.6 1.6 7 4.8" />
  </svg>
)

export function TabBar() {
  const path = usePathname()
  const { state } = useAgent()
  const tabs = [
    { href: '/agent', label: 'Agent', icon: ORB_ICON },
    { href: '/agent/models', label: 'Models', icon: MODELS_ICON },
    { href: '/agent/balance', label: 'Balance', icon: <span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span> },
    { href: '/agent/profile', label: 'Profile', icon: PROFILE_ICON },
  ]
  return (
    <nav className="ag-tabbar" role="tablist">
      {tabs.map(t => (
        <Link key={t.href} href={t.href} role="tab"
          aria-selected={path === t.href}
          className={'ag-tabbtn' + (path === t.href ? ' ag-tabbtn--on' : '')}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Create `components/agent-frame.tsx`**

```tsx
'use client'
import { TabBar } from './tab-bar'

export function AgentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="agent-app">
      <main className="agent-main">{children}</main>
      <TabBar />
    </div>
  )
}
```

- [ ] **Step 5: Create `layout.tsx`** (auth mirrors `dashboard/layout.tsx`; `AGENT_PREVIEW=1` bypass is for local visual QA only — a server env var, never set in Vercel)

```tsx
import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { AgentProvider } from './lib/store'
import { AgentFrame } from './components/agent-frame'
import './agent.css'

export const dynamic = 'force-dynamic'

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  if (process.env.AGENT_PREVIEW !== '1') {
    const supabase = await getAuthClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) redirect('/login')
  }
  return (
    <AgentProvider>
      <AgentFrame>{children}</AgentFrame>
    </AgentProvider>
  )
}
```

- [ ] **Step 6: Create the four stub pages** — identical shape, e.g. `page.tsx`:

```tsx
'use client'
export default function AgentTab() {
  return (
    <div className="ag-apphead">
      <span className="ag-brand">Sneakers</span>
      <span className="ag-badge ag-badge--paper">PAPER</span>
    </div>
  )
}
```

`models/page.tsx` uses brand `Models` (+ PAPER badge), `balance/page.tsx` brand `Funds` with `<span className="ag-badge ag-badge--test">STRIPE TEST</span>`, `profile/page.tsx` brand `Profile` with no badge.

- [ ] **Step 7: Verify it renders**

```bash
AGENT_PREVIEW=1 pnpm platform &
sleep 8
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --window-size=430,900 --virtual-time-budget=4000 \
  --screenshot=/tmp/agent-shell.png http://localhost:3000/agent
```

Expected: dark frame, "Sneakers / PAPER" header, 4-item tab bar with a white `$1,248` on the Balance tab. Check the screenshot; tab links navigate between stubs. Kill the dev server after.

- [ ] **Step 8: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): /agent route scaffold — auth layout, store, frame, tab bar"
```

---

### Task 5: Orb component (living sphere, all variants)

**Files:**
- Create: `apps/platform/src/app/agent/components/orb.tsx`
- Modify: `apps/platform/src/app/agent/agent.css` (append orb rules)

**Interfaces:**
- Consumes: `OrbColor` (Task 1).
- Produces: `<Orb color emoji? size live? paused? phase? />` with props
  `{ color: OrbColor; emoji?: string; size: number; live?: boolean; paused?: boolean; phase?: 'scanning' | 'entering' | 'holding' }` — used by Tasks 6, 7, 8. Partner logos are selected by `color` (`oddsjam`/`gambly` classes carry the logo background); no separate brand prop.

- [ ] **Step 1: Append orb CSS to `agent.css`** (port of prototype `.orb` block; `c-*` classes become `orb--*`; partner logos load from `/agents/*` instead of data URIs)

```css
/* ---- orb: living sphere ---- */
.orb { position: relative;
  --o1:#b8ffd9; --o2:#2FD37A; --o3:#1a9e97; --o4:#0d5f74; --halo:rgba(47,211,122,.35); }
.orb--blue   { --o1:#d3e7ff; --o2:#4EA8FF; --o3:#2b6fd4; --o4:#14335e; --halo:rgba(78,168,255,.35); }
.orb--purple { --o1:#e6d9ff; --o2:#a97dff; --o3:#6d3fd4; --o4:#2c1560; --halo:rgba(169,125,255,.35); }
.orb--gold   { --o1:#fff0c4; --o2:#e8c25a; --o3:#b0842c; --o4:#4e3608; --halo:rgba(232,194,90,.35); }
.orb--red    { --o1:#ffd6d6; --o2:#FF5C5C; --o3:#c22e2e; --o4:#4e0e0e; --halo:rgba(255,92,92,.35); }
.orb--cyan   { --o1:#d0fbff; --o2:#39C6D6; --o3:#1e7f95; --o4:#0b2e3e; --halo:rgba(57,198,214,.35); }
.orb--updown { --o1:#d6ffe3; --o2:#2FD37A; --o3:#c04a33; --o4:#4e0e12; --halo:rgba(47,211,122,.32); }
.orb--oddsjam{ --o1:#9fdcff; --o2:#18AFE8; --o3:#0d3a55; --o4:#0a1118; --halo:rgba(24,175,232,.4); }
.orb--gambly { --o1:#d9ffe6; --o2:#3ee06e; --o3:#1a8a44; --o4:#0e1626; --halo:rgba(62,224,110,.42); }
.orb__blob { position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, var(--o1) 0%, var(--o2) 34%, var(--o3) 68%, var(--o4) 100%); }
.orb--oddsjam .orb__blob { background: #0d1520 url('/agents/oddsjam.png') center/cover no-repeat; }
.orb--gambly  .orb__blob { background: #3ee06e url('/agents/gambly.jpg') center/cover no-repeat; }
.orb__halo { position: absolute; inset: -16%; border-radius: 50%;
  background: radial-gradient(circle, var(--halo) 0%, transparent 70%); filter: blur(6px); }
.orb__swirl { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; }
.orb__swirl::before { content: ""; position: absolute; width: 170%; height: 170%; left: -35%; top: -35%;
  background:
    radial-gradient(28% 24% at 33% 62%, var(--o1), transparent 72%),
    radial-gradient(34% 30% at 68% 38%, rgba(0,0,0,.38), transparent 74%),
    radial-gradient(22% 20% at 58% 72%, var(--o2), transparent 70%);
  filter: blur(7px); opacity: .6; animation: orb-swirl 11s linear infinite; }
.orb__swirl::after { content: ""; position: absolute; width: 170%; height: 170%; left: -35%; top: -35%;
  background:
    radial-gradient(26% 30% at 62% 60%, var(--o1), transparent 70%),
    radial-gradient(30% 26% at 34% 36%, rgba(0,0,0,.3), transparent 72%);
  filter: blur(9px); opacity: .45; mix-blend-mode: soft-light; animation: orb-swirl 17s linear infinite reverse; }
.orb__emoji { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: calc(var(--orb-size) * 0.4); z-index: 2; filter: drop-shadow(0 3px 6px rgba(0,0,0,.45)); }
.orb__sheen { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; }
.orb__sheen::after { content: ""; position: absolute; width: 130%; height: 60%; left: -15%; top: -8%;
  background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.5), transparent 65%); }
.orb--live .orb__blob { animation: orb-breathe 4.2s ease-in-out infinite; }
.orb--live .orb__halo { animation: orb-breathe 4.2s ease-in-out infinite reverse; }
.orb--holding.orb--live .orb__blob { animation-duration: 6.5s; }
.orb--entering.orb--live .orb__blob, .orb--entering.orb--live .orb__halo { animation-duration: 1.6s; }
.orb--paused .orb__blob, .orb--paused .orb__halo, .orb--paused .orb__swirl::before, .orb--paused .orb__swirl::after {
  animation-play-state: paused; }
.orb--paused .orb__blob, .orb--paused .orb__halo { filter: grayscale(.55) brightness(.75); }
@keyframes orb-swirl { to { transform: rotate(360deg); } }
@keyframes orb-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.055); } }
@media (prefers-reduced-motion: reduce) {
  .orb__blob, .orb__halo, .orb__swirl::before, .orb__swirl::after { animation: none !important; }
}
```

- [ ] **Step 2: Create `components/orb.tsx`**

```tsx
import type { OrbColor } from '../lib/types'

interface OrbProps {
  color: OrbColor
  emoji?: string
  size: number
  live?: boolean
  paused?: boolean
  phase?: 'scanning' | 'entering' | 'holding'
}

export function Orb({ color, emoji, size, live, paused, phase }: OrbProps) {
  const cls = [
    'orb',
    `orb--${color}`,
    live ? 'orb--live' : '',
    paused ? 'orb--paused' : '',
    phase ? `orb--${phase}` : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ width: size, height: size, ['--orb-size' as string]: `${size}px` }}>
      <div className="orb__halo" />
      <div className="orb__blob" />
      <div className="orb__swirl" />
      {emoji ? <span className="orb__emoji">{emoji}</span> : null}
      <div className="orb__sheen" />
    </div>
  )
}
```

(Partner logos ride on the `orb--oddsjam` / `orb--gambly` blob backgrounds — the `brand` prop is unnecessary; color alone selects them. Drop `brand` from the props.)

- [ ] **Step 3: Visual verify** — temporarily render a strip of all 9 colors at `size={90}` in `page.tsx`, screenshot as in Task 4 Step 7, confirm: gradients per color, OddsJam/Gambly logos visible, emoji centered, swirl visible. Remove the strip after checking.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): Orb component with living surface + all variants"
```

---

### Task 6: Agent tab — cover flow, equip, status, activity feed

**Files:**
- Create: `apps/platform/src/app/agent/components/cover-flow.tsx`
- Create: `apps/platform/src/app/agent/components/activity-feed.tsx`
- Modify: `apps/platform/src/app/agent/page.tsx` (replace stub)
- Modify: `apps/platform/src/app/agent/agent.css` (append cover-flow + feed rules)

**Interfaces:**
- Consumes: `useAgent()` (Task 4), `Orb` (Task 5), `VENUE_META` (Task 2), formatters (Task 1).
- Produces: `<CoverFlow models centerIndex onCenter(i) onOpen(model) equippedId paused phase />`; `<ActivityFeed decisions />`. Page owns `centerIndex` state and an `onOpen` handler wired to the model sheet in Task 7 (until then it may be a no-op).

- [ ] **Step 1: Append CSS**

```css
/* ---- cover flow ---- */
.cf { position: relative; width: 100%; height: 180px; perspective: 900px; touch-action: pan-y; }
.cf__item { position: absolute; left: 50%; top: 50%; margin: -75px 0 0 -75px; cursor: pointer;
  transition: transform .45s cubic-bezier(.3,.8,.3,1), opacity .45s, filter .45s; }
.cf__item--p0  { transform: translateX(0) scale(1); z-index: 5; opacity: 1; }
.cf__item--m1  { transform: translateX(-116px) rotateY(48deg) scale(.56); z-index: 3; opacity: .55; filter: brightness(.6); }
.cf__item--p1  { transform: translateX(116px) rotateY(-48deg) scale(.56); z-index: 3; opacity: .55; filter: brightness(.6); }
.cf__item--m2  { transform: translateX(-168px) rotateY(58deg) scale(.4); z-index: 1; opacity: .22; filter: brightness(.5); }
.cf__item--p2  { transform: translateX(168px) rotateY(-58deg) scale(.4); z-index: 1; opacity: .22; filter: brightness(.5); }
.cf__item--hide { transform: translateX(0) scale(.2); opacity: 0; z-index: 0; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .cf__item { transition: none; } }
.cf-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; margin-top: 10px; text-align: center; }
.cf-dots { display: flex; gap: 6px; margin-top: 12px; justify-content: center; }
.cf-dots span { width: 6px; height: 6px; border-radius: 50%; background: #2a323a; }
.cf-dots span.on { background: var(--ag-sub); }
.ag-status { margin-top: 16px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; justify-content: center; }
.ag-status__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ag-green); animation: ag-pulse 2s infinite; }
.ag-status__dot--off { background: var(--ag-sub); animation: none; }
@keyframes ag-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.ag-statussub { font-size: 12.5px; color: var(--ag-sub); margin-top: 4px; text-align: center; }
.ag-balrow { display: flex; gap: 12px; margin: 0 0 6px; }
.ag-balcell { flex: 1; background: var(--ag-card); border: 1px solid var(--ag-border); border-radius: 18px; padding: 14px 16px; }
.ag-balcell__lab { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ag-sub); margin-bottom: 5px; font-weight: 600; }
.ag-balcell__val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }

/* ---- activity feed ---- */
.feed-item { display: flex; gap: 12px; padding: 11px 2px; border-bottom: 1px solid #191f24; align-items: flex-start; }
.feed-item:last-child { border-bottom: none; }
.feed-item__ic { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; position: relative;
  display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: var(--ag-surface); }
.feed-item__bdg { position: absolute; right: -5px; bottom: -5px; width: 16px; height: 16px; border-radius: 50%;
  background: #1a2026; border: 2px solid var(--ag-surface); color: var(--ag-ink);
  display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; }
.feed-item__bdg--win { background: var(--ag-green); color: var(--ag-surface); }
.feed-item__t { font-size: 13.5px; line-height: 1.4; }
.feed-item__m { font-size: 11.5px; color: var(--ag-sub); margin-top: 2px; }
```

- [ ] **Step 2: Create `components/cover-flow.tsx`**

```tsx
'use client'
import { useRef } from 'react'
import { Orb } from './orb'
import type { AgentModel } from '../lib/types'

interface CoverFlowProps {
  models: AgentModel[]
  centerIndex: number
  equippedId: string
  paused: boolean
  phase: 'scanning' | 'entering' | 'holding' | 'paused'
  onCenter: (i: number) => void
  onOpen: (m: AgentModel) => void
}

function slotClass(delta: number): string {
  if (delta === 0) return 'cf__item--p0'
  if (delta === -1) return 'cf__item--m1'
  if (delta === 1) return 'cf__item--p1'
  if (delta === -2) return 'cf__item--m2'
  if (delta === 2) return 'cf__item--p2'
  return 'cf__item--hide'
}

export function CoverFlow({ models, centerIndex, equippedId, paused, phase, onCenter, onOpen }: CoverFlowProps) {
  const touchX = useRef<number | null>(null)
  return (
    <div
      className="cf"
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) < 30) return
        onCenter(Math.max(0, Math.min(models.length - 1, centerIndex + (dx < 0 ? 1 : -1))))
      }}
    >
      {models.map((m, i) => (
        <div
          key={m.id}
          role="button"
          aria-label={m.name}
          className={'cf__item ' + slotClass(i - centerIndex)}
          onClick={() => (i === centerIndex ? onOpen(m) : onCenter(i))}
        >
          <Orb
            color={m.color}
            emoji={m.emoji}
            size={150}
            live={m.id === equippedId && i === centerIndex && !paused}
            paused={m.id === equippedId && paused}
            phase={m.id === equippedId && phase !== 'paused' ? phase : undefined}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/activity-feed.tsx`**

```tsx
import { VENUE_META } from '../lib/catalog'
import type { Decision } from '../lib/types'

const BADGE: Record<Decision['action'], { glyph: string; win: boolean }> = {
  settled: { glyph: '✓', win: true },
  entered: { glyph: '→', win: false },
  passed:  { glyph: '·', win: false },
}

export function ActivityFeed({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="ag-card" style={{ padding: '6px 14px' }}>
      {decisions.map(d => {
        const v = VENUE_META[d.venue]
        const b = BADGE[d.action]
        return (
          <div className="feed-item" key={d.id}>
            <div className="feed-item__ic" style={{ background: v.bg }}>
              {v.abbr}
              <span className={'feed-item__bdg' + (b.win ? ' feed-item__bdg--win' : '')}>{b.glyph}</span>
            </div>
            <div>
              <div className="feed-item__t">{d.title}</div>
              <div className="feed-item__m ag-num">{d.detail}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Replace `page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useAgent } from './lib/store'
import { CoverFlow } from './components/cover-flow'
import { ActivityFeed } from './components/activity-feed'
import { formatMoney, formatPerf, formatSigned } from './lib/format'
import type { AgentModel } from './lib/types'

export default function AgentTab() {
  const { state, status, todayPnl, owned, dispatch } = useAgent()
  const [centerIndex, setCenterIndex] = useState(0)
  const [sheetModel, setSheetModel] = useState<AgentModel | null>(null) // wired in Task 7

  const m = state.models[centerIndex]
  const isEquipped = m.id === state.equippedId

  let equipLabel = 'Equipped ✓'
  if (!isEquipped) {
    if (m.status === 'review') equipLabel = 'In review'
    else if (owned(m.id)) equipLabel = 'Equip'
    else equipLabel = 'Subscribe · ' + (m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo')
  }

  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Sneakers</span>
        <span className="ag-badge ag-badge--paper">PAPER</span>
      </div>

      <CoverFlow
        models={state.models}
        centerIndex={centerIndex}
        equippedId={state.equippedId}
        paused={state.paused}
        phase={status.phase}
        onCenter={setCenterIndex}
        onOpen={setSheetModel}
      />
      <div className="cf-name">{m.name}</div>
      {isEquipped ? (
        <>
          <div className="ag-status">
            <span className={'ag-status__dot' + (state.paused ? ' ag-status__dot--off' : '')} />
            {status.title}
          </div>
          <div className="ag-statussub">{status.sub}</div>
        </>
      ) : (
        <>
          <div className="ag-status">{m.tagline ?? formatPerf(m.perf30d) + ' · 30d paper'}</div>
          <div className="ag-statussub">
            by {m.by}{m.runners > 1 ? ` · ${m.runners.toLocaleString('en-US')} running` : ''}
          </div>
        </>
      )}
      <div className="cf-dots">
        {state.models.map((x, i) => <span key={x.id} className={i === centerIndex ? 'on' : ''} />)}
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '14px 0 12px' }}>
        <button
          className={'ag-pill ' + (isEquipped ? 'ag-pill--ghost' : 'ag-pill--primary')}
          onClick={() => dispatch({ type: 'equip', id: m.id })}
        >
          {equipLabel}
        </button>
        <button className="ag-pill ag-pill--ghost" onClick={() => dispatch({ type: 'togglePaused' })}>
          {state.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div className="ag-balrow">
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Balance</div>
          <div className="ag-balcell__val ag-num">{formatMoney(state.balanceCents)}</div>
        </div>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Today</div>
          <div className="ag-balcell__val ag-num ag-pos">{formatSigned(todayPnl)}</div>
        </div>
      </div>

      <div className="ag-sechead">Activity</div>
      <ActivityFeed decisions={state.decisions} />
    </>
  )
}
```

Note: `sheetModel` is intentionally unused until Task 7 wires `<ModelSheet>`; suppress the lint warning by rendering `{sheetModel ? null : null}` is NOT needed — just prefix with underscore until Task 7: `const [_sheetModel, setSheetModel] = …` and rename back in Task 7.

- [ ] **Step 5: Visual verify** — dev server + screenshot `/agent` (Task 4 Step 7 command). Expected: Up/Down orb breathing center with 🎢, side orbs angled, Equipped ✓/Pause buttons, balance cells, 4 feed rows with K/P/Px logos. Click a side orb → it centers and button becomes Subscribe/Equip.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): Agent tab — cover flow, equip, status, venue-logo feed"
```

---

### Task 7: Bottom-sheet primitive + model detail sheet + add-agent sheet

**Files:**
- Create: `apps/platform/src/app/agent/components/sheet.tsx`
- Create: `apps/platform/src/app/agent/components/model-sheet.tsx`
- Create: `apps/platform/src/app/agent/components/add-agent-sheet.tsx`
- Modify: `apps/platform/src/app/agent/page.tsx` (wire ModelSheet)
- Modify: `apps/platform/src/app/agent/agent.css` (append sheet + form rules)

**Interfaces:**
- Consumes: store, Orb, formatters.
- Produces: `<Sheet open onClose>{children}</Sheet>`; `<ModelSheet model onClose />` (model: `AgentModel | null`); `<AddAgentSheet open onClose />`. Task 8 consumes all three.

- [ ] **Step 1: Append CSS**

```css
/* ---- bottom sheets ---- */
.sheet-veil { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 60; }
.sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 61; background: var(--ag-card);
  border-radius: 28px 28px 0 0; padding: 14px 20px calc(28px + env(safe-area-inset-bottom));
  animation: sheet-up .3s cubic-bezier(.32,.72,.25,1); }
@media (min-width: 700px) { .sheet { max-width: 430px; margin: 0 auto; } }
@keyframes sheet-up { from { transform: translateY(105%); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .sheet { animation: none; } }
.sheet__grab { width: 38px; height: 5px; border-radius: 3px; background: #2a323a; margin: 0 auto 16px; }

/* ---- add-agent form ---- */
.ag-fld { width: 100%; background: #101519; border: 1px solid #232b31; border-radius: 12px;
  padding: 11px 12px; color: var(--ag-ink); font-family: inherit; font-size: 14px; margin-bottom: 10px; }
.ag-fld::placeholder { color: #5c676e; }
.ag-fld:focus { outline: none; border-color: var(--ag-green); }
textarea.ag-fld { min-height: 72px; resize: none; line-height: 1.5; }
.ag-picklab { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ag-sub); font-weight: 600; margin: 2px 2px 8px; }
.ag-pickrow { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ag-epick { width: 38px; height: 38px; border-radius: 12px; background: #1a2026; border: 1px solid #232b31;
  font-size: 19px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-family: inherit; }
.ag-epick--on { border-color: var(--ag-green); background: rgba(47,211,122,.12); }
.ag-cpick { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; padding: 0; }
.ag-cpick--on { border-color: #fff; }
.ag-seg { display: flex; background: var(--ag-card); border: 1px solid var(--ag-border); border-radius: 12px; padding: 3px; margin-bottom: 14px; }
.ag-seg button { flex: 1; font-family: inherit; font-size: 13.5px; font-weight: 600; padding: 9px 0; border: none; border-radius: 9px;
  background: none; color: var(--ag-sub); cursor: pointer; letter-spacing: -0.01em; }
.ag-seg button.on { background: #242b32; color: var(--ag-ink); box-shadow: 0 1px 3px rgba(0,0,0,.4); }
.ag-seg button:focus-visible { outline: 2px solid var(--ag-green); outline-offset: -2px; }
```

- [ ] **Step 2: Create `components/sheet.tsx`**

```tsx
'use client'
export function Sheet({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div className="sheet-veil" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="sheet__grab" />
        {children}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create `components/model-sheet.tsx`**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { Sheet } from './sheet'
import { Orb } from './orb'
import { useAgent } from '../lib/store'
import { formatPerf } from '../lib/format'
import type { AgentModel } from '../lib/types'

export function ModelSheet({ model, onClose }: { model: AgentModel | null; onClose: () => void }) {
  const { state, owned, dispatch } = useAgent()
  const router = useRouter()
  if (!model) return null
  const m = model
  const equipped = m.id === state.equippedId

  let label = 'Subscribe · ' + (m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo')
  let ghost = false
  if (m.mine) { label = 'Edit in My Model'; ghost = true }
  else if (m.status === 'review') { label = 'In review — coming soon'; ghost = true }
  else if (equipped) { label = 'Equipped ✓'; ghost = true }
  else if (owned(m.id)) { label = 'Equip now' }

  function onAction() {
    if (m.status === 'review') return
    if (m.mine) { onClose(); router.push('/agent/models'); return }
    if (equipped) return
    if (!owned(m.id)) { dispatch({ type: 'subscribe', id: m.id }); return }
    dispatch({ type: 'equip', id: m.id })
    onClose()
    router.push('/agent')
  }

  return (
    <Sheet open onClose={onClose}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <Orb color={m.color} emoji={m.emoji} size={64} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{m.name}</div>
          <div className="ag-sub">by {m.by}</div>
        </div>
      </div>
      <div className="ag-balrow" style={{ margin: '0 0 12px' }}>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">30d paper</div>
          <div className={'ag-balcell__val ag-num' + (m.perf30d !== null ? ' ag-pos' : '')} style={{ fontSize: 18 }}>
            {formatPerf(m.perf30d)}
          </div>
        </div>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Running</div>
          <div className="ag-balcell__val ag-num" style={{ fontSize: 18 }}>
            {m.runners > 1 ? m.runners.toLocaleString('en-US') : '—'}
          </div>
        </div>
      </div>
      <div className="ag-sub" style={{ marginBottom: 16 }}>{m.description}</div>
      <button className={'ag-pill ' + (ghost ? 'ag-pill--ghost' : 'ag-pill--primary')} style={{ width: '100%' }} onClick={onAction}>
        {label}
      </button>
    </Sheet>
  )
}
```

- [ ] **Step 4: Create `components/add-agent-sheet.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from './sheet'
import { useAgent } from '../lib/store'
import type { OrbColor } from '../lib/types'

const EMOJIS = ['🤖', '🚀', '🧠', '🔥', '💎', '🐍']
const COLORS: { color: OrbColor; hex: string }[] = [
  { color: 'green', hex: '#2FD37A' }, { color: 'blue', hex: '#4EA8FF' },
  { color: 'purple', hex: '#a97dff' }, { color: 'gold', hex: '#e8c25a' },
  { color: 'cyan', hex: '#39C6D6' }, { color: 'red', hex: '#FF5C5C' },
]

export function AddAgentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useAgent()
  const router = useRouter()
  const [kind, setKind] = useState<'prompt' | 'connected'>('prompt')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState<OrbColor>('cyan')
  const [prompt, setPrompt] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [apiKey, setApiKey] = useState('')

  function create() {
    dispatch({ type: 'createAgent', input: { name, emoji, color, kind, prompt, endpointUrl, apiKey } })
    setName(''); setPrompt(''); setEndpointUrl(''); setApiKey('')
    onClose()
    router.push('/agent')
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="ag-row" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Add Agent</div>
        <span className="ag-badge ag-badge--paper">PAPER</span>
      </div>
      <div className="ag-seg" role="tablist">
        <button className={kind === 'prompt' ? 'on' : ''} onClick={() => setKind('prompt')}>Build with prompt</button>
        <button className={kind === 'connected' ? 'on' : ''} onClick={() => setKind('connected')}>Connect your bot</button>
      </div>
      <input className="ag-fld" placeholder="Agent name" maxLength={18} value={name} onChange={e => setName(e.target.value)} />
      <div className="ag-picklab">Emoji</div>
      <div className="ag-pickrow">
        {EMOJIS.map(em => (
          <button key={em} className={'ag-epick' + (em === emoji ? ' ag-epick--on' : '')} onClick={() => setEmoji(em)}>{em}</button>
        ))}
      </div>
      <div className="ag-picklab">Color</div>
      <div className="ag-pickrow">
        {COLORS.map(c => (
          <button key={c.color} aria-label={c.color} style={{ background: c.hex }}
            className={'ag-cpick' + (c.color === color ? ' ag-cpick--on' : '')} onClick={() => setColor(c.color)} />
        ))}
      </div>
      {kind === 'prompt' ? (
        <textarea className="ag-fld" value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="Strategy prompt — e.g. Trade 15-min ETH windows, buy Yes under 30¢ when momentum is up, max 3% per trade." />
      ) : (
        <>
          <input className="ag-fld" placeholder="https://your-bot.example.com/signals" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} />
          <input className="ag-fld" placeholder="API key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <div className="ag-sub" style={{ margin: '-2px 0 10px' }}>
            We send market signals; your bot returns orders. Runs against your paper balance until it clears review.
          </div>
        </>
      )}
      <button className="ag-pill ag-pill--primary" style={{ width: '100%' }} onClick={create}>Create agent</button>
    </Sheet>
  )
}
```

- [ ] **Step 5: Wire ModelSheet into `page.tsx`** — rename `_sheetModel` back to `sheetModel` and render after the feed:

```tsx
import { ModelSheet } from './components/model-sheet'
// … end of JSX:
<ModelSheet model={sheetModel} onClose={() => setSheetModel(null)} />
```

- [ ] **Step 6: Visual verify** — screenshot: tap the centered orb → detail sheet with stats + button states (Equipped ✓ on Up/Down; Subscribe on Wave Rider; subscribing flips it to Equip now; Equip now routes to `/agent`).

- [ ] **Step 7: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): sheets — primitive, model detail, add-agent creation"
```

---

### Task 8: Models tab — segmented control, My Model, Trading Agents grid

**Files:**
- Create: `apps/platform/src/app/agent/components/model-grid.tsx`
- Modify: `apps/platform/src/app/agent/models/page.tsx` (replace stub)
- Modify: `apps/platform/src/app/agent/agent.css` (append grid rules)

**Interfaces:**
- Consumes: `marketplaceModels` (Task 2), `useAgent()`, `Orb`, sheets (Task 7), `formatPerf`.
- Produces: `<ModelGrid onOpen(model) onAdd() />` — self-contained; page composes it with `ModelSheet` + `AddAgentSheet`.

- [ ] **Step 1: Append CSS**

```css
/* ---- trading agents grid ---- */
.mgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mcell { background: var(--ag-card); border: 1px solid var(--ag-border); border-radius: 18px; padding: 18px 12px 14px;
  display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center;
  font-family: inherit; color: var(--ag-ink); position: relative; }
.mcell:focus-visible { outline: 2px solid var(--ag-green); }
.mcell__name { font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; margin-top: 12px; }
.mcell__by { font-size: 11px; color: var(--ag-sub); margin-top: 2px; }
.mcell__perf { font-size: 12px; font-weight: 600; margin-top: 6px; }
.mcell__tag { font-size: 11.5px; color: #8fd7ff; margin-top: 6px; line-height: 1.4; font-weight: 600; }
.mcell__price { font-size: 11.5px; font-weight: 700; margin-top: 8px; padding: 5px 11px; border-radius: 99px; background: #1a2026; color: var(--ag-sub); }
.mcell--owned .mcell__price { background: rgba(47,211,122,.14); color: var(--ag-green); }
.mcell__add { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 50%;
  background: #1a2026; border: 1px solid #2a323a; color: var(--ag-ink);
  display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; line-height: 1; }
.mcell__add--added { background: rgba(47,211,122,.15); border-color: var(--ag-green); color: var(--ag-green); font-size: 12px; }
.mcell--featured.mcell--oddsjam { background: linear-gradient(165deg, rgba(24,175,232,.2), var(--ag-card) 62%);
  border-color: rgba(24,175,232,.5); box-shadow: 0 0 26px rgba(24,175,232,.16); }
.mcell--featured.mcell--oddsjam .mcell__price { background: var(--ag-oddsjam); color: var(--ag-surface); }
.mcell--featured.mcell--gambly { background: linear-gradient(165deg, rgba(62,224,110,.2), var(--ag-card) 62%);
  border-color: rgba(62,224,110,.5); box-shadow: 0 0 26px rgba(62,224,110,.18); }
.mcell--featured.mcell--gambly .mcell__price { background: var(--ag-gambly); color: var(--ag-surface); }
.mcell--featured.mcell--gambly .mcell__tag { color: #7df0a2; }
.mcell--dashed { border: 1.5px dashed #2a323a; background: rgba(20,24,29,.4); }
.mcell__plusorb { width: 84px; height: 84px; border-radius: 50%; border: 2px dashed var(--ag-green);
  display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--ag-green); font-weight: 300; }
.mprompt { font-size: 14px; line-height: 1.55; color: #dfe6e2; background: #101519; border: 1px solid #232b31; border-radius: 14px; padding: 13px 14px; min-height: 88px; }
.mchips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.mchip { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 8px 13px; border-radius: 99px; border: 1px solid #232b31; background: none; color: var(--ag-sub); cursor: pointer; }
.mchip--on { background: rgba(47,211,122,.13); border-color: var(--ag-green); color: var(--ag-green); }
```

- [ ] **Step 2: Create `components/model-grid.tsx`**

```tsx
'use client'
import { marketplaceModels } from '../lib/catalog'
import { useAgent } from '../lib/store'
import { formatPerf } from '../lib/format'
import { Orb } from './orb'
import type { AgentModel } from '../lib/types'

export function ModelGrid({ onOpen, onAdd }: { onOpen: (m: AgentModel) => void; onAdd: () => void }) {
  const { state, owned, dispatch } = useAgent()
  const models = marketplaceModels(state.models)
  return (
    <div className="mgrid">
      {models.map(m => {
        const isOwned = owned(m.id)
        const price = m.status === 'review' ? 'In review'
          : m.included ? 'Included'
          : isOwned ? 'Subscribed ✓'
          : m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo'
        const cls = ['mcell',
          isOwned ? 'mcell--owned' : '',
          m.featured ? 'mcell--featured' : '',
          m.brand ? `mcell--${m.brand}` : '',
        ].filter(Boolean).join(' ')
        return (
          <button key={m.id} className={cls} onClick={() => onOpen(m)}>
            {m.status !== 'review' && (
              <span
                className={'mcell__add' + (isOwned ? ' mcell__add--added' : '')}
                onClick={e => { e.stopPropagation(); if (!isOwned) dispatch({ type: 'subscribe', id: m.id }) }}
              >
                {isOwned ? '✓' : '+'}
              </span>
            )}
            <Orb color={m.color} emoji={m.emoji} size={84} />
            <div className="mcell__name">{m.name}</div>
            <div className="mcell__by">by {m.by}</div>
            {m.tagline
              ? <div className="mcell__tag">{m.tagline}</div>
              : <div className={'mcell__perf ag-num' + (m.perf30d !== null ? ' ag-pos' : '')}>
                  {formatPerf(m.perf30d)}{m.perf30d !== null ? ' · 30d' : ''}
                </div>}
            <div className="mcell__price ag-num">{price}</div>
          </button>
        )
      })}
      <button className="mcell mcell--dashed" onClick={onAdd}>
        <div className="mcell__plusorb">＋</div>
        <div className="mcell__name">Add Agent</div>
        <div className="mcell__by">build one or connect your own bot</div>
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Replace `models/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useAgent } from '../lib/store'
import { ModelGrid } from '../components/model-grid'
import { ModelSheet } from '../components/model-sheet'
import { AddAgentSheet } from '../components/add-agent-sheet'
import { formatPerf } from '../lib/format'
import type { AgentModel } from '../lib/types'

export default function ModelsTab() {
  const { state } = useAgent()
  const [seg, setSeg] = useState<'mine' | 'best'>('best')
  const [sheetModel, setSheetModel] = useState<AgentModel | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const mine = state.models.find(m => m.id === 'longshot')!

  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Models</span>
        <span className="ag-badge ag-badge--paper">PAPER</span>
      </div>
      <div className="ag-seg" role="tablist">
        <button className={seg === 'mine' ? 'on' : ''} onClick={() => setSeg('mine')}>My Model</button>
        <button className={seg === 'best' ? 'on' : ''} onClick={() => setSeg('best')}>Trading Agents</button>
      </div>

      {seg === 'best' ? (
        <>
          <div className="ag-sub" style={{ padding: '0 2px 12px' }}>
            Ranked by 30-day paper performance. Tap a model for details — subscribe to add it to your Agent carousel.
          </div>
          <ModelGrid onOpen={setSheetModel} onAdd={() => setAddOpen(true)} />
          <div className="ag-sub" style={{ padding: '12px 4px 2px' }}>
            Subscriptions bill through your Sneakers plan (Stripe). Creator payouts via Stripe Connect.
          </div>
        </>
      ) : (
        <>
          <div className="ag-card">
            <div className="ag-row" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{mine.name}</div>
              <div className="ag-sub ag-num ag-pos">{formatPerf(mine.perf30d)} · 30d paper</div>
            </div>
            <div className="mprompt">
              Trade 5 and 15-minute crypto markets only. Favor longshots priced 10–35¢ with momentum confirmation.
              Max 5% of bankroll per trade. Skip anything with a spread over 4¢.
            </div>
            <div className="mchips">
              <button className="mchip mchip--on">Longshot 10–35¢</button>
              <button className="mchip">Momentum</button>
              <button className="mchip">Fade the spike</button>
              <button className="mchip">Conservative</button>
            </div>
            <div className="ag-sub" style={{ marginTop: 12 }}>
              Your model re-reads this prompt before every window. Changes apply to the next scan.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ag-pill ag-pill--primary" style={{ fontSize: 14 }}>Run this model</button>
            <button className="ag-pill ag-pill--ghost" style={{ fontSize: 14 }}>Backtest</button>
          </div>
          <button className="ag-pill ag-pill--ghost" style={{ width: '100%', marginTop: 10, fontSize: 14, color: 'var(--ag-green)' }}
            onClick={() => setAddOpen(true)}>
            ＋ Add Agent
          </button>
        </>
      )}

      <ModelSheet model={sheetModel} onClose={() => setSheetModel(null)} />
      <AddAgentSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Visual verify** — screenshot `/agent/models`: OddsJam (blue glow, logo orb, "From $1 per day") and Gambly (green glow) first; + buttons subscribe in place; Add Agent dashed cell last; creating an agent routes to `/agent` with the new orb centered.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): Models tab — My Model, Trading Agents grid, Add Agent"
```

---

### Task 9: Balance tab — hero, sparkline, add cash, ledger

**Files:**
- Create: `apps/platform/src/app/agent/components/sparkline.tsx`
- Create: `apps/platform/src/app/agent/components/add-cash-sheet.tsx`
- Modify: `apps/platform/src/app/agent/balance/page.tsx` (replace stub)

**Interfaces:**
- Consumes: store, `Sheet`, formatters.
- Produces: `<Sparkline values />` (values: number[] of cents); `<AddCashSheet open onClose />`.

- [ ] **Step 1: Create `components/sparkline.tsx`** (single green series on dark card; crosshair + tooltip on hover/touch — same math as the prototype)

```tsx
'use client'
import { useRef, useState } from 'react'
import { formatMoney } from '../lib/format'

const W = 320, H = 96, P = 8

export function Sparkline({ values }: { values: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const min = Math.min(...values), max = Math.max(...values)
  const X = (i: number) => P + (i * (W - 2 * P)) / (values.length - 1)
  const Y = (v: number) => H - P - 14 - ((v - min) / (max - min || 1)) * (H - 2 * P - 22)
  const pts = values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')
  const area = `${P},${H - P} ${pts} ${W - P},${H - P}`

  function locate(clientX: number) {
    const r = svgRef.current!.getBoundingClientRect()
    const i = Math.round(((clientX - r.left) / r.width) * (values.length - 1))
    setHover(Math.max(0, Math.min(values.length - 1, i)))
  }

  return (
    <div className="ag-card" style={{ position: 'relative', padding: '14px 6px 6px' }}>
      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Balance, last 7 days"
        onMouseMove={e => locate(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchStart={e => locate(e.touches[0].clientX)} onTouchMove={e => locate(e.touches[0].clientX)} onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2FD37A" stopOpacity=".28" />
            <stop offset="1" stopColor="#2FD37A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={P} y1={Y(values[0])} x2={W - P} y2={Y(values[0])} stroke="#232b31" strokeDasharray="3 4" strokeWidth="1" />
        <polygon points={area} fill="url(#sparkfill)" />
        <polyline points={pts} fill="none" stroke="#2FD37A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1])} r="4" fill="#2FD37A" stroke="#14181D" strokeWidth="2" />
        {hover !== null && (
          <>
            <line x1={X(hover)} y1={P} x2={X(hover)} y2={H - P} stroke="#3a444d" strokeWidth="1" />
            <circle cx={X(hover)} cy={Y(values[hover])} r="4.5" fill="#2FD37A" stroke="#14181D" strokeWidth="2" />
          </>
        )}
      </svg>
      {hover !== null && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', background: '#1e252b', border: '1px solid #2a323a',
          borderRadius: 9, padding: '6px 9px', fontSize: 11.5, whiteSpace: 'nowrap',
          left: `${(X(hover) / W) * 100}%`, top: `${(Y(values[hover]) / H) * 100}%`, transform: 'translate(-50%,-115%)',
        }}>
          <b className="ag-num">{formatMoney(values[hover])}</b>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/add-cash-sheet.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Sheet } from './sheet'
import { useAgent } from '../lib/store'

const AMOUNTS = [2500, 10000, 25000]

export function AddCashSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useAgent()
  const [cents, setCents] = useState(10000)
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="ag-row">
        <div style={{ fontSize: 17, fontWeight: 700 }}>Add cash</div>
        <span className="ag-badge ag-badge--test">STRIPE TEST</span>
      </div>
      <div className="ag-sub" style={{ marginTop: 8 }}>
        Test mode — card 4242 4242 4242 4242. No real money moves.
      </div>
      <div className="ag-pickrow" style={{ margin: '14px 0 16px' }}>
        {AMOUNTS.map(a => (
          <button key={a} className={'mchip ag-num' + (a === cents ? ' mchip--on' : '')}
            style={{ flex: 1, textAlign: 'center', fontSize: 14, padding: '11px 0' }}
            onClick={() => setCents(a)}>
            ${a / 100}
          </button>
        ))}
      </div>
      <button className="ag-pill ag-pill--primary" style={{ width: '100%' }}
        onClick={() => { dispatch({ type: 'deposit', cents }); onClose() }}>
        Add ${cents / 100}
      </button>
    </Sheet>
  )
}
```

- [ ] **Step 3: Replace `balance/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useAgent } from '../lib/store'
import { Sparkline } from '../components/sparkline'
import { AddCashSheet } from '../components/add-cash-sheet'
import { formatMoney, formatSigned } from '../lib/format'

export default function BalanceTab() {
  const { state, todayPnl } = useAgent()
  const [addOpen, setAddOpen] = useState(false)
  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Funds</span>
        <span className="ag-badge ag-badge--test">STRIPE TEST</span>
      </div>
      <div style={{ padding: '10px 2px 4px' }}>
        <div className="ag-balcell__lab">Sneakers wallet</div>
        <div className="ag-num" style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>
          {formatMoney(state.balanceCents)}
        </div>
        <div className="ag-num ag-pos" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
          {formatSigned(todayPnl)} today
        </div>
      </div>
      <Sparkline values={state.spark} />
      <div style={{ display: 'flex', gap: 10, margin: '2px 0 6px' }}>
        <button className="ag-pill ag-pill--primary" onClick={() => setAddOpen(true)}>Add cash</button>
        <button className="ag-pill ag-pill--ghost">Withdraw</button>
      </div>
      <div className="ag-sechead">History</div>
      <div className="ag-card" style={{ padding: '4px 16px' }}>
        {state.ledger.map(l => (
          <div key={l.id} className="ag-row" style={{ padding: '12px 2px', borderBottom: '1px solid #191f24' }}>
            <div>
              <div style={{ fontSize: 14 }}>{l.label}</div>
              <div className="ag-sub" style={{ fontSize: 11.5, marginTop: 2 }}>{l.detail}</div>
            </div>
            <div className={'ag-num' + (l.amountCents < 0 ? ' ag-neg' : l.kind === 'settlement' ? ' ag-pos' : '')}
              style={{ fontSize: 14.5, fontWeight: 600 }}>
              {l.kind === 'settlement' ? formatSigned(l.amountCents) : formatMoney(Math.abs(l.amountCents))}
            </div>
          </div>
        ))}
      </div>
      <AddCashSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Visual verify** — screenshot `/agent/balance`: hero amount, sparkline with endpoint dot, Add cash sheet deposits update the hero AND the tab-bar number.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): Balance tab — hero, sparkline, test-mode add cash, ledger"
```

---

### Task 10: Profile tab

**Files:**
- Modify: `apps/platform/src/app/agent/profile/page.tsx` (replace stub)
- Modify: `apps/platform/src/app/agent/agent.css` (append connection-row rules)

**Interfaces:**
- Consumes: store (none required beyond frame), design tokens.
- Produces: static Profile page (real account data arrives in Phase 2).

- [ ] **Step 1: Append CSS**

```css
/* ---- profile connections ---- */
.conn { display: flex; align-items: center; gap: 13px; padding: 13px 2px; border-bottom: 1px solid #191f24; }
.conn:last-child { border-bottom: none; }
.conn__logo { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 15px; flex-shrink: 0; color: var(--ag-surface); }
.conn__nm { font-size: 14.5px; font-weight: 600; }
.conn__st { font-size: 11.5px; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
.conn__dot { width: 6px; height: 6px; border-radius: 50%; }
.conn__act { margin-left: auto; flex-shrink: 0; }
.ag-soon { font-family: inherit; font-size: 11.5px; font-weight: 700; color: var(--ag-sub); background: #1a2026;
  border: none; border-radius: 99px; padding: 7px 12px; }
```

- [ ] **Step 2: Replace `profile/page.tsx`** (connection rows use `VENUE_META` colors; venue statuses match the spec: Kalshi + Polymarket connected, ProphetX soon, OddsJam data plan soon)

```tsx
'use client'
import { VENUE_META } from '../lib/catalog'

const CONNECTED: { venue: keyof typeof VENUE_META; status: 'connected' | 'soon' }[] = [
  { venue: 'kalshi', status: 'connected' },
  { venue: 'polymarket', status: 'connected' },
  { venue: 'prophetx', status: 'soon' },
]

export default function ProfileTab() {
  return (
    <>
      <div className="ag-apphead"><span className="ag-brand">Profile</span></div>

      <div className="ag-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2FD37A,#1a9e97)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#0B0D10', flexShrink: 0,
        }}>JF</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Jackson</div>
          <div className="ag-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            jacksonfitzgerald25@gmail.com
          </div>
        </div>
        <button className="ag-linkish">Edit</button>
      </div>

      <div className="ag-sechead">Your plan</div>
      <div className="ag-card ag-row">
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sneakers Pro</div>
          <div className="ag-sub ag-num" style={{ marginTop: 3 }}>$39/mo · trial ends Jul 20</div>
        </div>
        <button className="ag-linkish">Change</button>
      </div>

      <div className="ag-sechead">Trading venues</div>
      <div className="ag-card" style={{ padding: '4px 16px' }}>
        {CONNECTED.map(({ venue, status }) => {
          const v = VENUE_META[venue]
          return (
            <div className="conn" key={venue}>
              <div className="conn__logo" style={{ background: v.bg }}>{v.abbr}</div>
              <div>
                <div className="conn__nm">{v.label}</div>
                {status === 'connected' ? (
                  <div className="conn__st ag-pos"><span className="conn__dot" style={{ background: '#2FD37A' }} />Connected · live prices</div>
                ) : (
                  <div className="conn__st" style={{ color: '#98A2A8' }}><span className="conn__dot" style={{ background: '#98A2A8' }} />Available</div>
                )}
              </div>
              <div className="conn__act">
                {status === 'connected' ? <button className="ag-linkish">Manage</button> : <button className="ag-soon">Soon</button>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="ag-sechead">Data &amp; bots</div>
      <div className="ag-card" style={{ padding: '4px 16px' }}>
        <div className="conn">
          <div className="conn__logo" style={{ background: '#d98fff' }}>OJ</div>
          <div>
            <div className="conn__nm">OddsJam</div>
            <div className="conn__st" style={{ color: '#98A2A8' }}><span className="conn__dot" style={{ background: '#98A2A8' }} />Data plan · not subscribed</div>
          </div>
          <div className="conn__act"><button className="ag-soon">Soon</button></div>
        </div>
        <div className="conn">
          <div className="conn__logo" style={{ background: '#7de0d6' }}>🤖</div>
          <div>
            <div className="conn__nm">Trading Agents</div>
            <div className="conn__st" style={{ color: '#98A2A8' }}><span className="conn__dot" style={{ background: '#98A2A8' }} />Subscribe in Models tab</div>
          </div>
        </div>
      </div>

      <button className="ag-linkish" style={{ width: '100%', padding: '12px 0', marginTop: 14, color: '#FF5C5C', borderColor: '#2a323a' }}>
        Sign out
      </button>
    </>
  )
}
```

- [ ] **Step 3: Visual verify** — screenshot `/agent/profile`.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/agent
git commit -m "feat(agent-web): Profile tab — account, plan, venues, data connections"
```

---

### Task 11: Full-flow QA + build gate

**Files:**
- Modify: whatever the QA pass surfaces (fixes only, no new features).

- [ ] **Step 1: Run the unit suite** — `pnpm --filter @sneakers/platform test` → all green.

- [ ] **Step 2: Production build gate** — `pnpm --filter @sneakers/platform build` → compiles with no type errors. (Next 16 gotchas memory: `'use client'` re-exports taint server callers — the agent layout must import `AgentProvider` from the client file directly, which it does.)

- [ ] **Step 3: Manual flow QA with dev server** (`AGENT_PREVIEW=1 pnpm platform`, use Playwright MCP or headless-Chrome screenshots at 430px and 1280px widths):
  1. `/agent` — Up/Down breathing, states cycle every 4.5s, Pause freezes + grays the orb.
  2. Swipe/click through the carousel; Wave Rider shows `Subscribe · $9.99/mo` → tap → becomes equipped and live.
  3. `/agent/models` — subscribe via + button; OddsJam sheet shows "From $1 per day", no metrics.
  4. Add Agent → create prompt agent → lands on `/agent` centered; equip it.
  5. `/agent/balance` — add $100 → hero, spark endpoint, and tab-bar number all update.
  6. `/agent/profile` renders; desktop (1280px) shows the centered 430px column.
- [ ] **Step 4: Fix anything found, re-run Steps 1–2, commit**

```bash
git add -A apps/platform
git commit -m "feat(agent-web): phase-1 QA fixes — agent shell complete on mock engine"
```

---

## Later Phases (outline only — planned separately after Phase 1 ships)

- **Phase 2 — Contract:** implement `/api/agent/state|activity|models|config|pause` + `POST /api/agent/models(/:id/subscribe|equip|submit)` per the spec; Supabase migrations for `agent_models`, `user_agent_state`, `agent_model_subs`, `agent_configs`, `agent_decisions`, `wallet_ledger`; store gains a data source flag (`mock` | `live`) so components don't change.
- **Phase 3 — Worker paper-live:** `apps/agent-worker` writes decisions/state per 5/15-min window for the equipped model; state/activity endpoints go real; "Reconnecting…" stale-state treatment.
- **Phase 4 — Stripe test rails:** Payment Element deposit flow, test-mode subscription Products/Prices per model, plan card via Stripe Billing; entry+success logging on every Stripe call.
- **Phase 5 — iOS port:** SwiftUI 4-tab app against the same API; keep existing auth/biometry from `apps/ios`.
