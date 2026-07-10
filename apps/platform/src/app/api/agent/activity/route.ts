import { getAuthClient } from '@/lib/supabase-auth'
import { ensureAgentBootstrap, loadActivity } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100)
  const before = url.searchParams.get('before') ?? undefined
  if (before && Number.isNaN(Date.parse(before))) {
    return Response.json({ error: 'invalid_before' }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json({ decisions: await loadActivity(user.id, limit, before) })
  } catch (err) {
    console.error('[api/agent/activity]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
