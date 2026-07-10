import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { ensureAgentBootstrap, loadConfig } from '@/lib/agent/service'
import { validateConfigPut } from '@/lib/agent/wire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadConfig(user.id))
  } catch (err) {
    console.error('[api/agent/config]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const v = validateConfigPut(body)
  if (v.error) {
    return Response.json({ error: 'invalid_input', field: v.error.field, message: v.error.message }, { status: 400 })
  }
  if (Object.keys(v.value).length === 0) {
    return Response.json({ error: 'invalid_input', message: 'Nothing to update.' }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { error } = await service.from('agent_configs')
      .update({ ...v.value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/agent/config PUT]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
