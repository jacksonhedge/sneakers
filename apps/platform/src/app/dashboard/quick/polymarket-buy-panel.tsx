'use client'

import { useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BuyState =
  | { kind: 'idle' }
  | { kind: 'open' }
  | { kind: 'confirming'; outcome: 'YES' | 'NO'; sizeUsd: number; price: number | null }
  | { kind: 'pending' }
  | { kind: 'ok'; orderId: string }
  | { kind: 'err'; message: string }

interface Props {
  marketId: string
  /** YES best_ask (0–1 fraction). */
  yesPrice: number | null
  /** NO best_ask (0–1 fraction). */
  noPrice: number | null
  /** True iff the user has a Polymarket private key saved. */
  polymarketReadyToTrade: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PolymarketBuyPanel({ marketId, yesPrice, noPrice, polymarketReadyToTrade }: Props) {
  const [state, setState] = useState<BuyState>({ kind: 'idle' })
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES')
  const [rawSize, setRawSize] = useState<string>('10')

  // ── Cred gate ────────────────────────────────────────────────────────────
  if (!polymarketReadyToTrade) {
    return (
      <Link
        href="/dashboard/connections"
        className="block text-center text-[11px] font-bold tracking-wider text-[#004225] hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Connect Polymarket →
      </Link>
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const price = outcome === 'YES' ? yesPrice : noPrice
  const sizeUsd = parseFloat(rawSize)
  const estShares = price && price > 0 && Number.isFinite(sizeUsd) ? sizeUsd / price : null

  function fmtCents(p: number | null | undefined) {
    if (p == null || !Number.isFinite(p)) return '—'
    return `${Math.round(p * 100)}¢`
  }

  // ── Open the panel ───────────────────────────────────────────────────────
  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setState({ kind: 'open' })
        }}
        className="block w-full text-center text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full bg-[#004225] text-white hover:bg-[#003520] transition-all"
      >
        Buy →
      </button>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (state.kind === 'ok') {
    return (
      <div className="rounded-lg border border-blue-300/60 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
        ✓ Order placed.{' '}
        <span className="font-mono opacity-70">{state.orderId.slice(0, 12)}…</span>
        <button
          type="button"
          className="ml-2 underline opacity-70 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); setState({ kind: 'idle' }) }}
        >
          Close
        </button>
      </div>
    )
  }

  // ── Review card (before Confirm) ─────────────────────────────────────────
  if (state.kind === 'confirming') {
    const { outcome: reviewOutcome, sizeUsd: reviewSize, price: reviewPrice } = state
    const reviewShares = reviewPrice && reviewPrice > 0 ? reviewSize / reviewPrice : null

    async function confirmAndPlace() {
      setState({ kind: 'pending' })
      try {
        const res = await fetch('/api/trade/polymarket/place', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            marketId,
            outcome: reviewOutcome,
            side: 'BUY',
            sizeUsd: reviewSize,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          orderId?: string
          message?: string
          error?: string
        }
        if (!res.ok || !body.ok || !body.orderId) {
          setState({
            kind: 'err',
            message: body.message ?? body.error ?? `Place failed (${res.status}).`,
          })
          return
        }
        setState({ kind: 'ok', orderId: body.orderId })
      } catch (err) {
        setState({ kind: 'err', message: err instanceof Error ? err.message : 'Network error.' })
      }
    }

    return (
      <div
        className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2 text-[11px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] text-stone-400 tracking-wider font-semibold">ORDER REVIEW</div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-0.5">
          <dt className="text-stone-500">Outcome</dt>
          <dd className="font-mono font-semibold text-stone-900">{reviewOutcome}</dd>
          <dt className="text-stone-500">Side</dt>
          <dd className="font-mono text-blue-700">BUY</dd>
          <dt className="text-stone-500">Size</dt>
          <dd className="font-mono tabular-nums text-stone-900">${reviewSize.toFixed(2)}</dd>
          <dt className="text-stone-500">Current price</dt>
          <dd className="font-mono tabular-nums text-stone-700">
            {reviewPrice != null ? `${Math.round(reviewPrice * 100)}¢` : '—'}
          </dd>
          <dt className="text-stone-500">Est. shares</dt>
          <dd className="font-mono tabular-nums text-stone-700">
            {reviewShares != null ? reviewShares.toFixed(1) : '—'}
          </dd>
          <dt className="text-stone-500">Order type</dt>
          <dd className="font-mono text-stone-400">Market</dd>
        </dl>
        <p className="text-[10px] text-stone-400 leading-relaxed">
          Market orders fill at best available price. Risk gates run server-side before any
          order is placed.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={confirmAndPlace}
            className="flex-1 py-1.5 text-[11px] font-bold rounded-full bg-[#004225] text-white hover:bg-[#003520] transition-all"
          >
            Confirm →
          </button>
          <button
            type="button"
            onClick={() => setState({ kind: 'open' })}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-full ring-1 ring-stone-200 text-stone-600 hover:bg-stone-100 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  if (state.kind === 'pending') {
    return (
      <div className="text-center text-[11px] text-stone-500 py-1">Placing…</div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state.kind === 'err') {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 space-y-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>✗ {state.message}</div>
        <button
          type="button"
          className="underline text-[10px] opacity-70 hover:opacity-100"
          onClick={() => setState({ kind: 'open' })}
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Open: pick outcome + size ─────────────────────────────────────────────
  // state.kind === 'open'
  function requestConfirm(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const sz = parseFloat(rawSize)
    if (!Number.isFinite(sz) || sz <= 0) {
      setState({ kind: 'err', message: 'Enter an amount above $0.' })
      return
    }
    setState({ kind: 'confirming', outcome, sizeUsd: sz, price })
  }

  return (
    <form
      onSubmit={requestConfirm}
      onClick={(e) => e.stopPropagation()}
      className="space-y-2"
    >
      {/* YES / NO toggle */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setOutcome('YES')}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-full transition-all ${
            outcome === 'YES'
              ? 'bg-blue-600 text-white'
              : 'ring-1 ring-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          YES {fmtCents(yesPrice)}
        </button>
        <button
          type="button"
          onClick={() => setOutcome('NO')}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-full transition-all ${
            outcome === 'NO'
              ? 'bg-red-500 text-white'
              : 'ring-1 ring-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          NO {fmtCents(noPrice)}
        </button>
      </div>

      {/* Size input */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-stone-500">$</span>
        <input
          type="number"
          min="1"
          max="1000"
          step="1"
          value={rawSize}
          onChange={(e) => setRawSize(e.target.value)}
          className="flex-1 min-w-0 text-[12px] font-mono border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#004225]/30"
          aria-label="Size in USD"
          placeholder="10"
        />
        <span className="text-[10px] text-stone-400 shrink-0">
          ≈{estShares != null ? estShares.toFixed(1) : '—'} sh
        </span>
      </div>

      <div className="flex gap-1.5">
        <button
          type="submit"
          className="flex-1 py-1.5 text-[11px] font-bold tracking-wider rounded-full bg-[#004225] text-white hover:bg-[#003520] transition-all disabled:opacity-50"
          disabled={!Number.isFinite(sizeUsd) || sizeUsd <= 0}
        >
          Review →
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: 'idle' })}
          className="px-3 py-1.5 text-[11px] rounded-full ring-1 ring-stone-200 text-stone-500 hover:bg-stone-100 transition-all"
        >
          ✕
        </button>
      </div>
    </form>
  )
}
