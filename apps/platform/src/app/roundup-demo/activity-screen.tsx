// apps/platform/src/app/roundup-demo/activity-screen.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { SessionState } from './page'

type FacilitateResponse =
  | { ok: true; moved: true; movedCents: number; walletCents: number }
  | { ok: true; moved: true; movedCents: number; marketId: string; entryPrice: number }
  | { ok: true; moved: false; pendingAccruedCents?: number; reason?: string }

export function ActivityScreen({ state, refresh }: { state: SessionState; refresh: () => Promise<void> }) {
  const [syncing, setSyncing] = useState(false)
  const [justMoved, setJustMoved] = useState<{ movedCents: number; kind: 'wallet' | 'polymarket' } | null>(null)
  const hasRunRef = useRef(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    // Strict Mode (dev) mounts this effect, synchronously runs its cleanup, then
    // mounts it again. Reset the cancellation flag on every invocation so that a
    // synthetic (Strict Mode) cleanup doesn't permanently cancel the one real run
    // below — only a genuine unmount (no subsequent re-mount to reset this) does.
    cancelledRef.current = false
    if (hasRunRef.current) {
      return () => {
        cancelledRef.current = true
      }
    }
    hasRunRef.current = true
    async function syncAndFacilitate() {
      setSyncing(true)
      await fetch('/api/roundup-demo/transactions/sync', { method: 'POST' })
      const facilitateRes = await fetch('/api/roundup-demo/facilitate', { method: 'POST' })
      const facilitateBody = (await facilitateRes.json()) as FacilitateResponse
      if (!cancelledRef.current && facilitateBody.moved && facilitateBody.movedCents) {
        setJustMoved({
          movedCents: facilitateBody.movedCents,
          kind: 'walletCents' in facilitateBody ? 'wallet' : 'polymarket',
        })
      }
      if (!cancelledRef.current) await refresh()
      if (!cancelledRef.current) setSyncing(false)
    }
    syncAndFacilitate()
    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressPct = Math.min(100, Math.round((state.pendingAccruedCents / state.rule.thresholdCents) * 100))

  return (
    <div className="space-y-4">
      {justMoved !== null && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {justMoved.kind === 'wallet'
            ? `$${(justMoved.movedCents / 100).toFixed(2)} swept to your wallet 🎉`
            : `$${(justMoved.movedCents / 100).toFixed(2)} invested in a Polymarket position 🎉`}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Connected bank</div>
        <div className="text-sm text-gray-700">
          {state.bank.institution ?? 'Unknown institution'} ····{state.bank.last4 ?? '----'}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Round-ups toward ${(state.rule.thresholdCents / 100).toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            ${(state.pendingAccruedCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gray-900" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {state.walletCents > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Wallet balance</div>
          <div className="text-2xl font-bold text-gray-900">${(state.walletCents / 100).toFixed(2)}</div>
        </div>
      )}

      {state.positions.length > 0 && (
        <div className="space-y-2">
          {state.positions.map((p) => {
            const pnlPositive = p.pnlCents !== null && p.pnlCents >= 0
            return (
              <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Polymarket position
                </div>
                <div className="mb-3 text-sm text-gray-700">{p.marketQuestion ?? p.marketId}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Entry {(p.entryPrice * 100).toFixed(0)}¢ · Size ${(p.sizeCents / 100).toFixed(2)}
                  </span>
                  {p.pnlCents !== null && p.currentPrice !== null ? (
                    <span className={`font-semibold ${pnlPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {pnlPositive ? '+' : ''}
                      ${(p.pnlCents / 100).toFixed(2)} ({(p.currentPrice * 100).toFixed(0)}¢ now)
                    </span>
                  ) : (
                    <span className="text-gray-400">Live price unavailable</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent activity</div>
        <ul className="divide-y divide-gray-100">
          {state.txns.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-700">{t.merchant}</span>
              <span className="text-gray-400">${(t.amountCents / 100).toFixed(2)}</span>
              <span className="font-semibold text-gray-900">+${(t.roundUpCents / 100).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      {syncing && <p className="text-center text-xs text-gray-400">Syncing…</p>}
    </div>
  )
}
