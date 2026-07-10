import { getAuthClient } from '@/lib/supabase-auth'
import { ensureAgentBootstrap, loadStateWire } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadStateWire(user.id))
  } catch (err) {
    console.error('[api/agent/state]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
