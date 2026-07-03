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

  // Ledger row is written BEFORE the wallet/session update (fail closed): if the ledger
  // insert fails, we bail out before any money moves, so there's never a wallet credit
  // without a corresponding audit row. The inverse gap (a ledger row exists but the
  // session update below fails) is possible since this isn't a real DB transaction, but
  // that gap is detectable/reconcilable later (ledger cumulative sum vs. wallet_cents),
  // which is strictly better than the original ordering's silent over-crediting. True
  // atomicity would need a Postgres function/RPC wrapping both writes in one transaction
  // — out of scope here since there's no migration path available in this environment.
  const { data: ledgerRow, error: ledgerErr } = await sb
    .from('roundup_demo_ledger')
    .insert({
      session_id: sessionId,
      kind: 'facilitation',
      amount_cents: movedCents,
      memo: `Round-ups swept to wallet at $${(rule.thresholdCents / 100).toFixed(2)} threshold`,
    })
    .select('id')
    .single()
  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ error: 'ledger_write_failed', message: ledgerErr?.message }, { status: 500 })
  }

  // Optimistic concurrency control: only apply the update if facilitated_cents still
  // matches what we read moments earlier. If another concurrent request already moved
  // the session forward, this filter matches zero rows and .select() comes back empty
  // (distinct from a Supabase error, which surfaces via updateErr). We do NOT retry with
  // fresh values in this request — that would risk double-applying movedCents against a
  // value we didn't originate.
  const { data: updatedRows, error: updateErr } = await sb
    .from('roundup_demo_sessions')
    .update({
      facilitated_cents: session.facilitated_cents + movedCents,
      wallet_cents: session.wallet_cents + movedCents,
      transferred_this_week_cents: session.transferred_this_week_cents + movedCents,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('facilitated_cents', session.facilitated_cents)
    .select('wallet_cents')
  if (updateErr) {
    // Genuine DB error on the update (network blip, constraint violation, etc.).
    // The ledger row was already inserted; compensate by deleting it so the audit
    // trail doesn't claim a movement that didn't happen. Best-effort: if the delete
    // itself fails, proceed to return the original error anyway without letting the
    // failed cleanup mask or replace the real error.
    await sb.from('roundup_demo_ledger').delete().eq('id', ledgerRow.id)
    return NextResponse.json({ error: 'facilitation_update_failed', message: updateErr.message }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Zero rows matched: another concurrent request already changed facilitated_cents
    // between our read and this write, so no money actually moved on this call. The
    // ledger row inserted above was written on the assumption this call would win the
    // race; since it didn't, compensate by deleting that row so the audit trail never
    // claims a movement that didn't happen (a ledger row's own presence is what other
    // code/humans reconcile against, so an orphaned one here would itself become a false
    // audit entry). Best-effort: if the delete fails, we still return the no-op response
    // rather than resurrecting an update we deliberately chose not to retry; the
    // dangling ledger row becomes a manual-reconciliation case at worst, which is far
    // better than the double-write this guard exists to prevent. The caller re-syncs and
    // calls facilitate() again on its next poll cycle, so the money itself isn't lost.
    await sb.from('roundup_demo_ledger').delete().eq('id', ledgerRow.id)
    return NextResponse.json({
      ok: true,
      moved: false,
      reason: 'concurrent_update',
      pendingAccruedCents,
    })
  }

  const res = NextResponse.json({
    ok: true,
    moved: true,
    movedCents,
    walletCents: session.wallet_cents + movedCents,
  })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
