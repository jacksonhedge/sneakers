'use client'

import { useState, useEffect, useRef } from 'react'

// PolymarketReadonlyBalance — read-only on-chain USDC balance for a Polymarket
// wallet address. No credentials required. The address is stored in localStorage
// only; never sent to any DB or credential store.
//
// Reads both USDC.e + native USDC on Polygon via /api/polymarket-balance,
// sums them, and shows the result with an honest error state if the call fails.

const LS_KEY = 'sneakers_pm_readonly_address'

type BalanceResult =
  | { ok: true; address: string; cents: number; byToken: { usdce: number; usdc: number } }
  | { ok: false; error: string }

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function PolymarketReadonlyBalance() {
  const [input, setInput] = useState('')
  const [savedAddress, setSavedAddress] = useState<string | null>(null)
  const [result, setResult] = useState<BalanceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore address from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored && isValidAddress(stored)) {
      setSavedAddress(stored)
      // Auto-fetch on mount if we have a saved address
      fetchBalance(stored)
    } else {
      setShowInput(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchBalance(address: string) {
    if (!isValidAddress(address)) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/polymarket-balance?address=${encodeURIComponent(address)}`)
      const data = (await res.json()) as BalanceResult
      setResult(data)
    } catch {
      setResult({ ok: false, error: 'Network error — check your connection.' })
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!isValidAddress(trimmed)) return
    localStorage.setItem(LS_KEY, trimmed)
    setSavedAddress(trimmed)
    setShowInput(false)
    fetchBalance(trimmed)
  }

  function handleChange() {
    setShowInput(true)
    setSavedAddress(null)
    setResult(null)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const inputInvalid = input.trim().length > 0 && !isValidAddress(input.trim())

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] text-stone-400 uppercase tracking-widest">
            Polymarket Wallet Balance
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            On-chain · Polygon · read-only
          </div>
        </div>
        {savedAddress && !showInput && (
          <button
            onClick={handleChange}
            className="text-[11px] text-stone-500 hover:text-stone-800 underline underline-offset-2 transition"
          >
            Change address
          </button>
        )}
      </div>

      {/* Address input form */}
      {showInput && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-2">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Enter your Polymarket deposit / proxy address (where your USDC sits — see{' '}
            <span className="font-medium text-stone-600">Polymarket → Deposit</span>). This is
            read-only — we never see a key.
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              className={[
                'flex-1 rounded-lg border px-3 py-2 font-mono text-xs',
                'focus:outline-none focus:ring-2 focus:ring-[#004225]/30 transition',
                inputInvalid
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-stone-200 bg-stone-50 text-stone-800',
              ].join(' ')}
            />
            <button
              type="submit"
              disabled={!isValidAddress(input.trim())}
              className="px-4 py-2 rounded-lg bg-[#004225] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#003520] transition"
            >
              Show balance
            </button>
          </div>
          {inputInvalid && (
            <p className="text-[10px] text-red-600">
              Must be a 0x address (42 characters, hex).
            </p>
          )}
        </form>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-2 animate-pulse">
          <div className="h-7 w-32 bg-stone-100 rounded-lg" />
          <div className="h-3 w-20 bg-stone-100 rounded" />
        </div>
      )}

      {/* Balance result */}
      {!loading && result && result.ok && (
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold font-mono tabular-nums tracking-tight text-stone-900">
              {formatUsd(result.cents)}
            </span>
            <span className="text-xs text-stone-400 font-medium">USDC · read-only</span>
          </div>
          {savedAddress && (
            <div className="text-[11px] text-stone-400 font-mono mb-2">
              {shortenAddress(savedAddress)}
            </div>
          )}
          {/* Breakdown if both tokens have balance */}
          {(result.byToken.usdce > 0 || result.byToken.usdc > 0) && (
            <div className="mt-2 flex gap-4 text-[11px] text-stone-500">
              {result.byToken.usdce > 0 && (
                <span>USDC.e {formatUsd(result.byToken.usdce)}</span>
              )}
              {result.byToken.usdc > 0 && (
                <span>USDC {formatUsd(result.byToken.usdc)}</span>
              )}
            </div>
          )}
          <div className="mt-2 text-[10px] text-stone-400">
            on-chain · Polygon · refreshes on load
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && result && !result.ok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] text-amber-800 font-medium mb-0.5">
            {"Couldn't read that address"}
          </p>
          <p className="text-[10px] text-amber-700">{result.error}</p>
          <button
            onClick={() => savedAddress && fetchBalance(savedAddress)}
            className="mt-1 text-[10px] text-amber-900 underline underline-offset-1 hover:text-amber-700 transition"
          >
            Try again
          </button>
        </div>
      )}

      {/* No address yet — show hint */}
      {!showInput && !loading && !result && savedAddress === null && (
        <p className="text-[11px] text-stone-400 italic">
          Enter your Polymarket deposit address above to see your balance.
        </p>
      )}
    </div>
  )
}
