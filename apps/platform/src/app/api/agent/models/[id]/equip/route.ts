import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { ensureAgentBootstrap, isSubscribed } from '@/lib/agent/service'

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

    if (id !== 'my-model') {
      const { data: m } = await service.from('agent_models')
        .select('id, status, price_cents, included, owner_user_id')
        .eq('id', id).maybeSingle()
      if (!m) return Response.json({ error: 'model_not_found' }, { status: 404 })
      const mine = m.owner_user_id === user.id
      if (m.owner_user_id !== null && !mine) {
        return Response.json({ error: 'model_not_found' }, { status: 404 })
      }
      if (!mine && m.status !== 'live') {
        return Response.json({ error: 'model_not_equippable' }, { status: 400 })
      }
      const free = m.included || m.price_cents === null
      if (!mine && !free && !(await isSubscribed(user.id, id))) {
        return Response.json({ error: 'subscription_required' }, { status: 402 })
      }
    }

    const { error } = await service.from('user_agent_state')
      .update({ equipped_model_id: id, paused: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) throw error
    return Response.json({ ok: true, equippedId: id })
  } catch (err) {
    console.error('[api/agent/equip]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
