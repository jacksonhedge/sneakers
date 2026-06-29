// Compact horizontal Hyperliquid perps strip for the dashboard.
//
// Data comes from getAllHlPerps() — the same lib the full perps page uses.
// Prices are real mark prices from HL's /info endpoint, NOT the bot's
// binary up/down prediction-market positions. These are perpetual futures.
//
// Free tier: 15-minute delayed snapshot (longer TTL in the lib).
// Pro+ tier: live 30-second cache.
//
// This component is a server component — no 'use client' needed because
// the strip renders static HTML (no interactivity, no client state).

import Link from 'next/link'
import type { HlPerp } from '@/lib/hyperliquid-data'

// Prioritized coin order: BTC + ETH + SOL first, then by OI.
const PRIORITY_COINS = ['BTC', 'ETH', 'SOL']
const STRIP_MAX_COINS = 8

function pickStripCoins(perps: HlPerp[]): HlPerp[] {
  const byName = new Map(perps.map((p) => [p.coin, p]))

  // First: priority coins (in declared order), if they have a price.
  const pinned = PRIORITY_COINS.flatMap((c) => {
    const p = byName.get(c)
    return p && p.mark_px != null ? [p] : []
  })

  // Then: remaining coins sorted by OI descending, excluding pinned.
  const pinnedSet = new Set(PRIORITY_COINS)
  const rest = perps
    .filter((p) => !pinnedSet.has(p.coin) && p.mark_px != null && p.open_interest_usd != null)
    .sort((a, b) => (b.open_interest_usd ?? 0) - (a.open_interest_usd ?? 0))

  return [...pinned, ...rest].slice(0, STRIP_MAX_COINS)
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  if (n >= 10_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toPrecision(4)}`
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(2)}%`
}

interface StripCellProps {
  perp: HlPerp
}

function StripCell({ perp }: StripCellProps) {
  const pct = perp.pct_24h
  const isUp = pct != null && pct > 0
  const isDown = pct != null && pct < 0

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 min-w-[72px] px-3 py-2">
      <span className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">
        {perp.coin}
      </span>
      <span className="text-sm font-mono font-semibold text-stone-900">
        {fmtPrice(perp.mark_px)}
      </span>
      <span
        className={`text-[11px] font-mono font-medium tabular-nums ${
          isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-stone-400'
        }`}
      >
        {fmtPct(pct)}
      </span>
    </div>
  )
}

interface HyperliquidStripProps {
  perps: HlPerp[]
  fetchedAt: number
  isPaid: boolean
  tradeUrl: string
}

export function HyperliquidStrip({
  perps,
  fetchedAt,
  isPaid,
  tradeUrl,
}: HyperliquidStripProps) {
  const coins = pickStripCoins(perps)

  if (coins.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-5 text-center">
        <p className="text-xs text-stone-400">
          Hyperliquid perp prices temporarily unavailable — check back shortly.
        </p>
      </div>
    )
  }

  const ageMs = Date.now() - fetchedAt
  const ageLabel =
    ageMs < 60_000
      ? `${Math.round(ageMs / 1000)}s ago`
      : `${Math.round(ageMs / 60_000)}m ago`

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
              isPaid ? 'bg-blue-500' : 'bg-stone-400'
            }`}
          />
          <span className="text-[10px] font-bold tracking-widest text-stone-600 uppercase">
            Live Crypto · Hyperliquid Perps
          </span>
          {!isPaid && (
            <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              15-min delay
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:block text-[9px] text-stone-400 tabular-nums">
            updated {ageLabel}
          </span>
          <a
            href={tradeUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="text-[10px] font-semibold tracking-wider text-[#004225] hover:underline"
          >
            Trade on Hyperliquid →
          </a>
        </div>
      </div>

      {/* Coin cells */}
      <div className="flex items-stretch divide-x divide-stone-100 overflow-x-auto">
        {coins.map((p) => (
          <StripCell key={p.coin} perp={p} />
        ))}
      </div>

      {/* Disclaimer sub-caption */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50">
        <p className="text-[9px] text-stone-400 leading-tight">
          Perpetual futures — live prices from Hyperliquid. Not the bot&apos;s up/down prediction markets.
          {' '}
          <Link href="/dashboard/perps/hyperliquid" className="underline hover:text-stone-600">
            Full perps table →
          </Link>
        </p>
      </div>
    </div>
  )
}
