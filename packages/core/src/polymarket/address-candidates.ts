/**
 * Polymarket's own client ecosystem has a documented, recurring bug class:
 * an API key trio can end up registered under either the EOA ("signer")
 * address or the proxy/funder address, inconsistently, depending on how it
 * was created (see Polymarket/py-clob-client#339). There is no reliable way
 * to know in advance which one a given trio needs — so callers try both.
 */
export interface AddressSources {
  walletAddress?: string
  funderAddress?: string
}

export function buildAddressCandidates(sources: AddressSources): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()

  for (const addr of [sources.walletAddress, sources.funderAddress]) {
    if (!addr) continue
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(addr)
  }

  return candidates
}
