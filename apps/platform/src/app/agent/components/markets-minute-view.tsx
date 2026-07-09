'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AutoRefresh } from './auto-refresh'

// Plain-JSON shapes the server page maps MinuteMarket/MinuteGroup onto —
// see src/lib/minute-markets.ts for the source fields.
export type SerializedMarket = {
  platform: string
  marketId: string
  question: string
  asset: string | null
  strike: number | null
  direction: 'above' | 'below' | null
  yesPrice: number | null
  volume: number | null
  change5m: number | null
  movementSamples: number
  bucket: '5m' | '15m' | '30m' | '60m' | null
}

export type SerializedGroup = {
  asset: string | null
  resolvesAt: string
  minutesToResolve: number
  bucket: '5m' | '15m' | '30m' | '60m' | null
  platforms: string[]
  marketCount: number
  strikeMin: number | null
  strikeMax: number | null
  markets: SerializedMarket[]
}

const WINDOW_OPTS: { value: number; label: string }[] = [
  { value: 5, label: '5m' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 240, label: '4h' },
]

// Colored tile per platform, echoing VENUE_META (lib/catalog.ts) for the
// venues that overlap; minute markets also surface Limitless/OG which have
// no catalog entry, so unknown platforms fall back to a neutral tile with
// a 2-letter abbreviation.
const PLATFORM_TILE: Record<string, { abbr: string; bg: string }> = {
  kalshi: { abbr: 'K', bg: '#2FD37A' },
  polymarket: { abbr: 'P', bg: '#8fb0ff' },
}

function platformTile(platform: string): { abbr: string; bg: string } {
  return PLATFORM_TILE[platform] ?? { abbr: platform.slice(0, 2).toUpperCase(), bg: '#3a444d' }
}

function fmtMinutes(m: number): string {
  const clamped = Math.max(0, m)
  if (clamped < 1) return `${Math.round(clamped * 60)}s`
  if (clamped < 60) return `${clamped.toFixed(1)}m`
  const h = Math.floor(clamped / 60)
  const rem = Math.round(clamped - h * 60)
  return `${h}h ${rem}m`
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

function fmtChange(c: number | null, samples: number): string {
  if (c == null || samples < 2) return '—'
  const sign = c > 0 ? '+' : ''
  return `${sign}${(c * 100).toFixed(2)}pp`
}

function changeClass(c: number | null, samples: number): string {
  if (c == null || samples < 2) return ''
  if (c > 0.005) return ' ag-pos'
  if (c < -0.005) return ' ag-neg'
  return ''
}

// Ticks once a second so relative-time and countdown displays stay live
// between the 30s AutoRefresh cycles, without trusting the client's
// absolute clock beyond the server-stamped `generatedAt` anchor.
function useTick(everyMs = 1000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return tick
}

function Countdown({ resolvesAt, generatedAt }: { resolvesAt: string; generatedAt: string }) {
  const tick = useTick(1000)
  const resolvesMs = new Date(resolvesAt).getTime()
  const generatedMs = new Date(generatedAt).getTime()
  // elapsed since this render was generated, measured in local ticks — the
  // absolute reference point is the server's generatedAt, not the client clock.
  const elapsedMs = tick * 1000
  const remainingMin = (resolvesMs - generatedMs - elapsedMs) / 60_000
  const urgent = remainingMin <= 2
  const soon = remainingMin > 2 && remainingMin <= 5
  return (
    <span className={'ag-num' + (urgent ? ' mk-countdown--urgent' : soon ? ' mk-countdown--soon' : '')}>
      {remainingMin <= 0 ? 'resolving' : fmtMinutes(remainingMin)}
    </span>
  )
}

function MarketRow({ market }: { market: SerializedMarket }) {
  const tile = platformTile(market.platform)
  const strikeLabel = market.strike != null ? `$${market.strike.toLocaleString()}` : market.question
  return (
    <div className="ag-row mk-row">
      <span className="mk-tile" style={{ background: tile.bg }} aria-hidden="true">
        {tile.abbr}
      </span>
      <div className="mk-row__mid">
        <div className="mk-row__strike ag-num">{strikeLabel}</div>
        <div
          className={
            'mk-row__dir' +
            (market.direction === 'above'
              ? ' mk-row__dir--above'
              : market.direction === 'below'
                ? ' mk-row__dir--below'
                : '')
          }
        >
          {market.direction === 'above' ? '↑ above' : market.direction === 'below' ? '↓ below' : '—'}
        </div>
      </div>
      <div className="mk-row__right">
        <div className="mk-row__yes ag-num ag-pos">{fmtPrice(market.yesPrice)}</div>
        <div className="mk-row__sub ag-num ag-sub">
          <span className={changeClass(market.change5m, market.movementSamples).trim()}>
            {fmtChange(market.change5m, market.movementSamples)}
          </span>
          <span> · {fmtMoney(market.volume)}</span>
        </div>
      </div>
    </div>
  )
}

function GroupCard({ group, generatedAt }: { group: SerializedGroup; generatedAt: string }) {
  return (
    <div className="ag-card mk-group">
      <div className="ag-row mk-group__head">
        <div className="mk-group__title">
          <span className="mk-asset-badge">{group.asset ?? '—'}</span>
          <span className="mk-group__resolve">
            resolves in <Countdown resolvesAt={group.resolvesAt} generatedAt={generatedAt} />
          </span>
        </div>
        <div className="mk-group__meta ag-sub">
          {group.platforms.join(' · ')} · {group.marketCount} {group.marketCount === 1 ? 'strike' : 'strikes'}
        </div>
      </div>
      <div className="mk-rows">
        {group.markets.map((m) => (
          <MarketRow key={`${m.platform}:${m.marketId}`} market={m} />
        ))}
      </div>
    </div>
  )
}

function windowHref(value: number, asset: string | null): string {
  const p = new URLSearchParams()
  if (value !== 60) p.set('within', String(value))
  if (asset) p.set('asset', asset)
  const qs = p.toString()
  return qs ? `/agent/markets?${qs}` : '/agent/markets'
}

function assetHref(value: string | null, within: number): string {
  const p = new URLSearchParams()
  if (within !== 60) p.set('within', String(within))
  if (value) p.set('asset', value)
  const qs = p.toString()
  return qs ? `/agent/markets?${qs}` : '/agent/markets'
}

export function MarketsMinuteView({
  groups,
  within,
  asset,
  generatedAt,
}: {
  groups: SerializedGroup[]
  within: number
  asset: string | null
  generatedAt: string
}) {
  const tick = useTick(1000)

  const assetChips = useMemo(() => {
    const present = new Set(groups.map((g) => g.asset).filter((a): a is string => !!a))
    if (asset) present.add(asset)
    return [...present].sort()
  }, [groups, asset])

  const { totalMarkets, totalGroups, bucketCounts } = useMemo(() => {
    const counts: Record<'5m' | '15m' | '30m' | '60m', number> = { '5m': 0, '15m': 0, '30m': 0, '60m': 0 }
    let markets = 0
    for (const g of groups) {
      markets += g.marketCount
      for (const m of g.markets) if (m.bucket) counts[m.bucket]++
    }
    return { totalMarkets: markets, totalGroups: groups.length, bucketCounts: counts }
  }, [groups])

  // tick forces a re-render each second so this label keeps counting up
  // between AutoRefresh cycles, anchored to the server-stamped generatedAt.
  const updatedLabel = useMemo(() => {
    void tick
    const secs = Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 1000))
    if (secs < 5) return 'just now'
    if (secs < 60) return `${secs}s ago`
    return `${Math.round(secs / 60)}m ago`
  }, [generatedAt, tick])

  return (
    <>
      <AutoRefresh everyMs={30_000} />
      <div className="ag-apphead">
        <span className="ag-brand">Markets</span>
        <span className="ag-badge ag-badge--live">LIVE</span>
      </div>

      <div className="mk-filters">
        <div className="ag-picklab">Window</div>
        <div className="mchips">
          {WINDOW_OPTS.map((w) => (
            <Link
              key={w.value}
              href={windowHref(w.value, asset)}
              className={'mchip' + (within === w.value ? ' mchip--on' : '')}
            >
              {w.label}
            </Link>
          ))}
        </div>
        <div className="ag-picklab" style={{ marginTop: 10 }}>
          Asset
        </div>
        <div className="mchips">
          <Link href={assetHref(null, within)} className={'mchip' + (asset === null ? ' mchip--on' : '')}>
            All
          </Link>
          {assetChips.map((a) => (
            <Link key={a} href={assetHref(a, within)} className={'mchip' + (asset === a ? ' mchip--on' : '')}>
              {a}
            </Link>
          ))}
        </div>
      </div>

      <div className="ag-sub mk-summary">
        <span className="ag-num">{totalMarkets}</span>&nbsp;markets ·{' '}
        <span className="ag-num">{totalGroups}</span>&nbsp;groups · 5m{' '}
        <span className="ag-num">{bucketCounts['5m']}</span> · 15m{' '}
        <span className="ag-num">{bucketCounts['15m']}</span> · 30m{' '}
        <span className="ag-num">{bucketCounts['30m']}</span> · 60m{' '}
        <span className="ag-num">{bucketCounts['60m']}</span>
      </div>

      {groups.length === 0 ? (
        <div className="ag-card mk-empty">
          <div className="mk-empty__t">
            No {asset ?? 'crypto'} markets in the next {within} minutes.
          </div>
        </div>
      ) : (
        groups.map((g) => <GroupCard key={`${g.asset}:${g.resolvesAt}`} group={g} generatedAt={generatedAt} />)
      )}

      <div className="mk-footer">Updated {updatedLabel} · refreshes every 30s</div>
    </>
  )
}
