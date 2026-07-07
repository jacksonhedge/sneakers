// apps/platform/src/app/roundup-demo/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityScreen } from './activity-screen'
import { BankLinkScreen } from './bank-link-screen'
import { ConfigureScreen } from './configure-screen'

export interface SessionState {
  sessionId: string
  bank: { linked: boolean; institution: string | null; last4: string | null }
  rule: { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }
  pendingAccruedCents: number
  walletCents: number
  txns: Array<{ id: string; merchant: string; amountCents: number; roundUpCents: number; date: string }>
  positions: Array<{
    id: string
    marketId: string
    marketQuestion: string | null
    entryPrice: number
    sizeCents: number
    currentPrice: number | null
    pnlCents: number | null
  }>
}

export default function RoundupDemoPage() {
  const [state, setState] = useState<SessionState | null>(null)
  const [consented, setConsented] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<'configure' | 'activity'>('configure')
  const didInitialRouteRef = useRef(false)

  // Route a returning user straight to where they left off, based on the very first
  // successful state load. A linked bank means they're past consent + bank-link; having
  // at least one txn means they've been through configure before (txns only exist once
  // ActivityScreen has synced), so they should land on activity, not back on configure.
  useEffect(() => {
    if (!state || didInitialRouteRef.current) return
    didInitialRouteRef.current = true
    if (state.bank.linked) {
      setConsented(true)
      setStage(state.txns.length > 0 ? 'activity' : 'configure')
    }
  }, [state])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/roundup-demo/state')
      if (!res.ok) {
        setError(`Failed to load state: ${res.status} ${res.statusText}`)
        return
      }
      const body = (await res.json()) as { session: SessionState }
      setState(body.session)
      setError(null)
    } catch (err) {
      setError(`Error loading state: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="mb-4 text-sm text-red-700">{error}</p>
          <button
            onClick={() => refresh()}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!state) {
    return <div className="mx-auto max-w-md px-4 py-10 text-sm text-gray-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Round-Ups</h1>
      <p className="mb-6 text-sm text-gray-500">Spare change, put to work.</p>

      {!consented && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="mb-4 text-sm text-gray-700">
            Sneakers rounds up your everyday purchases to the nearest dollar and puts your spare
            change to work once it adds up to ${(state.rule.thresholdCents / 100).toFixed(2)}.
            This is a demo — your bank link is real (test mode), but no real money moves.
          </p>
          <button
            onClick={() => setConsented(true)}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Continue
          </button>
        </div>
      )}

      {consented && !state.bank.linked && (
        <BankLinkScreen onLinked={() => refresh()} />
      )}

      {consented && state.bank.linked && stage === 'configure' && (
        <ConfigureScreen
          rule={state.rule}
          onConfigured={() => {
            refresh()
            setStage('activity')
          }}
        />
      )}

      {consented && state.bank.linked && stage === 'activity' && (
        <ActivityScreen state={state} refresh={refresh} />
      )}
    </div>
  )
}
