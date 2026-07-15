'use client'
import { useEffect, useState } from 'react'
import { Sheet } from './sheet'
import { useAgent } from '../lib/store'
import type { Stripe, StripeElements } from '@stripe/stripe-js'

const AMOUNTS = [2500, 10000, 25000]

export function AddCashSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { live, api, dispatch, state } = useAgent()
  const [cents, setCents] = useState(10000)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payState, setPayState] = useState<{ stripe: Stripe; elements: StripeElements } | null>(null)

  // The sheet stays mounted (only `open` toggles). Backing out mid-flow must
  // not strand a detached Payment Element / stale error/busy for the next open.
  useEffect(() => {
    if (!open) { setPayState(null); setError(null); setBusy(false); setCents(10000) }
  }, [open])

  async function confirm() {
    if (!live) { dispatch({ type: 'deposit', cents }); setCents(10000); onClose(); return }
    setBusy(true); setError(null)
    const res = await api.deposit(cents)
    if (!res) { setError('Deposit failed — try again.'); setBusy(false); return }
    if ('clientSecret' in res) {
      // Stripe configured: hosted confirmation via Payment Element.
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')
      if (!stripe) { setError('Payments unavailable.'); setBusy(false); return }
      const elements = stripe.elements({ clientSecret: res.clientSecret, appearance: { theme: 'night' } })
      const mount = document.getElementById('ag-payel')
      if (mount) {
        elements.create('payment').mount(mount)
        // Confirm on a second tap: swap the button handler by state.
        setPayState({ stripe, elements })
        setBusy(false)
        return
      }
    }
    // Paper path: server already credited the balance.
    await api.wallet().then(w => {
      if (w) dispatch({ type: 'sync', patch: { balanceCents: w.balanceCents, ledger: w.ledger, spark: w.spark } })
    })
    setBusy(false); setCents(10000); onClose()
  }

  async function confirmCard() {
    if (!payState) return
    setBusy(true)
    const { error: err } = await payState.stripe.confirmPayment({
      elements: payState.elements,
      confirmParams: { return_url: window.location.origin + '/agent/balance?deposit=success' },
      redirect: 'if_required',
    })
    if (err) { setError(err.message ?? 'Payment failed.'); setBusy(false); return }
    // Webhook credits the ledger; poll wallet until the balance moves off its
    // pre-payment value, capped at 5×2s (≤10s) if the webhook is slow.
    const before = state.balanceCents
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const w = await api.wallet()
      if (w) {
        dispatch({ type: 'sync', patch: { balanceCents: w.balanceCents, ledger: w.ledger, spark: w.spark } })
        if (w.balanceCents !== before) break
      }
    }
    setPayState(null); setBusy(false); setCents(10000); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} label="Add cash">
      <div className="ag-row">
        <div style={{ fontSize: 17, fontWeight: 700 }}>Add cash</div>
        <span className="ag-badge ag-badge--test">STRIPE TEST</span>
      </div>
      <div className="ag-sub" style={{ marginTop: 8 }}>
        Test mode — card 4242 4242 4242 4242. No real money moves.
      </div>
      <div className="ag-pickrow" style={{ margin: '14px 0 16px' }}>
        {AMOUNTS.map(a => (
          <button key={a} className={'mchip ag-num' + (a === cents ? ' mchip--on' : '')}
            style={{ flex: 1, textAlign: 'center', fontSize: 14, padding: '11px 0' }}
            disabled={Boolean(payState)}
            onClick={() => setCents(a)}>
            ${a / 100}
          </button>
        ))}
      </div>
      <div id="ag-payel" style={{ marginBottom: payState ? 16 : 0 }} />
      {error && <div className="ag-sub" style={{ color: 'var(--ag-red)', marginBottom: 10 }}>{error}</div>}
      <button className="ag-pill ag-pill--primary ag-num" style={{ width: '100%' }} disabled={busy}
        onClick={payState ? confirmCard : confirm}>
        {busy ? '…' : payState ? `Pay $${cents / 100}` : `Add $${cents / 100}`}
      </button>
    </Sheet>
  )
}
