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
