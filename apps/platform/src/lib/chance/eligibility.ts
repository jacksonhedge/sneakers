// Chance eligibility + venue routing by geography.
//
// Location is a LEGALITY gate, not personalization:
//   - eligible US state  → Kalshi   (CFTC-regulated, US-legal)
//   - eligible non-US    → Polymarket
//   - anything else      → not offered
//
// NOTE: these lists are placeholders for wiring. The real allow/block lists
// come from docs/VENUE_STATES.md + legal sign-off before launch. Polymarket's
// US availability in particular must be confirmed with counsel.

export type Venue = 'kalshi' | 'polymarket'

export interface Eligibility {
  eligible: boolean
  venue: Venue | null
  country: string | null
  region: string | null
  reason: string
}

// US states where event-contract trading is currently treated as restricted
// (placeholder — confirm against VENUE_STATES + counsel).
const US_BLOCKED_STATES = new Set(['WA', 'ID', 'NV', 'MI', 'AZ', 'LA', 'LA', 'CT', 'TN'])

// Countries Polymarket cannot serve (placeholder — confirm against ToS/sanctions).
const INTL_BLOCKED_COUNTRIES = new Set(['', 'CU', 'IR', 'KP', 'SY', 'RU'])

export function resolveEligibility(
  country: string | null,
  region: string | null,
): Eligibility {
  const c = (country ?? '').toUpperCase()
  const r = (region ?? '').toUpperCase()

  if (!c) {
    return { eligible: false, venue: null, country: null, region: null, reason: 'unknown-location' }
  }

  if (c === 'US') {
    if (US_BLOCKED_STATES.has(r)) {
      return { eligible: false, venue: null, country: c, region: r, reason: 'state-restricted' }
    }
    return { eligible: true, venue: 'kalshi', country: c, region: r, reason: 'ok' }
  }

  if (INTL_BLOCKED_COUNTRIES.has(c)) {
    return { eligible: false, venue: null, country: c, region: r, reason: 'country-restricted' }
  }
  return { eligible: true, venue: 'polymarket', country: c, region: r || null, reason: 'ok' }
}

/** Public label + verification link for a venue (pop-up branding). */
export function venueBrand(venue: Venue): { name: string; verb: string; marketUrl: (slugOrId: string) => string } {
  if (venue === 'kalshi') {
    return {
      name: 'Kalshi',
      verb: 'Settled on',
      marketUrl: (id) => `https://kalshi.com/markets/${id}`,
    }
  }
  return {
    name: 'Polymarket',
    verb: 'Routed to',
    marketUrl: (id) => `https://polymarket.com/market/${id}`,
  }
}
