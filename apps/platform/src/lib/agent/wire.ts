// Pure mapping + validation layer between the agent DB rows and the wire
// shapes the Phase-1 UI already consumes. No I/O in this module.
import type {
  AgentModel, AgentPhase, CreateAgentInput, Decision, LedgerEntry, OrbColor, Venue,
} from '@/app/agent/lib/types'

export const PRESETS = ['longshot', 'momentum', 'fade', 'conservative'] as const
const COLORS: OrbColor[] = ['green', 'blue', 'purple', 'gold', 'red', 'cyan', 'updown', 'oddsjam', 'gambly']
const USER_COLORS: OrbColor[] = ['green', 'blue', 'purple', 'gold', 'red', 'cyan']

export interface AgentModelRow {
  id: string
  name: string
  emoji: string | null
  brand: 'oddsjam' | 'gambly' | null
  color: string
  author: string
  perf_30d: number | string | null
  runners: number
  price_cents: number | null
  price_label: string | null
  tagline: string | null
  description: string
  status: 'live' | 'review' | 'coming_soon' | 'private'
  featured: boolean
  included: boolean
  kind: 'prompt' | 'connected'
  owner_user_id: string | null
  sort_order: number
}

export function rowToModel(row: AgentModelRow, userId: string | null): AgentModel {
  const mine = row.owner_user_id !== null && row.owner_user_id === userId
  return {
    id: row.id,
    name: row.name,
    color: (COLORS.includes(row.color as OrbColor) ? row.color : 'green') as OrbColor,
    ...(row.emoji ? { emoji: row.emoji } : {}),
    ...(row.brand ? { brand: row.brand } : {}),
    by: mine ? 'you' : row.author,
    perf30d: row.perf_30d === null ? null : Number(row.perf_30d),
    runners: row.runners,
    priceCents: row.price_cents,
    ...(row.price_label ? { priceLabel: row.price_label } : {}),
    ...(row.tagline ? { tagline: row.tagline } : {}),
    description: row.description,
    ...(row.featured ? { featured: true } : {}),
    ...(row.included ? { included: true } : {}),
    ...(mine ? { mine: true } : {}),
    status: row.status,
    kind: row.kind,
  }
}

export function myModelEntry(cfg: { name: string; emoji: string; color: string }): AgentModel {
  return {
    id: 'my-model',
    name: cfg.name,
    color: (COLORS.includes(cfg.color as OrbColor) ? cfg.color : 'green') as OrbColor,
    emoji: cfg.emoji,
    by: 'you',
    perf30d: null,
    runners: 1,
    priceCents: null,
    mine: true,
    status: 'private',
    kind: 'prompt',
    description: 'Your model. Edit its strategy prompt in Models → My Model — it re-reads the prompt before every window.',
  }
}

// Deterministic synthesized status until the worker goes live (Phase 3).
// Same copy + cadence (4.5s) as the Phase-1 mock so web and iOS agree.
const PHASES: { phase: AgentPhase; title: string; sub: string }[] = [
  { phase: 'scanning', title: 'Scanning 14 markets', sub: 'BTC · ETH · SOL — 5 & 15-min windows on Kalshi + Polymarket' },
  { phase: 'entering', title: 'Entering position', sub: 'ETH above $3,410 at 2:30p · buying Yes at 27¢' },
  { phase: 'holding', title: 'Holding 2 positions', sub: 'Next settle in 4m 12s' },
  { phase: 'scanning', title: 'Scanning 14 markets', sub: 'Last window: +$21.60 · 12 trades today' },
]

export function phaseAt(nowMs: number, paused: boolean): { phase: AgentPhase | 'paused'; title: string; sub: string } {
  if (paused) return { phase: 'paused', title: 'Paused', sub: 'The agent will not enter new positions.' }
  return PHASES[Math.floor(nowMs / 4500) % PHASES.length]
}

/** Running-balance series from ledger entries (any order; sorted by `at` asc). */
export function sparkFromLedger(entries: { amountCents: number; at: string }[]): number[] {
  const asc = [...entries].sort((a, b) => a.at.localeCompare(b.at))
  const out: number[] = []
  let run = 0
  for (const e of asc) {
    run += e.amountCents
    out.push(run)
  }
  if (out.length === 1) out.push(out[0])
  return out
}

export function decisionRowToWire(row: {
  id: string; venue: string; action: string; title: string; detail: string
  pnl_cents: number | string | null; created_at: string
}): Decision {
  return {
    id: row.id,
    venue: row.venue as Venue,
    action: row.action as Decision['action'],
    title: row.title,
    detail: row.detail,
    pnlCents: row.pnl_cents === null ? null : Number(row.pnl_cents),
    at: row.created_at,
  }
}

export function ledgerRowToWire(row: {
  id: string; kind: string; label: string; detail: string
  amount_cents: number | string; created_at: string
}): LedgerEntry {
  return {
    id: row.id,
    kind: row.kind as LedgerEntry['kind'],
    label: row.label,
    detail: row.detail,
    amountCents: Number(row.amount_cents),
    at: row.created_at,
  }
}

type FieldError = { field: string; message: string }

export function validateCreateAgent(body: unknown):
  { value: CreateAgentInput; error: null } | { value: null; error: FieldError } {
  const b = (body ?? {}) as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const emoji = typeof b.emoji === 'string' ? b.emoji.trim() : ''
  const color = typeof b.color === 'string' ? b.color : ''
  const kind = b.kind === 'connected' ? 'connected' : b.kind === 'prompt' ? 'prompt' : null

  if (name.length > 40) return { value: null, error: { field: 'name', message: 'Name must be 40 characters or fewer.' } }
  if (!emoji || emoji.length > 8) return { value: null, error: { field: 'emoji', message: 'Pick an emoji.' } }
  if (!USER_COLORS.includes(color as OrbColor)) return { value: null, error: { field: 'color', message: 'Pick a color.' } }
  if (!kind) return { value: null, error: { field: 'kind', message: 'kind must be prompt or connected.' } }

  if (kind === 'connected') {
    const endpointUrl = typeof b.endpointUrl === 'string' ? b.endpointUrl.trim() : ''
    const apiKey = typeof b.apiKey === 'string' ? b.apiKey.trim() : ''
    if (!endpointUrl.startsWith('https://') || endpointUrl.length > 300) {
      return { value: null, error: { field: 'endpointUrl', message: 'Endpoint must be an https:// URL.' } }
    }
    if (apiKey.length < 8 || apiKey.length > 200) {
      return { value: null, error: { field: 'apiKey', message: 'API key looks wrong (8–200 characters).' } }
    }
    return { value: { name, emoji, color: color as OrbColor, kind, endpointUrl, apiKey }, error: null }
  }

  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : ''
  if (prompt.length > 2000) return { value: null, error: { field: 'prompt', message: 'Prompt must be 2000 characters or fewer.' } }
  return { value: { name, emoji, color: color as OrbColor, kind, ...(prompt ? { prompt } : {}) }, error: null }
}

export function validateConfigPut(body: unknown):
  { value: Partial<{ name: string; emoji: string; color: OrbColor; prompt: string; preset: string }>; error: null }
  | { value: null; error: FieldError } {
  const b = (body ?? {}) as Record<string, unknown>
  const out: Partial<{ name: string; emoji: string; color: OrbColor; prompt: string; preset: string }> = {}
  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 40) {
      return { value: null, error: { field: 'name', message: 'Name must be 1–40 characters.' } }
    }
    out.name = b.name.trim()
  }
  if (b.emoji !== undefined) {
    if (typeof b.emoji !== 'string' || !b.emoji.trim() || b.emoji.trim().length > 8) {
      return { value: null, error: { field: 'emoji', message: 'Pick an emoji.' } }
    }
    out.emoji = b.emoji.trim()
  }
  if (b.color !== undefined) {
    if (typeof b.color !== 'string' || !USER_COLORS.includes(b.color as OrbColor)) {
      return { value: null, error: { field: 'color', message: 'Pick a color.' } }
    }
    out.color = b.color as OrbColor
  }
  if (b.prompt !== undefined) {
    if (typeof b.prompt !== 'string' || b.prompt.length > 2000) {
      return { value: null, error: { field: 'prompt', message: 'Prompt must be 2000 characters or fewer.' } }
    }
    out.prompt = b.prompt
  }
  if (b.preset !== undefined) {
    if (typeof b.preset !== 'string' || !(PRESETS as readonly string[]).includes(b.preset)) {
      return { value: null, error: { field: 'preset', message: 'Unknown preset.' } }
    }
    out.preset = b.preset
  }
  return { value: out, error: null }
}

// ── Bootstrap fixtures (until the worker writes real rows in Phase 3) ──
// Amounts mirror the Phase-1 mock: ledger sums to the 124762 default
// balance; decision P&L sums to 3580 for day-one Today P&L.
export const SEED_DECISIONS_LIVE = [
  { venue: 'kalshi', action: 'settled', title: 'Settled: BTC above $109,250 at 2:15p — Yes hit', detail: 'Kalshi · +$21.60', pnl_cents: 2160, minutes_ago: 5 },
  { venue: 'polymarket', action: 'entered', title: 'Entered ETH above $3,410 at 2:30p · 27¢ × 80', detail: 'Polymarket · momentum + book imbalance', pnl_cents: null, minutes_ago: 9 },
  { venue: 'prophetx', action: 'settled', title: 'Settled: Thunder −4.5 vs Pacers — covered', detail: 'ProphetX · +$14.20', pnl_cents: 1420, minutes_ago: 27 },
  { venue: 'kalshi', action: 'passed', title: 'Passed on SOL range 2:15p — spread too wide', detail: 'Kalshi · gate: liquidity floor', pnl_cents: null, minutes_ago: 12 },
] as const

export const SEED_LEDGER_LIVE = [
  { kind: 'starting', label: 'Starting balance', detail: 'Paper account opened', amount_cents: 72196, days_ago: 10 },
  { kind: 'settlement', label: 'Trade settlements (31)', detail: 'Paper trading', amount_cents: -1248, days_ago: 8 },
  { kind: 'deposit', label: 'Added cash', detail: 'Visa ··4242 (test)', amount_cents: 50000, days_ago: 7 },
  { kind: 'settlement', label: 'Trade settlements (12)', detail: 'Paper trading', amount_cents: 3814, days_ago: 0 },
] as const
