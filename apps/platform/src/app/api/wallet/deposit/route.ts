import { getAuthClient } from '@/lib/supabase-auth'
import { getStripe } from '@/lib/stripe'
import { applyWallet, ensureAgentBootstrap } from '@/lib/agent/service'
import { stripeConfigured } from '@/lib/agent/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_CENTS = 100
const MAX_CENTS = 1_000_000

export async function POST(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown }
  const amountCents = Number(body.amountCents)
  if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return Response.json(
      { error: 'invalid_amount', message: 'Amount must be between $1 and $10,000.' },
      { status: 400 },
    )
  }
  try {
    await ensureAgentBootstrap(user.id)

    if (!stripeConfigured()) {
      const balanceCents = await applyWallet(user.id, {
        kind: 'deposit', label: 'Added cash', detail: 'Test mode · no card charged', amountCents,
      })
      // Positive amounts never hit the withdrawal floor guard — null here is a bug.
      if (balanceCents === null) throw new Error('unexpected null balance from agent_wallet_apply')
      return Response.json({ ok: true, balanceCents })
    }

    console.log('[api/wallet/deposit] creating PaymentIntent', { userId: user.id, amountCents })
    const pi = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: user.id, kind: 'agent_wallet_deposit' },
    })
    console.log('[api/wallet/deposit] PaymentIntent created', { id: pi.id })
    return Response.json({ clientSecret: pi.client_secret })
  } catch (err) {
    console.error('[api/wallet/deposit]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
