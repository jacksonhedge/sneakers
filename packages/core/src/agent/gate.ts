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
