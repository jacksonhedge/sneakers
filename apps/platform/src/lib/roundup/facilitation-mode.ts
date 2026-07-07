// Reads which facilitation mode is active from environment variables. This
// is a global (not per-session) switch -- per the Milestone 2 design's
// "one market for everyone, admin-configured" decision, there is no admin
// UI or per-user picker in this pass. Changing the mode or target market
// means editing these env vars and restarting the server.

export type FacilitationMode = { kind: 'wallet' } | { kind: 'polymarket'; marketId: string }

export function getFacilitationMode(): FacilitationMode {
  const raw = process.env.ROUNDUP_FACILITATION_MODE
  if (raw !== 'polymarket') {
    return { kind: 'wallet' }
  }
  const marketId = process.env.ROUNDUP_POLYMARKET_MARKET_ID
  if (!marketId) {
    throw new Error(
      'ROUNDUP_FACILITATION_MODE=polymarket requires ROUNDUP_POLYMARKET_MARKET_ID to also be set',
    )
  }
  return { kind: 'polymarket', marketId }
}
