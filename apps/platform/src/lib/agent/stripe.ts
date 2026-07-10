// Stripe Checkout for agent-model subscriptions. Uses inline recurring
// price_data so no Products/Prices need pre-creating in the dashboard —
// right for test mode; revisit if models need per-interval pricing.
import Stripe from 'stripe'
import { getStripe, siteUrl } from '@/lib/stripe'

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export async function createAgentModelCheckout(args: {
  userId: string
  email: string | null
  modelId: string
  modelName: string
  priceCents: number
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const metadata = { user_id: args.userId, agent_model_id: args.modelId }
  console.log('[agent/stripe] creating model checkout', { modelId: args.modelId, userId: args.userId })
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: args.priceCents,
        recurring: { interval: 'month' },
        product_data: { name: `Sneakers Agent · ${args.modelName}` },
      },
    }],
    ...(args.email ? { customer_email: args.email } : {}),
    client_reference_id: args.userId,
    metadata,
    subscription_data: { metadata },
    success_url: `${siteUrl()}/agent/models?sub=success&model=${args.modelId}`,
    cancel_url: `${siteUrl()}/agent/models?sub=canceled&model=${args.modelId}`,
  })
  console.log('[agent/stripe] model checkout created', { sessionId: session.id })
  return session
}
