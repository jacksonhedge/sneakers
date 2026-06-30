'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// TradingSwitch — the master ON/OFF gate for O'Toole co-pilot proposals.
//
// State source: GET /api/otoole/autotrade-settings
//   killSwitchActive === false → trading is ON (gate open)
//   killSwitchActive === true  → trading is OFF (gate closed)
//
// Toggle:  POST /api/otoole/kill-switch { active: boolean }
//   active:true  = kill switch ON  → trading OFF (blocks proposals, cancels drafts)
//   active:false = kill switch OFF → trading ON  (gate open, user confirms each order)
//
// Turning ON requires a confirmation modal — turning OFF is the safe
// direction and fires immediately. No order is ever placed by this component;
// it only controls the gate the co-pilot uses to PROPOSE trades.

interface Settings {
  perTradeCapUsd: number
  dailyCapUsd: number
  killSwitchActive: boolean
}

interface TradingSwitchProps {
  /** True when the user has a Polymarket private key stored and can actually execute trades. */
  polymarketReadyToTrade: boolean
}

type Phase = 'idle' | 'confirm-on' | 'busy'

export function TradingSwitch({ polymarketReadyToTrade }: TradingSwitchProps) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')

  // true when the gate is open (trading on); null while loading
  const tradingOn: boolean | null = settings === null ? null : !settings.killSwitchActive

  async function refresh() {
    try {
      const r = await fetch('/api/otoole/autotrade-settings', { cache: 'no-store' })
      const d = (await r.json().catch(() => null)) as (Settings & { ok?: boolean }) | null
      if (d?.ok) {
        setSettings({
          perTradeCapUsd: d.perTradeCapUsd,
          dailyCapUsd: d.dailyCapUsd,
          killSwitchActive: d.killSwitchActive,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function handleToggleClick() {
    if (phase !== 'idle' || tradingOn === null) return
    if (tradingOn) {
      // Turning OFF — safe direction, no confirm needed
      void doTurnOff()
    } else {
      // Turning ON — show confirm first
      setPhase('confirm-on')
    }
  }

  async function doTurnOff() {
    setPhase('busy')
    try {
      await fetch('/api/otoole/kill-switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: true, reason: 'turned off from dashboard switch' }),
      })
      await refresh()
    } finally {
      setPhase('idle')
    }
  }

  async function confirmTurnOn() {
    setPhase('busy')
    try {
      await fetch('/api/otoole/kill-switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      await refresh()
    } finally {
      setPhase('idle')
    }
  }

  function cancelConfirm() {
    setPhase('idle')
  }

  const isBusy = phase === 'busy'
  const perTradeCap = settings?.perTradeCapUsd ?? 50
  const dailyCap = settings?.dailyCapUsd ?? 200

  return (
    <div className="rounded-2xl border-2 border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Main control row */}
      <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Big label */}
          <div>
            <div className="text-xs text-stone-400 uppercase tracking-widest font-medium mb-0.5">
              Master switch
            </div>
            <div className="text-xl font-bold text-stone-900 leading-tight">Trading</div>
          </div>

          {/* Status badge */}
          {loading ? (
            <div className="h-8 w-28 rounded-full bg-stone-100 animate-pulse" />
          ) : (
            <span
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all ${
                tradingOn
                  ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300'
                  : 'bg-stone-100 text-stone-500 ring-2 ring-stone-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  tradingOn ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                }`}
                aria-hidden
              />
              {tradingOn ? 'Live' : 'Off'}
            </span>
          )}
        </div>

        {/* Big toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={tradingOn ?? false}
          aria-label={tradingOn ? 'Turn trading off' : 'Turn trading on'}
          disabled={isBusy || loading}
          onClick={handleToggleClick}
          className={`relative inline-flex h-10 w-20 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
            tradingOn
              ? 'border-emerald-400 bg-emerald-500 focus:ring-emerald-500'
              : 'border-stone-300 bg-stone-200 focus:ring-stone-400'
          }`}
        >
          <span
            aria-hidden
            className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-[2px] ${
              tradingOn ? 'translate-x-9' : 'translate-x-0.5'
            } ${isBusy ? 'opacity-60' : ''}`}
          />
        </button>
      </div>

      {/* Status line */}
      {!loading && (
        <div
          className={`px-6 py-3 border-t text-[12px] leading-relaxed ${
            tradingOn
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-stone-50 border-stone-100 text-stone-500'
          }`}
        >
          {tradingOn
            ? 'Trading live — O\'Toole can propose trades; you confirm each order before anything executes.'
            : 'Trading off — all co-pilot proposals are blocked and pending drafts are cancelled.'}
        </div>
      )}

      {/* Not-connected note */}
      {!loading && tradingOn && !polymarketReadyToTrade && (
        <div className="px-6 py-2.5 border-t border-amber-100 bg-amber-50 text-[11px] text-amber-800 flex items-center gap-1.5">
          <span aria-hidden>⚠</span>
          <span>
            Connect Polymarket to place trades{' '}
            <Link
              href="/dashboard/connections"
              className="underline underline-offset-2 font-semibold hover:text-amber-900 transition"
            >
              →
            </Link>
          </span>
        </div>
      )}

      {/* Confirm-turn-ON modal (inline) */}
      {phase === 'confirm-on' && (
        <div className="px-6 py-5 border-t border-stone-200 bg-stone-50">
          <p className="text-sm font-semibold text-stone-900 mb-1">Turn on live trading?</p>
          <p className="text-[12px] text-stone-600 leading-relaxed mb-4">
            Your caps (${perTradeCap}/trade, ${dailyCap}/day) and per-trade confirmation still
            apply — nothing auto-executes. O&apos;Toole proposes and you confirm each order.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirmTurnOn}
              className="px-5 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              Yes, turn on
            </button>
            <button
              type="button"
              onClick={cancelConfirm}
              className="px-5 py-2 rounded-full bg-white text-stone-700 text-xs font-semibold ring-1 ring-stone-300 hover:bg-stone-50 transition focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
