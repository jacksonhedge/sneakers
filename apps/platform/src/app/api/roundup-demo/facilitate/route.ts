// apps/platform/src/app/api/roundup-demo/facilitate/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { thresholdReached, transferableCents, type RoundUpRule } from '@sneakers/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const sb = getServerClient()

  const { data: session, error: loadErr } = await sb
    .from('roundup_demo_sessions')
    .select('round_to_cents, multiplier, threshold_cents, weekly_cap_cents, facilitated_cents, wallet_cents, transferred_this_week_cents')
    .eq('session_id', sessionId)
    .single()
  if (loadErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: loadErr?.message }, { status: 500 })
  }

  const { data: txns, error: txnsErr } = await sb
    .from('roundup_demo_txns')
    .select('round_up_cents')
    .eq('session_id', sessionId)
  if (txnsErr) {
    return NextResponse.json({ error: 'txns_load_failed', message: txnsErr.message }, { status: 500 })
  }

  const totalRoundUpCents = (txns ?? []).reduce((sum, t) => sum + t.round_up_cents, 0)
  const pendingAccruedCents = Math.max(0, totalRoundUpCents - session.facilitated_cents)

  const rule: RoundUpRule = {
    roundToCents: session.round_to_cents,
    multiplier: session.multiplier,
    thresholdCents: session.threshold_cents,
    weeklyCapCents: session.weekly_cap_cents,
  }

  if (!thresholdReached(pendingAccruedCents, rule)) {
    const res = NextResponse.json({ ok: true, moved: false, pendingAccruedCents })
    return isNew ? attachSessionCookie(res, sessionId) : res
  }

  const movedCents = transferableCents(pendingAccruedCents, rule, session.transferred_this_week_cents)
  if (movedCents <= 0) {
    const res = NextResponse.json({ ok: true, moved: false, pendingAccruedCents, reason: 'weekly_cap_reached' })
    return isNew ? attachSessionCookie(res, sessionId) : res
  }

  const { error: updateErr } = await sb
    .from('roundup_demo_sessions')
    .update({
      facilitated_cents: session.facilitated_cents + movedCents,
      wallet_cents: session.wallet_cents + movedCents,
      transferred_this_week_cents: session.transferred_this_week_cents + movedCents,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
  if (updateErr) {
    return NextResponse.json({ error: 'facilitation_update_failed', message: updateErr.message }, { status: 500 })
  }

  const { error: ledgerErr } = await sb.from('roundup_demo_ledger').insert({
    session_id: sessionId,
    kind: 'facilitation',
    amount_cents: movedCents,
    memo: `Round-ups swept to wallet at $${(rule.thresholdCents / 100).toFixed(2)} threshold`,
  })
  if (ledgerErr) {
    return NextResponse.json({ error: 'ledger_write_failed', message: ledgerErr.message }, { status: 500 })
  }

  const res = NextResponse.json({
    ok: true,
    moved: true,
    movedCents,
    walletCents: session.wallet_cents + movedCents,
  })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
