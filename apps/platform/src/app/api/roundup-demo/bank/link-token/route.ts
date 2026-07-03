// apps/platform/src/app/api/roundup-demo/bank/link-token/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { ensureStripeCustomer, createFinancialConnectionsSession } from '@/lib/roundup/bank'

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
    .select('stripe_customer_id')
    .eq('session_id', sessionId)
    .single()
  if (loadErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: loadErr?.message }, { status: 500 })
  }

  const customerId = await ensureStripeCustomer(session.stripe_customer_id, sessionId)
  if (customerId !== session.stripe_customer_id) {
    const { error: updateErr } = await sb
      .from('roundup_demo_sessions')
      .update({ stripe_customer_id: customerId })
      .eq('session_id', sessionId)
    if (updateErr) {
      return NextResponse.json({ error: 'customer_persist_failed', message: updateErr.message }, { status: 500 })
    }
  }

  const { clientSecret } = await createFinancialConnectionsSession(customerId)
  const res = NextResponse.json({ clientSecret })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
