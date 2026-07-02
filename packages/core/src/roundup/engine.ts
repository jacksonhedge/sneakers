export interface RoundUpRule {
  roundToCents: number
  multiplier: number
  thresholdCents: number
  weeklyCapCents: number
}

export interface Txn {
  id: string
  merchant: string
  amountCents: number
  date: string
}

export interface RoundUp {
  txnId: string
  roundUpCents: number
}

export function computeRoundUpCents(amountCents: number, roundToCents: number, multiplier: number): number {
  const remainder = ((amountCents % roundToCents) + roundToCents) % roundToCents
  const base = remainder === 0 ? 0 : roundToCents - remainder
  return base * multiplier
}

export function roundUpsFor(txns: Txn[], rule: RoundUpRule): RoundUp[] {
  return txns.map((t) => ({
    txnId: t.id,
    roundUpCents: computeRoundUpCents(t.amountCents, rule.roundToCents, rule.multiplier),
  }))
}

export function accruedCents(roundUps: RoundUp[]): number {
  return roundUps.reduce((sum, r) => sum + r.roundUpCents, 0)
}

export function thresholdReached(accrued: number, rule: RoundUpRule): boolean {
  return accrued >= rule.thresholdCents
}

export function transferableCents(accrued: number, rule: RoundUpRule, transferredThisWeekCents: number): number {
  const remainingCap = rule.weeklyCapCents - transferredThisWeekCents
  return Math.max(0, Math.min(accrued, remainingCap))
}
