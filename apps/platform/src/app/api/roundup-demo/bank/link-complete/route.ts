// apps/platform/src/app/api/roundup-demo/bank/link-complete/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { completeFinancialConnectionsLink } from '@/lib/roundup/bank'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const body = (await req.json().catch(() => ({}))) as { financialConnectionsSessionId?: unknown }
  const fcSessionId = typeof body.financialConnectionsSessionId === 'string' ? body.financialConnectionsSessionId : null
  if (!fcSessionId) {
    return NextResponse.json({ error: 'missing_fc_session_id' }, { status: 400 })
  }

  const account = await completeFinancialConnectionsLink(fcSessionId)
  if (!account) {
    return NextResponse.json({ error: 'no_account_linked' }, { status: 400 })
  }

  const sb = getServerClient()
  const { error } = await sb
    .from('roundup_demo_sessions')
    .update({
      bank_account_id: account.id,
      bank_institution: account.institution,
      bank_last4: account.last4,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
  if (error) {
    return NextResponse.json({ error: 'persist_failed', message: error.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true, institution: account.institution, last4: account.last4 })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
