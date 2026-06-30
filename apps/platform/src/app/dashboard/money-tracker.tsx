'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { findVenue } from '@/lib/venues'
import { PolymarketReadonlyBalance } from './polymarket-readonly-balance'

// Money Tracker hero — the user's aggregated wallet balance, displayed
// large at the top of the dashboard. Reuses the /api/balance endpoint
// that BalanceCard and WalletButton already use; no new data paths.
//
// Honest states:
//   - loading:  subtle shimmer, no fake number
//   - $0 / no venues:  goal framing + "Connect a venue →" CTA
//   - $0 / venues connected but empty: shows $0.00 honestly
//   - balance > 0:  big dollar amount + per-venue breakdown

type VenueRow = {
  venue: string
  status: 'ok' | 'error' | 'unsupported' | 'no_credentials'
  cents?: number
  error?: string
}

type BalanceResponse = {
  ok: true
  totalCents: number
  currency: 'USD'
  fetchedAt: string
  byVenue: VenueRow[]
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function venueLabel(id: string): string {
  return findVenue(id)?.name ?? id
}

function LoadingHero() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm animate-pulse">
      <div className="text-[10px] text-stone-400 uppercase tracking-widest mb-2">Total Balance</div>
      <div className="h-12 w-48 bg-stone-100 rounded-lg" />
    </div>
  )
}

function EmptyHero() {
  // No venues connected — show goal framing and a CTA. No fabricated
  // numbers, no fake chart. The user sees exactly where they stand.
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm">
      <div className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">Total Balance</div>
      <div className="text-5xl font-bold font-mono tabular-nums tracking-tight text-stone-900 mb-4">
        $0.00
      </div>

      {/* Flat baseline placeholder — honest, not fabricated */}
      <div className="mb-4 rounded-lg bg-stone-50 border border-dashed border-stone-200 px-4 py-3 text-[11px] text-stone-500 leading-relaxed">
        Your growth shows here once you start.
        <span className="block mt-0.5 text-stone-400">
          Goal: +1%/hr — connect a venue and fund to begin.
        </span>
      </div>

      <Link
        href="/dashboard/connections"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#004225] text-white text-xs font-semibold tracking-wider hover:bg-[#003520] transition"
      >
        Connect a venue <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

function BalanceHero({ data }: { data: BalanceResponse }) {
  const hasVenues = data.byVenue.length > 0
  const connectedOk = data.byVenue.filter((r) => r.status === 'ok').length

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">
            Total Balance
          </div>
          <div className="text-5xl font-bold font-mono tabular-nums tracking-tight text-stone-900">
            {formatUsd(data.totalCents)}
          </div>
          {hasVenues && (
            <div className="mt-1 text-[11px] text-stone-400">
              {connectedOk} venue{connectedOk !== 1 ? 's' : ''} connected
            </div>
          )}
        </div>

        <Link
          href="/dashboard/connections"
          className="shrink-0 text-[11px] text-stone-500 hover:text-stone-800 underline underline-offset-2 transition"
        >
          Manage venues
        </Link>
      </div>

      {hasVenues && (
        <div className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.byVenue.map((row) => (
            <div
              key={row.venue}
              className="flex items-center justify-between text-xs py-1"
            >
              <span className="text-stone-600">{venueLabel(row.venue)}</span>
              <VenueBalanceCell row={row} />
            </div>
          ))}
        </div>
      )}

      {!hasVenues && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#004225] text-white text-xs font-semibold tracking-wider hover:bg-[#003520] transition"
          >
            Connect a venue <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  )
}

function VenueBalanceCell({ row }: { row: VenueRow }) {
  if (row.status === 'ok' && typeof row.cents === 'number') {
    return (
      <span className="font-mono tabular-nums text-stone-900">
        {formatUsd(row.cents)}
      </span>
    )
  }
  if (row.status === 'no_credentials') {
    return <span className="text-stone-400">not connected</span>
  }
  if (row.status === 'unsupported') {
    return <span className="text-stone-400">coming soon</span>
  }
  return (
    <span className="text-amber-700" title={row.error ?? 'fetch failed'}>
      unavailable
    </span>
  )
}

export function MoneyTracker() {
  const [data, setData] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  // On error, fall through to empty state ($0) — still honest.
  const [_error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Hard client-side timeout so the Total Balance card can NEVER spin
    // forever. If /api/balance is slow (typically a stale/failing venue
    // connection dragging the aggregate fetch), abort at 12s and fall
    // through to the honest $0/empty state instead of an endless shimmer.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12_000)
    fetch('/api/balance', { cache: 'no-store', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`balance ${r.status}`)
        return (await r.json()) as BalanceResponse
      })
      .then((res) => {
        if (cancelled) return
        setData(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'unknown')
        setLoading(false)
      })
      .finally(() => clearTimeout(timer))
    return () => {
      cancelled = true
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [])

  if (loading) return <LoadingHero />
  // If data fetch failed or no venues connected, show $0 / empty state
  if (!data || data.byVenue.length === 0) return (
    <>
      <EmptyHero />
      <div className="mt-4">
        <PolymarketReadonlyBalance />
      </div>
    </>
  )
  return (
    <>
      <BalanceHero data={data} />
      <div className="mt-4">
        <PolymarketReadonlyBalance />
      </div>
    </>
  )
}
