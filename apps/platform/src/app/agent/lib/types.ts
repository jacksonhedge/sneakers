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
