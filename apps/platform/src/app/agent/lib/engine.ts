import type { AgentModel, AgentPhase, CreateAgentInput, Decision, LedgerEntry, OrbColor } from './types'
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
  serverPnlCents: number | null
}

export type AgentAction =
  | { type: 'subscribe'; id: string }
  | { type: 'equip'; id: string }
  | { type: 'togglePaused' }
  | { type: 'tick' }
  | { type: 'deposit'; cents: number }
  | { type: 'createAgent'; input: CreateAgentInput }
  | { type: 'sync'; patch: Partial<Pick<AgentUIState, 'models' | 'equippedId' | 'subscribedIds' | 'paused' | 'balanceCents' | 'decisions' | 'ledger' | 'spark' | 'serverPnlCents'>> }
  | { type: 'modelCreated'; model: AgentModel }
  | { type: 'updateConfig'; patch: { name?: string; emoji?: string; color?: OrbColor; prompt?: string; preset?: string } }

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
    serverPnlCents: null,
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
    case 'sync':
      return { ...s, ...a.patch }
    case 'modelCreated': {
      const i = s.models.findIndex(m => m.id === a.model.id)
      if (i === -1) return { ...s, models: [...s.models, a.model] }
      const models = [...s.models]
      models[i] = a.model
      return { ...s, models }
    }
    case 'updateConfig': {
      const models = s.models.map(m =>
        m.mine
          ? {
              ...m,
              ...(a.patch.name ? { name: a.patch.name } : {}),
              ...(a.patch.emoji ? { emoji: a.patch.emoji } : {}),
              ...(a.patch.color ? { color: a.patch.color } : {}),
            }
          : m,
      )
      return { ...s, models }
    }
  }
}
