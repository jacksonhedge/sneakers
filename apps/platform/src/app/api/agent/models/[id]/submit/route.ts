import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { ensureAgentBootstrap } from '@/lib/agent/service'

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
      .select('id, status, owner_user_id').eq('id', id).maybeSingle()
    if (!m || m.owner_user_id !== user.id) {
      return Response.json({ error: 'model_not_found' }, { status: 404 })
    }
    if (m.status !== 'private') {
      return Response.json({ error: 'not_submittable', message: 'Only private agents can be submitted.' }, { status: 400 })
    }
    const { error } = await service.from('agent_models')
      .update({ status: 'review' }).eq('id', id)
    if (error) throw error
    return Response.json({ ok: true, status: 'review' })
  } catch (err) {
    console.error('[api/agent/submit]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
