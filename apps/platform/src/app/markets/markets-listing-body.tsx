import Link from 'next/link'
import {
  loadSparklinesForMarkets,
  type MarketPhase,
  type MarketSort,
} from '@/lib/markets-data'
import type { ChartPoint } from '@/components/robinhood-chart'
import { type TerminalCategory } from '@/lib/market-stats'
import { loadMarketsListingPage } from '@/lib/canonical-markets'
import { MarketCard } from './market-card'
import { FilterBar } from './filter-bar'
import { PlatformFreshnessStrip } from './platform-freshness-strip'

// Body of the /markets listing — data loading + filter/sort/paginate +
// the listing JSX (h1, freshness strip, filter bar, grid of MarketCards,
// pagination, footer). Reused by:
//   - /markets/page.tsx (public-style chrome — DashboardTopbar + DashboardSidebar)
//   - /dashboard/markets/page.tsx (dashboard layout chrome — inherits topbar +
//     OToole panel from the parent layout, no body remount on nav)
//
// Auth is the parent's job (each consumer either redirect()s or relies on
// the dashboard layout for the gate). This component just renders given
// the resolved searchParams.

const VALID_CATEGORIES: TerminalCategory[] = [
  'politics',
  'economics',
  'crypto',
  'sports',
  'tech',
  'other',
]
const VALID_PHASES: MarketPhase[] = ['opening', 'pre_game', 'live', 'closed']
const VALID_SORTS: MarketSort[] = ['volume', 'overround', 'resolves_at', 'updated']

const PAGE_SIZE = 50

export interface MarketsListingParams {
  q?: string
  platform?: string
  sport?: string
  category?: string
  phase?: string
  sort?: string
  page?: string
}

export async function MarketsListingBody({
  searchParams,
  hrefBase,
}: {
  searchParams: MarketsListingParams
  /** URL prefix for pagination links — `/markets` for the public page,
   *  `/dashboard/markets` for the in-app page. */
  hrefBase: '/markets' | '/dashboard/markets'
}) {
  const sp = searchParams
  const q = (sp.q ?? '').trim()
  const platform = (sp.platform ?? '').trim().toLowerCase()
  const sport = (sp.sport ?? '').trim().toLowerCase()
  const categoryRaw = (sp.category ?? '').trim().toLowerCase()
  const phaseRaw = (sp.phase ?? '').trim().toLowerCase()
  const sortRaw = (sp.sort ?? '').trim().toLowerCase()
  const category = (VALID_CATEGORIES as string[]).includes(categoryRaw)
    ? (categoryRaw as TerminalCategory)
    : undefined
  const phase = (VALID_PHASES as string[]).includes(phaseRaw)
    ? (phaseRaw as MarketPhase)
    : undefined
  const sort: MarketSort = (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as MarketSort)
    : 'volume'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  // Filter / sort / paginate are pushed into SQL (via markets.canonical_id) —
  // see loadMarketsListingPage. One card per canonical market; singletons and
  // multi-venue alike.
  const {
    markets: paged,
    total,
    totalPages,
    availablePlatforms,
    availableSports,
    perBook,
    multiVenueCount,
    latestDate,
  } = await loadMarketsListingPage({
    q: q || undefined,
    platform: platform || undefined,
    sport: sport || undefined,
    category,
    phase,
    sort,
    page,
    pageSize: PAGE_SIZE,
  })

  // Sparklines on visible cards only — bounded SQL pull keyed by the primary
  // venue's market_id, the same key MarketCard looks up below.
  let sparklineByKey = new Map<string, ChartPoint[]>()
  try {
    const repIds = paged.map(
      (c) => `${c.quotes[0].platform}:${c.quotes[0].platform_market_id}`,
    )
    sparklineByKey = await loadSparklinesForMarkets(repIds)
  } catch (err) {
    console.warn('[markets-listing-body] sparkline load failed', err)
    sparklineByKey = new Map()
  }

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (platform) params.set('platform', platform)
    if (sport) params.set('sport', sport)
    if (category) params.set('category', category)
    if (phase) params.set('phase', phase)
    if (sort !== 'volume') params.set('sort', sort)
    if (newPage > 1) params.set('page', String(newPage))
    const qs = params.toString()
    return `${hrefBase}${qs ? '?' + qs : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-stone-900">All markets</h1>
        <div className="text-[11px] text-stone-500 tracking-wider font-mono tabular-nums">
          {total.toLocaleString()} markets
          <span className="text-stone-300 mx-2">·</span>
          <span className="text-stone-600">{multiVenueCount.toLocaleString()}</span> multi-book
          {latestDate && (
            <>
              <span className="text-stone-300 mx-2">·</span>
              snapshot {latestDate}
            </>
          )}
        </div>
      </div>

      <PlatformFreshnessStrip perBook={perBook} />

      <FilterBar
        platforms={availablePlatforms}
        sports={availableSports}
        currentQuery={q}
        currentPlatform={platform}
        currentSport={sport}
        currentCategory={category ?? ''}
        currentPhase={phase ?? ''}
        currentSort={sort}
      />

      {paged.length === 0 ? (
        <div className="rounded-lg ring-1 ring-stone-200 bg-white p-10 text-center">
          <div className="text-sm text-stone-800 font-semibold mb-2">
            No markets match these filters.
          </div>
          <div className="text-xs text-stone-500">
            {total === 0 && availablePlatforms.length === 0
              ? 'No live data yet — markets will populate shortly.'
              : 'Try a different search, platform, or sport.'}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((c) => {
              const key = `${c.quotes[0].platform}:${c.quotes[0].platform_market_id}`
              return (
                <MarketCard
                  key={c.id}
                  market={c}
                  sparkline={sparklineByKey.get(key)}
                />
              )
            })}
          </div>

          <div className="flex justify-between items-center text-xs text-stone-500 pt-4">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1)}
                  prefetch={false}
                  className="ring-1 ring-stone-300 text-stone-700 px-3 py-1.5 rounded hover:bg-stone-100 hover:ring-stone-400 transition"
                >
                  ← prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildPageUrl(page + 1)}
                  prefetch={false}
                  className="ring-1 ring-stone-300 text-stone-700 px-3 py-1.5 rounded hover:bg-stone-100 hover:ring-stone-400 transition"
                >
                  next →
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      <footer className="pt-6 border-t border-stone-200 text-[11px] text-stone-500">
        Each card is a canonical market — the same underlying question on one or more books.
        Sneakers groups duplicate listings so you see one row per market. Click through to the
        detail view for per-venue prices. Sneakers is not an exchange; trades execute on the
        venue you select.
      </footer>
    </div>
  )
}
