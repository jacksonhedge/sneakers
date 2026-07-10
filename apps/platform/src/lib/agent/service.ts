// Service-role data access for the agent experience. Every function takes
// an explicit userId (already authenticated by the route) — nothing here
// reads cookies. Pure mapping lives in ./wire; this file is the only I/O.
import { getServerClient } from '@/lib/supabase-server'
import type { AgentModel, Decision, LedgerEntry } from '@/app/agent/lib/types'
import {
  decisionRowToWire, ledgerRowToWire, myModelEntry, phaseAt, rowToModel,
  sparkFromLedger, SEED_DECISIONS_LIVE, SEED_LEDGER_LIVE,
  type AgentModelRow,
} from './wire'

export interface StateWire {
  phase: string
  title: string
  sub: string
  paused: boolean
  paper: true
  equippedId: string
  balanceCents: number
  todayPnlCents: number
  lastDecision: Decision | null
}

export async function ensureAgentBootstrap(userId: string): Promise<void> {
  const sb = getServerClient()
  // Insert-if-absent; `count` tells us whether this was the first touch.
  const { data: inserted, error } = await sb
    .from('user_agent_state')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('user_id')
  if (error) throw error
  await sb.from('agent_configs')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

  const firstTouch = (inserted?.length ?? 0) > 0
  if (!firstTouch) return

  const now = Date.now()
  const { error: decErr } = await sb.from('agent_decisions').insert(
    SEED_DECISIONS_LIVE.map(d => ({
      user_id: userId, model_id: 'updown', venue: d.venue, action: d.action,
      title: d.title, detail: d.detail, pnl_cents: d.pnl_cents,
      created_at: new Date(now - d.minutes_ago * 60_000).toISOString(),
    })),
  )
  if (decErr) console.error('[agent] seed decisions failed', decErr)
  const { error: ledErr } = await sb.from('wallet_ledger').insert(
    SEED_LEDGER_LIVE.map(l => ({
      user_id: userId, kind: l.kind, label: l.label, detail: l.detail,
      amount_cents: l.amount_cents,
      created_at: new Date(now - l.days_ago * 86_400_000).toISOString(),
    })),
  )
  if (ledErr) console.error('[agent] seed ledger failed', ledErr)
}

export async function loadStateWire(userId: string): Promise<StateWire> {
  const sb = getServerClient()
  const [stRes, lastRes, pnlRes] = await Promise.all([
    sb.from('user_agent_state').select('equipped_model_id, paused, sim_balance_cents')
      .eq('user_id', userId).maybeSingle(),
    sb.from('agent_decisions')
      .select('id, venue, action, title, detail, pnl_cents, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    // Carry-in: Today P&L is DATE-FILTERED (UTC day), not all-time.
    sb.from('agent_decisions').select('pnl_cents')
      .eq('user_id', userId)
      .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
  ])
  if (stRes.error) throw stRes.error
  if (lastRes.error) throw lastRes.error
  if (pnlRes.error) throw pnlRes.error
  const { data: st } = stRes
  const { data: last } = lastRes
  const { data: pnlRows } = pnlRes
  const paused = st?.paused ?? false
  const p = phaseAt(Date.now(), paused)
  return {
    phase: p.phase, title: p.title, sub: p.sub,
    paused,
    paper: true,
    equippedId: st?.equipped_model_id ?? 'updown',
    balanceCents: Number(st?.sim_balance_cents ?? 0),
    todayPnlCents: (pnlRows ?? []).reduce((s, r) => s + Number(r.pnl_cents ?? 0), 0),
    lastDecision: last?.[0] ? decisionRowToWire(last[0]) : null,
  }
}

export async function loadModelsWire(userId: string): Promise<{
  models: AgentModel[]; subscribedIds: string[]; equippedId: string
}> {
  const sb = getServerClient()
  const [rowsRes, cfgRes, subsRes, stRes] = await Promise.all([
    sb.from('agent_models')
      .select('id, name, emoji, brand, color, author, perf_30d, runners, price_cents, price_label, tagline, description, status, featured, included, kind, owner_user_id, sort_order')
      // Own models always visible; first-party (owner null) only when live/review.
      .or(`owner_user_id.eq.${userId},and(owner_user_id.is.null,status.in.(live,review))`)
      .order('sort_order', { ascending: true }),
    sb.from('agent_configs').select('name, emoji, color').eq('user_id', userId).maybeSingle(),
    sb.from('agent_model_subs').select('model_id').eq('user_id', userId).eq('status', 'active'),
    sb.from('user_agent_state').select('equipped_model_id').eq('user_id', userId).maybeSingle(),
  ])
  if (rowsRes.error) throw rowsRes.error
  if (cfgRes.error) throw cfgRes.error
  if (subsRes.error) throw subsRes.error
  if (stRes.error) throw stRes.error
  const { data: rows } = rowsRes
  const { data: cfg } = cfgRes
  const { data: subs } = subsRes
  const { data: st } = stRes
  const catalog = ((rows ?? []) as AgentModelRow[]).map(r => rowToModel(r, userId))
  const firstParty = catalog.filter(m => !m.mine)
  const customs = catalog.filter(m => m.mine)
  const flagship = firstParty.filter(m => m.id === 'updown')
  const rest = firstParty.filter(m => m.id !== 'updown')
  const mine = myModelEntry(cfg ?? { name: 'Longshot v3', emoji: '🐎', color: 'green' })
  return {
    models: [...flagship, mine, ...customs, ...rest],
    subscribedIds: (subs ?? []).map(s => s.model_id),
    equippedId: st?.equipped_model_id ?? 'updown',
  }
}

export async function loadConfig(userId: string) {
  const sb = getServerClient()
  const { data, error } = await sb.from('agent_configs')
    .select('name, emoji, color, prompt, preset').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ?? {
    name: 'Longshot v3', emoji: '🐎', color: 'green',
    prompt: '', preset: 'longshot',
  }
}

export async function loadWalletWire(userId: string): Promise<{
  balanceCents: number; spark: number[]; ledger: LedgerEntry[]
}> {
  const sb = getServerClient()
  const [stRes, rowsRes] = await Promise.all([
    sb.from('user_agent_state').select('sim_balance_cents').eq('user_id', userId).maybeSingle(),
    sb.from('wallet_ledger')
      .select('id, kind, label, detail, amount_cents, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ])
  if (stRes.error) throw stRes.error
  if (rowsRes.error) throw rowsRes.error
  const { data: st } = stRes
  const { data: rows } = rowsRes
  const ledger = (rows ?? []).map(ledgerRowToWire)
  return {
    balanceCents: Number(st?.sim_balance_cents ?? 0),
    spark: sparkFromLedger(ledger.map(l => ({ amountCents: l.amountCents, at: l.at }))),
    ledger,
  }
}

export async function loadActivity(userId: string, limit: number, before?: string): Promise<Decision[]> {
  const sb = getServerClient()
  let q = sb.from('agent_decisions')
    .select('id, venue, action, title, detail, pnl_cents, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (before) q = q.lt('created_at', before)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(decisionRowToWire)
}

export async function applyWallet(userId: string, args: {
  kind: 'deposit' | 'withdraw'; label: string; detail: string
  amountCents: number; stripeRef?: string
}): Promise<number> {
  const sb = getServerClient()
  const { data, error } = await sb.rpc('agent_wallet_apply', {
    p_user_id: userId,
    p_kind: args.kind,
    p_label: args.label,
    p_detail: args.detail,
    p_amount_cents: args.amountCents,
    p_stripe_ref: args.stripeRef ?? null,
  })
  if (error) throw error
  return Number(data)
}

export async function isSubscribed(userId: string, modelId: string): Promise<boolean> {
  const sb = getServerClient()
  const { data, error } = await sb.from('agent_model_subs').select('id')
    .eq('user_id', userId).eq('model_id', modelId).eq('status', 'active').maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function activateSub(userId: string, modelId: string, stripeSubscriptionId: string | null): Promise<void> {
  const sb = getServerClient()
  const { error } = await sb.from('agent_model_subs').upsert(
    { user_id: userId, model_id: modelId, stripe_subscription_id: stripeSubscriptionId, status: 'active' },
    { onConflict: 'user_id,model_id' },
  )
  if (error) throw error
}

export async function cancelSubByStripeId(stripeSubscriptionId: string): Promise<void> {
  const sb = getServerClient()
  const { error } = await sb.from('agent_model_subs')
    .update({ status: 'canceled' }).eq('stripe_subscription_id', stripeSubscriptionId)
  if (error) throw error
}
