// apps/platform/src/app/api/roundup-demo/state/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { sessionId, isNew } = await ensureSession()
  const sb = getServerClient()

  const { data: session, error: sessionErr } = await sb
    .from('roundup_demo_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()
  if (sessionErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: sessionErr?.message }, { status: 500 })
  }

  const { data: txns, error: txnsErr } = await sb
    .from('roundup_demo_txns')
    .select('*')
    .eq('session_id', sessionId)
    .order('occurred_on', { ascending: false })
  if (txnsErr) {
    return NextResponse.json({ error: 'txns_load_failed', message: txnsErr.message }, { status: 500 })
  }

  const totalRoundUpCents = (txns ?? []).reduce((sum, t) => sum + t.round_up_cents, 0)
  const pendingAccruedCents = Math.max(0, totalRoundUpCents - session.facilitated_cents)

  const body = {
    session: {
      sessionId,
      bank: {
        linked: Boolean(session.bank_account_id),
        institution: session.bank_institution,
        last4: session.bank_last4,
      },
      rule: {
        roundToCents: session.round_to_cents,
        multiplier: session.multiplier,
        thresholdCents: session.threshold_cents,
        weeklyCapCents: session.weekly_cap_cents,
      },
      pendingAccruedCents,
      walletCents: session.wallet_cents,
      txns: (txns ?? []).map((t) => ({
        id: t.txn_id,
        merchant: t.merchant,
        amountCents: t.amount_cents,
        roundUpCents: t.round_up_cents,
        date: t.occurred_on,
      })),
    },
  }

  const res = NextResponse.json(body)
  return isNew ? attachSessionCookie(res, sessionId) : res
}
