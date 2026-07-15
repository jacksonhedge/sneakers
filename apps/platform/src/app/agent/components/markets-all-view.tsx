'use client'
import Link from 'next/link'

// Plain-JSON shape the server page maps MarketSnapshot (loadMarketsPage,
// src/lib/markets-data.ts) onto — see that file for the source fields.
export type SerializedRow = {
  id: string
  question: string
  platform: string
  yesPrice: number | null
  volume: number | null
  resolvesAt: string | null
  overround: number | null
}

export type AllViewSort = 'volume' | 'overround' | 'resolves_at' | 'updated'

const SORT_OPTS: { value: AllViewSort; label: string }[] = [
  { value: 'volume', label: 'Volume' },
  { value: 'overround', label: 'Overround' },
  { value: 'resolves_at', label: 'Resolves' },
  { value: 'updated', label: 'Updated' },
]

// Colored tile per platform — same abbreviation/color language as the minute
// view's PLATFORM_TILE (markets-minute-view.tsx), extended with the venues
// that only show up in the crypto-category listing loadMarketsPage covers.
const PLATFORM_TILE: Record<string, { abbr: string; bg: string }> = {
  kalshi: { abbr: 'K', bg: '#2FD37A' },
  polymarket: { abbr: 'P', bg: '#8fb0ff' },
  limitless: { abbr: 'L', bg: '#b98af0' },
  og: { abbr: 'OG', bg: '#ffb454' },
  opinion: { abbr: 'OP', bg: '#5fd0d6' },
}

function platformTile(platform: string): { abbr: string; bg: string } {
  return PLATFORM_TILE[platform] ?? { abbr: platform.slice(0, 2).toUpperCase(), bg: '#3a444d' }
}

// FIX 3: Brand-correct capitalization for platform labels
const PLATFORM_LABELS: Record<string, string> = {
  og: 'OG',
  prophetx: 'ProphetX',
  prizepicks: 'PrizePicks',
  novig: 'Novig',
  kalshi: 'Kalshi',
  polymarket: 'Polymarket',
  limitless: 'Limitless',
  underdog: 'Underdog',
}

function platformLabel(platform: string): string {
  if (PLATFORM_LABELS[platform]) return PLATFORM_LABELS[platform]
  return platform.length ? platform.charAt(0).toUpperCase() + platform.slice(1) : platform
}

function fmtMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

function fmtPrice(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—'
  return p.toFixed(3)
}

function fmtOverround(o: number | null): string {
  if (o == null || !Number.isFinite(o)) return '—'
  return o.toFixed(2)
}

// Coarser than the minute view's live Countdown — this listing spans
// crypto/daily markets that can resolve days out, so a static render-time
// estimate (no per-second tick) is precise enough.
function fmtResolves(resolvesAt: string | null): string {
  if (!resolvesAt) return '—'
  const ms = new Date(resolvesAt).getTime() - Date.now()
  if (!Number.isFinite(ms)) return '—'
  if (ms <= 0) return 'resolved'
  const mins = ms / 60_000
  if (mins < 60) return `${Math.round(mins)}m`
  const hours = mins / 60
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

type CurrentState = { page: number; sort: AllViewSort; platform: string | null }

// Builds an /agent/markets?view=all href, merging overrides onto the current
// state. Changing sort or platform always resets to page 1 so a filter
// change never strands the user on a now-out-of-range page.
function hrefFor(overrides: Partial<CurrentState>, current: CurrentState): string {
  const page = overrides.page ?? current.page
  const sort = overrides.sort ?? current.sort
  const platform = overrides.platform !== undefined ? overrides.platform : current.platform
  const p = new URLSearchParams()
  p.set('view', 'all')
  if (sort !== 'volume') p.set('sort', sort)
  if (platform) p.set('platform', platform)
  if (page > 1) p.set('page', String(page))
  return `/agent/markets?${p.toString()}`
}

function MarketRow({ row, sort }: { row: SerializedRow; sort: AllViewSort }) {
  const tile = platformTile(row.platform)
  // FIX 2: Avoid "resolves resolved" when market is already resolved
  const resolvedText = fmtResolves(row.resolvesAt)
  const resolvesDisplay = resolvedText === 'resolved' ? 'resolved' : `resolves ${resolvedText}`
  return (
    <div className="ag-av-row">
      <span className="ag-mk-tile" style={{ background: tile.bg }} aria-hidden="true">
        {tile.abbr}
      </span>
      <div className="ag-mk-row__mid">
        <div className="ag-av-row__q">{row.question}</div>
        <div className="ag-av-row__sub">
          {platformLabel(row.platform)} · {resolvesDisplay}
        </div>
      </div>
      <div className="ag-av-row__right">
        <div className="ag-av-row__yes ag-num ag-pos">{fmtPrice(row.yesPrice)}</div>
        <div className="ag-av-row__rsub ag-num ag-sub">
          {fmtMoney(row.volume)}
          {sort === 'overround' && <> · ov {fmtOverround(row.overround)}</>}
        </div>
      </div>
    </div>
  )
}

export function MarketsAllView({
  rows,
  total,
  page,
  pageSize,
  sort,
  platform,
  platforms,
  fromDb,
}: {
  rows: SerializedRow[]
  total: number
  page: number
  pageSize: number
  sort: AllViewSort
  platform: string | null
  platforms: string[]
  fromDb: boolean
}) {
  const current: CurrentState = { page, sort, platform }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Markets</span>
        <span className={'ag-badge ' + (fromDb ? 'ag-badge--live' : 'ag-badge--test')}>
          {fromDb ? 'LIVE' : 'CACHED'}
        </span>
      </div>

      <div className="ag-mk-filters">
        <div className="ag-picklab">Sort</div>
        <div className="ag-mchips">
          {SORT_OPTS.map((opt) => (
            <Link
              key={opt.value}
              href={hrefFor({ sort: opt.value, page: 1 }, current)}
              className={'ag-mchip' + (sort === opt.value ? ' ag-mchip--on' : '')}
            >
              {opt.label}
            </Link>
          ))}
        </div>
        <div className="ag-picklab" style={{ marginTop: 10 }}>
          Platform
        </div>
        <div className="ag-mchips">
          <Link
            href={hrefFor({ platform: null, page: 1 }, current)}
            className={'ag-mchip' + (platform === null ? ' ag-mchip--on' : '')}
          >
            All
          </Link>
          {/* FIX 1: Only show platforms in PLATFORM_TILE, but keep active platform visible */}
          {platforms
            .filter((p) => PLATFORM_TILE[p] || p === platform)
            .map((p) => (
              <Link
                key={p}
                href={hrefFor({ platform: p, page: 1 }, current)}
                className={'ag-mchip' + (platform === p ? ' ag-mchip--on' : '')}
              >
                {platformLabel(p)}
              </Link>
            ))}
        </div>
      </div>

      <div className="ag-sub ag-mk-summary">
        <span className="ag-num">{total}</span>&nbsp;markets · sorted by{' '}
        {SORT_OPTS.find((o) => o.value === sort)?.label ?? sort}
        {platform ? ` · ${platformLabel(platform)}` : ''}
      </div>

      {rows.length === 0 ? (
        <div className="ag-card ag-mk-empty">
          <div className="ag-mk-empty__t">
            No markets match this filter.
            {!fromDb && ' Live database unavailable — the cached fallback had none either.'}
          </div>
        </div>
      ) : (
        <>
          {!fromDb && <div className="ag-av-notice">Live database unavailable — showing cached data.</div>}
          <div className="ag-card">
            {rows.map((r) => (
              <MarketRow key={r.id} row={r} sort={sort} />
            ))}
          </div>

          <div className="ag-av-pager">
            {page > 1 ? (
              <Link href={hrefFor({ page: page - 1 }, current)} className="ag-linkish" prefetch={false}>
                Prev
              </Link>
            ) : (
              <span className="ag-linkish" style={{ opacity: 0.35 }}>
                Prev
              </span>
            )}
            <div className="ag-av-pager__mid">
              Page <span className="ag-num">{page}</span> of <span className="ag-num">{totalPages}</span>
            </div>
            {page < totalPages ? (
              <Link href={hrefFor({ page: page + 1 }, current)} className="ag-linkish" prefetch={false}>
                Next
              </Link>
            ) : (
              <span className="ag-linkish" style={{ opacity: 0.35 }}>
                Next
              </span>
            )}
          </div>
        </>
      )}

      <div className="ag-mk-footer">Crypto markets, all connected venues · page {page} of {totalPages}</div>
    </>
  )
}
