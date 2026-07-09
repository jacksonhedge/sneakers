import {
  loadMinuteMarkets,
  type MinuteMarket,
  type MinuteMarketsResult,
} from '@/lib/minute-markets'
import { MarketsMinuteView, type SerializedGroup, type SerializedMarket } from '../components/markets-minute-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Markets — Sneakers' }

const WITHINS = [5, 15, 30, 60, 120, 240]

// Same YES-side derivation as the legacy /dashboard/minute GroupCard: AMM
// platforms (Limitless) emit "Yes"/"No", OG emits "YES X"/"NO X" — match
// either, falling back to the first outcome so the ladder never blanks out.
function yesAskOf(m: MinuteMarket): number | null {
  const yes = m.outcomes.find((o) => /^yes\b|\byes\s/i.test(o.name))
  return yes?.best_ask ?? m.outcomes[0]?.best_ask ?? null
}

function serializeMarket(m: MinuteMarket): SerializedMarket {
  return {
    platform: m.platform,
    marketId: m.market_id,
    question: m.question,
    asset: m.asset,
    strike: m.strike,
    direction: m.direction,
    yesPrice: yesAskOf(m),
    volume: m.volume,
    change5m: m.change_5m,
    movementSamples: m.movement_samples,
    bucket: m.bucket,
  }
}

function serializeGroups(result: MinuteMarketsResult): SerializedGroup[] {
  return (result.groups ?? []).map((g) => ({
    asset: g.asset,
    resolvesAt: g.resolves_at,
    minutesToResolve: g.minutes_to_resolve,
    bucket: g.bucket,
    platforms: g.platforms,
    marketCount: g.market_count,
    strikeMin: g.strike_min,
    strikeMax: g.strike_max,
    markets: g.markets.map(serializeMarket),
  }))
}

export default async function AgentMarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ within?: string; asset?: string }>
}) {
  const sp = await searchParams
  const within = WITHINS.includes(Number(sp.within)) ? Number(sp.within) : 60
  // Uppercased here (not just trimmed) so it matches the uppercase asset
  // symbols loadMinuteMarkets/extractAsset produce (e.g. "BTC") — otherwise
  // a lowercase query param would never match a group and the active-chip
  // state and empty-state copy would silently disagree with the data.
  const asset = sp.asset?.trim().toUpperCase() || null
  const result = await loadMinuteMarkets({ within, asset: asset ?? undefined, grouped: true, cryptoOnly: true })
  return (
    <MarketsMinuteView
      groups={serializeGroups(result)}
      within={within}
      asset={asset}
      generatedAt={new Date().toISOString()}
    />
  )
}
