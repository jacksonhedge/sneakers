// apps/platform/src/app/api/roundup-demo/transactions/sync/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { listRecentTransactions } from '@/lib/roundup/bank'
import { roundUpsFor, seedTransactions, type Txn, type RoundUpRule } from '@sneakers/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_REAL_TXNS_BEFORE_SKIPPING_DEMO_FEED = 3

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
    .select('bank_account_id, round_to_cents, multiplier, threshold_cents, weekly_cap_cents')
    .eq('session_id', sessionId)
    .single()
  if (loadErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: loadErr?.message }, { status: 500 })
  }

  let txns: Txn[] = []
  if (session.bank_account_id) {
    try {
      txns = await listRecentTransactions(session.bank_account_id)
    } catch {
      txns = [] // fall through to demo feed below
    }
  }
  if (txns.length < MIN_REAL_TXNS_BEFORE_SKIPPING_DEMO_FEED) {
    txns = seedTransactions(10)
  }

  const rule: RoundUpRule = {
    roundToCents: session.round_to_cents,
    multiplier: session.multiplier,
    thresholdCents: session.threshold_cents,
    weeklyCapCents: session.weekly_cap_cents,
  }
  const roundUps = roundUpsFor(txns, rule)
  const roundUpByTxnId = new Map(roundUps.map((r) => [r.txnId, r.roundUpCents]))

  const rows = txns.map((t) => ({
    session_id: sessionId,
    txn_id: t.id,
    merchant: t.merchant,
    amount_cents: t.amountCents,
    round_up_cents: roundUpByTxnId.get(t.id) ?? 0,
    occurred_on: t.date,
  }))

  const { error: upsertErr } = await sb
    .from('roundup_demo_txns')
    .upsert(rows, { onConflict: 'session_id,txn_id', ignoreDuplicates: true })
  if (upsertErr) {
    return NextResponse.json({ error: 'txn_sync_failed', message: upsertErr.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true, syncedCount: rows.length })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
