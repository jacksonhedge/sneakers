import Link from 'next/link'
import {
  loadMinuteMarkets,
  type MinuteMarket,
  type MinuteMarketsResult,
} from '@/lib/minute-markets'
import { loadMarketsPage, type MarketSnapshot, type MarketSort } from '@/lib/markets-data'
import { MarketsMinuteView, type SerializedGroup, type SerializedMarket } from '../components/markets-minute-view'
import { MarketsAllView, type SerializedRow, type AllViewSort } from '../components/markets-all-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Markets — Sneakers' }

const WITHINS = [5, 15, 30, 60, 120, 240]
const ALL_PAGE_SIZE = 50
const VALID_ALL_SORTS: AllViewSort[] = ['volume', 'overround', 'resolves_at', 'updated']

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

// Same YES-outcome derivation as yesAskOf above, applied to the crypto-listing
// MarketSnapshot shape (loadMarketsPage) instead of MinuteMarket — both share
// the same {name, best_ask} outcome contract (see market-card.tsx's topAsk
// for the "tightest ask across all outcomes" variant used on /markets; this
// mirrors the minute view's YES-specific pick instead).
function yesPriceOfSnapshot(m: MarketSnapshot): number | null {
  const yes = m.outcomes.find((o) => /^yes\b|\byes\s/i.test(o.name))
  return yes?.best_ask ?? m.outcomes[0]?.best_ask ?? null
}

// volume_traded arrives as number | string | null (Postgres numeric columns
// round-trip as strings) — same coercion markets-data.ts's internal volOf
// does for the JSONL fallback sort.
function volumeOf(v: number | string | null): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function serializeRow(m: MarketSnapshot): SerializedRow {
  return {
    id: `${m.platform}:${m.platform_market_id}`,
    question: m.question,
    platform: m.platform,
    yesPrice: yesPriceOfSnapshot(m),
    volume: volumeOf(m.volume_traded),
    resolvesAt: m.resolves_at ?? null,
    overround: m.overround,
  }
}

function segHref(view: 'minute' | 'all'): string {
  return view === 'all' ? '/agent/markets?view=all' : '/agent/markets'
}

// Shared across both Markets segments — lives here (not inside either view
// component) so neither markets-minute-view.tsx nor markets-all-view.tsx
// needs to know the other exists.
function MarketsSegControl({ view }: { view: 'minute' | 'all' }) {
  return (
    <div className="ag-seg" role="tablist">
      <Link href={segHref('minute')} role="tab" aria-selected={view === 'minute'} className={view === 'minute' ? 'on' : ''}>
        Minute
      </Link>
      <Link href={segHref('all')} role="tab" aria-selected={view === 'all'} className={view === 'all' ? 'on' : ''}>
        All markets
      </Link>
    </div>
  )
}

export default async function AgentMarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ within?: string; asset?: string; view?: string; page?: string; sort?: string; platform?: string }>
}) {
  const sp = await searchParams
  const view: 'minute' | 'all' = sp.view === 'all' ? 'all' : 'minute'

  if (view === 'all') {
    const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
    const sortRaw = (sp.sort ?? '').trim().toLowerCase()
    const sort: MarketSort = (VALID_ALL_SORTS as string[]).includes(sortRaw) ? (sortRaw as MarketSort) : 'volume'
    const platform = sp.platform?.trim().toLowerCase() || undefined
    const result = await loadMarketsPage({ page, pageSize: ALL_PAGE_SIZE, sort, platform })
    return (
      <>
        <MarketsSegControl view="all" />
        <MarketsAllView
          rows={result.markets.map(serializeRow)}
          total={result.total}
          page={page}
          pageSize={ALL_PAGE_SIZE}
          sort={sort}
          platform={platform ?? null}
          platforms={result.availablePlatforms}
          fromDb={result.fromDb}
        />
      </>
    )
  }

  const within = WITHINS.includes(Number(sp.within)) ? Number(sp.within) : 60
  // Uppercased here (not just trimmed) so it matches the uppercase asset
  // symbols loadMinuteMarkets/extractAsset produce (e.g. "BTC") — otherwise
  // a lowercase query param would never match a group and the active-chip
  // state and empty-state copy would silently disagree with the data.
  const asset = sp.asset?.trim().toUpperCase() || null
  const result = await loadMinuteMarkets({ within, asset: asset ?? undefined, grouped: true, cryptoOnly: true })
  return (
    <>
      <MarketsSegControl view="minute" />
      <MarketsMinuteView
        groups={serializeGroups(result)}
        within={within}
        asset={asset}
        generatedAt={new Date().toISOString()}
      />
    </>
  )
}
