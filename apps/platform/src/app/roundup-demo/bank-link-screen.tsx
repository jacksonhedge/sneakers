// apps/platform/src/app/roundup-demo/bank-link-screen.tsx
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

export function BankLinkScreen({ onLinked }: { onLinked: (institution: string | null, last4: string | null) => void }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setStatus('connecting')
    setError(null)
    try {
      const tokenRes = await fetch('/api/roundup-demo/bank/link-token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('Could not start the bank connection.')
      const { clientSecret } = (await tokenRes.json()) as { clientSecret: string }

      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe failed to load. Please try again in a moment.')

      const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret })
      if (result.error) {
        // Stripe SDK error messages are written for developers (e.g. "You should not use your
        // secret key with Stripe.js"), not end users — log the real detail for debugging but
        // never surface it verbatim in the UI.
        console.error('[roundup-demo] Stripe Financial Connections error:', result.error)
        throw new Error('Could not connect to your bank right now. Please try again.')
      }

      const fcSessionId = result.financialConnectionsSession.id
      const completeRes = await fetch('/api/roundup-demo/bank/link-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialConnectionsSessionId: fcSessionId }),
      })
      if (!completeRes.ok) throw new Error('Could not finish linking your bank.')
      const complete = (await completeRes.json()) as { institution: string | null; last4: string | null }

      setStatus('idle')
      onLinked(complete.institution, complete.last4)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong connecting your bank.')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Connect your bank</h2>
      <p className="mb-6 text-sm text-gray-500">
        Securely link your bank account. We only read transactions to compute your round-ups.
      </p>
      <button
        onClick={handleConnect}
        disabled={status === 'connecting'}
        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {status === 'connecting' ? 'Connecting…' : 'Connect bank'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
