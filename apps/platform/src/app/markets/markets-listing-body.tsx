import Link from 'next/link'
import {
  loadMarketsPage,
  type MarketPhase,
  type MarketSort,
  type MarketSnapshot,
} from '@/lib/markets-data'
import { type TerminalCategory, categoryOf } from '@/lib/market-stats'
import type { CanonicalMarket } from '@/lib/canonical-markets'
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
//
// DATA PATH (post-fix):
//   loadMarketsPage() → bounded SQL query doing filter+sort+paginate in
//   Postgres with a 10s statement_timeout. Returns at most pageSize market
//   rows (typically <<1000 outcome rows total). Previously this called:
//     1. loadAllLatestSnapshots() — full table scan, all markets into JS
//     2. groupIntoCanonical() on the full set in memory
//     3. loadMarketHistory(7) — 200k price_observation rows for sparklines
//        on 50 visible cards
//   Total was routinely 4-5 minutes → crash.
//
// Sparklines are intentionally omitted on the listing page. They require
// loadMarketHistory(7) which pulls ~200k rows just to produce sparklines for
// 50 visible cards. The detail page still shows the full chart.

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
  category?: string
  phase?: string
  sort?: string
  page?: string
}

/** Wrap a plain MarketSnapshot as a singleton CanonicalMarket for MarketCard. */
function snapshotToCanonical(snap: MarketSnapshot): CanonicalMarket {
  return {
    id: `${snap.platform}:${snap.platform_market_id}`,
    question: snap.question,
    category: categoryOf(snap),
    sport: snap.sport,
    resolves_at: snap.resolves_at,
    starts_at: snap.starts_at,
    venueCount: 1,
    venues: [snap.platform],
    quotes: [snap],
    groupedBy: 'singleton',
  }
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

  // Bounded SQL query: filter + sort + paginate happens in Postgres.
  // Returns only the current page (≤50 markets), not the full table.
  // Includes a 10s statement_timeout — if the DB is slow, returns null
  // and falls back to the JSONL path (which also paginates).
  const result = await loadMarketsPage({
    q: q || undefined,
    platform: platform || undefined,
    category,
    phase,
    sort,
    page,
    pageSize: PAGE_SIZE,
  })

  const { markets: paged, total, availablePlatforms, dataDate, perBook } = result

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (platform) params.set('platform', platform)
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
        <h1 className="text-xl font-bold text-stone-900">Crypto markets</h1>
        <div className="text-[11px] text-stone-500 tracking-wider font-mono tabular-nums">
          {total.toLocaleString()} markets
          {dataDate && (
            <>
              <span className="text-stone-300 mx-2">·</span>
              snapshot {dataDate}
            </>
          )}
        </div>
      </div>

      <PlatformFreshnessStrip perBook={perBook} />

      <FilterBar
        platforms={availablePlatforms}
        currentQuery={q}
        currentPlatform={platform}
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
              : 'Try a different search or platform.'}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((market) => (
              <MarketCard
                key={`${market.platform}:${market.platform_market_id}`}
                market={snapshotToCanonical(market)}
                sparkline={undefined}
              />
            ))}
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
        Crypto markets only — BTC, ETH, SOL, and other digital assets across
        all connected books. Click through to the detail view for per-venue
        prices and sparklines. Sneakers is not an exchange; trades execute on
        the venue you select.
      </footer>
    </div>
  )
}
