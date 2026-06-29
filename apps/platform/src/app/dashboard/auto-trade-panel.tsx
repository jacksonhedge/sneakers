'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Auto-Trade Bot panel — wired to real endpoints only.
//
// Data sources (both are REAL, exist today):
//   GET  /api/otoole/autotrade-settings  → { perTradeCapUsd, dailyCapUsd, killSwitchActive }
//   POST /api/otoole/kill-switch         → toggle kill switch
//   POST /api/otoole/autotrade-settings  → update caps
//
// Honest states / what we do NOT show:
//   - No "14 trades today", "64% win rate", or any activity feed — there
//     is no data source for these; they would be fabricated.
//   - No P&L or bot performance metrics — same reason.
//   - Status copy is always the honest co-pilot framing.

interface Settings {
  perTradeCapUsd: number
  dailyCapUsd: number
  killSwitchActive: boolean
}

const DAILY_PRESETS = [50, 100, 200, 500]
const PER_TRADE_PRESETS = [10, 25, 50, 100]

export function AutoTradePanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [open, setOpen] = useState<'kill' | 'daily' | 'pertrade' | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

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
        setLoadError(false)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function toggleKillSwitch(makeActive: boolean) {
    setBusy(true)
    try {
      await fetch('/api/otoole/kill-switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: makeActive, reason: makeActive ? 'user toggled off' : null }),
      })
      await refresh()
    } finally {
      setBusy(false)
      setOpen(null)
    }
  }

  async function setCaps(updates: { perTradeCapUsd?: number; dailyCapUsd?: number }) {
    setBusy(true)
    try {
      await fetch('/api/otoole/autotrade-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
      })
      await refresh()
    } finally {
      setBusy(false)
      setOpen(null)
    }
  }

  // Fall back to defaults until first fetch lands. This matches the
  // pattern in quick-actions.tsx — defaults are consistent with the
  // server defaults (perTrade $50, daily $200).
  const dailyCap = settings?.dailyCapUsd ?? 200
  const perTradeCap = settings?.perTradeCapUsd ?? 50
  const killSwitchActive = settings?.killSwitchActive ?? false
  const autotradeOn = !killSwitchActive

  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden"
      ref={wrapRef}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${
              autotradeOn
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                : 'bg-red-50 text-red-700 ring-1 ring-red-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autotradeOn ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            {autotradeOn ? 'AUTO-TRADE ON' : 'AUTO-TRADE OFF'}
          </span>
          <h2 className="text-sm font-semibold text-stone-900">O'Toole Bot</h2>
        </div>
        <Link
          href="/dashboard/settings/otoole"
          className="text-[11px] text-stone-500 hover:text-stone-800 underline underline-offset-2 transition"
        >
          Full settings
        </Link>
      </div>

      {/* Honest status line */}
      <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 text-[12px] text-stone-600 leading-relaxed">
        Co-pilot mode — proposes trades for you to confirm. Live execution is Polymarket-only;{' '}
        <Link href="/dashboard/connections" className="underline underline-offset-2 hover:text-stone-900 transition">
          connect Polymarket
        </Link>{' '}
        to activate.
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800">
          Could not load bot settings — check your connection and refresh.
        </div>
      )}

      {/* Controls */}
      <div className="px-6 py-4 flex flex-wrap items-center gap-3">
        {/* Kill switch toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === 'kill' ? null : 'kill')}
            disabled={busy}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition disabled:opacity-50 ${
              autotradeOn
                ? 'bg-blue-50 text-blue-700 ring-blue-300 hover:bg-blue-100'
                : 'bg-red-50 text-red-700 ring-red-300 hover:bg-red-100'
            }`}
          >
            <span aria-hidden>{autotradeOn ? '●' : '○'}</span>
            {autotradeOn ? 'ON' : 'OFF'}
            <span aria-hidden className="text-stone-400 text-[10px]">▾</span>
          </button>
          {open === 'kill' && (
            <Popover>
              <p className="text-[11px] text-stone-600 mb-3 leading-snug">
                When OFF, every co-pilot proposal is blocked and any pending drafts are cancelled.
              </p>
              <div className="flex gap-2">
                <PopoverChip active={autotradeOn} onClick={() => toggleKillSwitch(false)}>
                  ON
                </PopoverChip>
                <PopoverChip active={!autotradeOn} onClick={() => toggleKillSwitch(true)}>
                  OFF
                </PopoverChip>
              </div>
            </Popover>
          )}
        </div>

        <span aria-hidden className="h-4 w-px bg-stone-200" />

        {/* Daily cap chip */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === 'daily' ? null : 'daily')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition"
          >
            Daily cap: ${dailyCap}
            <span aria-hidden className="text-stone-400 text-[10px]">▾</span>
          </button>
          {open === 'daily' && (
            <Popover>
              <p className="text-[11px] text-stone-600 mb-3 leading-snug">
                Total $ that may execute per UTC day. Resets at midnight.
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {DAILY_PRESETS.map((v) => (
                  <PopoverChip key={v} active={v === dailyCap} onClick={() => setCaps({ dailyCapUsd: v })}>
                    ${v}
                  </PopoverChip>
                ))}
                <CustomInput
                  current={dailyCap}
                  presets={DAILY_PRESETS}
                  max={25_000}
                  onSet={(v) => setCaps({ dailyCapUsd: v })}
                />
              </div>
            </Popover>
          )}
        </div>

        {/* Per-trade cap chip */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === 'pertrade' ? null : 'pertrade')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition"
          >
            Per-trade cap: ${perTradeCap}
            <span aria-hidden className="text-stone-400 text-[10px]">▾</span>
          </button>
          {open === 'pertrade' && (
            <Popover>
              <p className="text-[11px] text-stone-600 mb-3 leading-snug">
                Hard ceiling on any single co-pilot trade. The server refuses drafts above this
                even if the daily cap has room.
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {PER_TRADE_PRESETS.map((v) => (
                  <PopoverChip key={v} active={v === perTradeCap} onClick={() => setCaps({ perTradeCapUsd: v })}>
                    ${v}
                  </PopoverChip>
                ))}
                <CustomInput
                  current={perTradeCap}
                  presets={PER_TRADE_PRESETS}
                  max={5_000}
                  onSet={(v) => setCaps({ perTradeCapUsd: v })}
                />
              </div>
            </Popover>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared popover primitives (copied from quick-actions.tsx pattern)
// ---------------------------------------------------------------------------

function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      className="absolute left-0 top-full mt-2 w-72 bg-white ring-1 ring-stone-200 rounded-xl shadow-xl p-3 z-50"
    >
      {children}
    </div>
  )
}

function PopoverChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-semibold rounded-full px-3 py-1 ring-1 transition ${
        active
          ? 'bg-stone-900 text-white ring-stone-900'
          : 'bg-white text-stone-700 ring-stone-300 hover:ring-stone-500 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  )
}

function CustomInput({
  current,
  presets,
  max,
  onSet,
}: {
  current: number
  presets: number[]
  max: number
  onSet: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(current))

  if (!editing) {
    const isCustom = !presets.includes(current)
    return (
      <button
        type="button"
        onClick={() => {
          setVal(String(current))
          setEditing(true)
        }}
        className={`text-[11px] font-semibold rounded-full px-3 py-1 ring-1 transition ${
          isCustom
            ? 'bg-stone-900 text-white ring-stone-900'
            : 'bg-white text-stone-700 ring-stone-300 hover:ring-stone-500 hover:bg-stone-50'
        }`}
      >
        Custom…
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const n = parseFloat(val)
        if (!Number.isFinite(n) || n <= 0 || n > max) {
          setEditing(false)
          return
        }
        onSet(Math.round(n))
      }}
      className="inline-flex items-center gap-1"
    >
      <span className="text-stone-600 text-[11px]">$</span>
      <input
        autoFocus
        type="number"
        min={1}
        max={max}
        step={1}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-16 text-[11px] font-mono ring-1 ring-stone-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-blue-400"
      />
      <button
        type="submit"
        className="text-[11px] font-semibold text-blue-700 hover:text-blue-800"
      >
        SET
      </button>
    </form>
  )
}
