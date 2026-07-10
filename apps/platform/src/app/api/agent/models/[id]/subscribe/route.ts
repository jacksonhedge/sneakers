import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { activateSub, ensureAgentBootstrap, isSubscribed } from '@/lib/agent/service'
import { createAgentModelCheckout, stripeConfigured } from '@/lib/agent/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { data: m } = await service.from('agent_models')
      .select('id, name, status, price_cents, included, owner_user_id')
      .eq('id', id).maybeSingle()
    if (!m || m.owner_user_id !== null) {
      return Response.json({ error: 'model_not_found' }, { status: 404 })
    }
    if (m.status !== 'live') {
      return Response.json({ error: 'model_not_subscribable' }, { status: 400 })
    }
    if (m.included) {
      return Response.json({ error: 'already_subscribed', message: 'Included with your plan.' }, { status: 400 })
    }
    if (await isSubscribed(user.id, id)) {
      return Response.json({ error: 'already_subscribed' }, { status: 400 })
    }

    if (m.price_cents === null) {
      await activateSub(user.id, id, null)
      return Response.json({ ok: true, status: 'active' })
    }

    if (!stripeConfigured()) {
      // Paper mode: no Stripe keys anywhere yet — grant the sub, mark it test.
      await activateSub(user.id, id, null)
      return Response.json({ ok: true, status: 'active', testMode: true })
    }

    const session = await createAgentModelCheckout({
      userId: user.id,
      email: user.email ?? null,
      modelId: m.id,
      modelName: m.name,
      priceCents: m.price_cents,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    console.error('[api/agent/subscribe]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
