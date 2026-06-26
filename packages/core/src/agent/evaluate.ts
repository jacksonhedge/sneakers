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
