export const CEIL = {
  perTradeUsd: 50,
  perDayUsd: 200,
  cooldownMs: 300_000,
  maxOpenPositions: 20,
}

export interface LiveSizeInput {
  requestedUsd: number
  spentTodayUsd: number
  openPositions: number
  lastLiveTradeAtMs: number | null
  nowMs: number
}

export type LiveSizeResult = { ok: true; sizeUsd: number } | { ok: false; reason: string }

export function clampToCeilings(i: LiveSizeInput): LiveSizeResult {
  // Check 1: Cooldown not elapsed
  if (i.lastLiveTradeAtMs !== null && i.nowMs - i.lastLiveTradeAtMs < CEIL.cooldownMs) {
    return { ok: false, reason: 'cooldown' }
  }

  // Check 2: Open positions at ceiling
  if (i.openPositions >= CEIL.maxOpenPositions) {
    return { ok: false, reason: 'max_positions' }
  }

  // Check 3: Daily ceiling exhausted
  const remaining = CEIL.perDayUsd - i.spentTodayUsd
  if (remaining <= 0) {
    return { ok: false, reason: 'daily_ceiling' }
  }

  // Check 4: Compute final size and check for zero
  const sizeUsd = Math.min(i.requestedUsd, CEIL.perTradeUsd, remaining)
  if (sizeUsd <= 0) {
    return { ok: false, reason: 'zero_size' }
  }

  return { ok: true, sizeUsd }
}
