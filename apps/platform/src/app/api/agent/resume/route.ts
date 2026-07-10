import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { ensureAgentBootstrap } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const paused = false
    const { error } = await service.from('user_agent_state')
      .update({ paused, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) throw error
    return Response.json({ ok: true, paused })
  } catch (err) {
    console.error('[api/agent/resume]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
