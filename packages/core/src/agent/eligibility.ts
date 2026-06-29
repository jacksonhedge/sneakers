export const PROOF_MIN_DAYS = 7
export const PROOF_MIN_TRADES = 50

export interface LiveContext {
  botCreatedAtMs: number
  settledDryRunTrades: number
  consentVersionAccepted: string | null
  currentConsentVersion: string
  venueConnected: boolean
  nowMs: number
}

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string }

export function liveEligibility(ctx: LiveContext): EligibilityResult {
  // Convert days to milliseconds for comparison
  const minProofMs = PROOF_MIN_DAYS * 24 * 60 * 60 * 1000
  const ageMs = ctx.nowMs - ctx.botCreatedAtMs

  // Check 1: Proof period (bot must be >= 7 days old)
  if (ageMs < minProofMs) {
    return { eligible: false, reason: 'proof_period' }
  }

  // Check 2: Proof trades (must have >= 50 settled dry-run trades)
  if (ctx.settledDryRunTrades < PROOF_MIN_TRADES) {
    return { eligible: false, reason: 'proof_trades' }
  }

  // Check 3: Consent required (must have accepted current version)
  if (ctx.consentVersionAccepted !== ctx.currentConsentVersion) {
    return { eligible: false, reason: 'consent_required' }
  }

  // Check 4: Not connected (must have venue connected)
  if (!ctx.venueConnected) {
    return { eligible: false, reason: 'not_connected' }
  }

  // All checks passed
  return { eligible: true }
}
