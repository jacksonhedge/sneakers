// Chance market source: returns MarketSnapshot[] for a venue.
//
// This is a lean LIVE fetch so the demo is self-contained. In production,
// swap `loadVenueSnapshots` to read the cached Railway data instead
// (markets-data#loadSnapshotsResolvingWithin) for checkout-speed reads.

import type { MarketSnapshot, MarketPhase } from '../markets-data'
import type { Venue } from './eligibility'

const GAMMA_BASE = 'https://gamma-api.polymarket.com'

// A focused set of tags that tend to have soon-resolving, liquid markets.
const POLY_TAGS = ['nba', 'nfl', 'mlb', 'nhl', 'soccer', 'ufc', 'tennis', 'crypto']

interface GammaMarket {
  question?: string
  slug?: string
  closed?: boolean
  archived?: boolean
  outcomes?: string
  outcomePrices?: string
  liquidityNum?: number
  liquidity?: string
  volume?: string
  endDate?: string
  conditionId?: string
  id?: string
}
interface GammaEvent {
  title?: string
  tags?: Array<{ slug?: string; label?: string }>
  markets?: GammaMarket[]
}

function parseArr(s: string | undefined): string[] | null {
  if (!s) return null
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : null
  } catch {
    return null
  }
}

async function fetchPolymarketSnapshots(): Promise<MarketSnapshot[]> {
  const ts = new Date().toISOString()
  const out: MarketSnapshot[] = []
  const seen = new Set<string>()

  await Promise.all(
    POLY_TAGS.map(async (tag) => {
      try {
        const res = await fetch(
          `${GAMMA_BASE}/events?closed=false&active=true&limit=40&tag_slug=${tag}`,
          { headers: { accept: 'application/json' } },
        )
        if (!res.ok) return
        const events = (await res.json()) as GammaEvent[]
        for (const ev of events) {
          const tags = (ev.tags ?? []).map((t) => t.slug ?? '').filter(Boolean)
          for (const m of ev.markets ?? []) {
            if (m.closed || m.archived) continue
            const id = m.conditionId || m.id || m.slug
            if (!id || seen.has(id)) continue
            const names = parseArr(m.outcomes)
            const prices = parseArr(m.outcomePrices)
            if (!names || !prices || names.length !== prices.length) continue
            seen.add(id)
            out.push({
              platform: 'polymarket',
              platform_market_id: m.slug || id,
              question: m.question ?? ev.title ?? '',
              tags,
              outcomes: names.map((name, i) => {
                const p = Number(prices[i])
                return {
                  name,
                  best_bid: null,
                  best_ask: Number.isFinite(p) ? p : null,
                  last_price: Number.isFinite(p) ? p : null,
                }
              }),
              overround: null,
              volume_traded: m.volume ?? null,
              liquidity: m.liquidityNum ?? (m.liquidity ? Number(m.liquidity) : null),
              resolves_at: m.endDate,
              phase: 'pre_game' as MarketPhase,
              ts,
            })
          }
        }
      } catch {
        /* tag fetch failed — skip */
      }
    }),
  )

  return out
}

/**
 * Load candidate markets for a venue. Polymarket is wired live; Kalshi returns
 * empty for now (the US path surfaces a "coming online" state rather than
 * faking data).
 */
export async function loadVenueSnapshots(venue: Venue): Promise<MarketSnapshot[]> {
  if (venue === 'polymarket') return fetchPolymarketSnapshots()
  // TODO(kalshi): wire via the Kalshi scraper / cached DB. Until then, US
  // (Kalshi) eligibility shows an honest "coming online" state.
  return []
}
