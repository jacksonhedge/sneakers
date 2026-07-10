import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { ensureAgentBootstrap, loadModelsWire } from '@/lib/agent/service'
import { validateCreateAgent, rowToModel, type AgentModelRow } from '@/lib/agent/wire'
import { encryptSecret } from '@/lib/secrets'

const MAX_USER_AGENTS = 10

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadModelsWire(user.id))
  } catch (err) {
    console.error('[api/agent/models]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const v = validateCreateAgent(body)
  if (v.error) {
    return Response.json({ error: 'invalid_input', field: v.error.field, message: v.error.message }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { count, error: countError } = await service.from('agent_models')
      .select('id', { count: 'exact', head: true }).eq('owner_user_id', user.id)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_USER_AGENTS) {
      return Response.json({ error: 'agent_cap_reached', message: `You can have up to ${MAX_USER_AGENTS} agents.` }, { status: 400 })
    }
    const input = v.value
    const id = 'custom-' + crypto.randomUUID().slice(0, 8)
    const n = (count ?? 0) + 1
    const row = {
      id,
      name: input.name || 'My Agent ' + n,
      emoji: input.emoji,
      color: input.color,
      author: 'you',
      description:
        input.kind === 'connected'
          ? 'Your connected bot. We send it market signals; it returns orders. Trading your paper balance while in review for the marketplace.'
          : (input.prompt || 'Your prompt-built agent, running on the Sneakers worker against your paper balance.'),
      status: 'private',
      kind: input.kind,
      owner_user_id: user.id,
      prompt: input.kind === 'prompt' ? (input.prompt ?? null) : null,
      endpoint_url: input.kind === 'connected' ? input.endpointUrl : null,
      api_key_encrypted: input.kind === 'connected' ? encryptSecret(input.apiKey!) : null,
      sort_order: 90,
    }
    const { data, error } = await service.from('agent_models').insert(row)
      .select('id, name, emoji, brand, color, author, perf_30d, runners, price_cents, price_label, tagline, description, status, featured, included, kind, owner_user_id, sort_order')
      .single()
    if (error) throw error
    return Response.json({ model: rowToModel(data as AgentModelRow, user.id) }, { status: 201 })
  } catch (err) {
    console.error('[api/agent/models POST]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
