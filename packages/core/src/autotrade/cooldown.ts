export interface CooldownInput {
  lastTradeAtMs: number | null
  cooldownSeconds: number
  nowMs: number
}

export type CooldownResult = { ok: true } | { ok: false; reason: 'cooldown'; retryAfterMs: number }

export function checkCooldown(input: CooldownInput): CooldownResult {
  if (input.lastTradeAtMs === null) return { ok: true }

  const cooldownMs = input.cooldownSeconds * 1000
  const elapsedMs = input.nowMs - input.lastTradeAtMs
  if (elapsedMs >= cooldownMs) return { ok: true }

  return { ok: false, reason: 'cooldown', retryAfterMs: cooldownMs - elapsedMs }
}
