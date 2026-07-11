import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { applyWallet, ensureAgentBootstrap } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown }
  const amountCents = Number(body.amountCents)
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    return Response.json({ error: 'invalid_amount' }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { data: st } = await service.from('user_agent_state')
      .select('sim_balance_cents').eq('user_id', user.id).maybeSingle()
    if (Number(st?.sim_balance_cents ?? 0) < amountCents) {
      return Response.json({ error: 'insufficient_funds' }, { status: 400 })
    }
    const balanceCents = await applyWallet(user.id, {
      kind: 'withdraw', label: 'Withdrawal', detail: 'Test mode · no payout sent', amountCents: -amountCents,
    })
    // Atomic floor guard in agent_wallet_apply — covers the race the
    // friendly pre-check above can miss under concurrent withdrawals.
    if (balanceCents === null) {
      return Response.json({ error: 'insufficient_funds' }, { status: 400 })
    }
    return Response.json({ ok: true, balanceCents })
  } catch (err) {
    console.error('[api/wallet/withdraw]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
