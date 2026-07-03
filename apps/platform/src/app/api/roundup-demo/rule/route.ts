import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function positiveInt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined
}

export async function PATCH(req: Request) {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const update: Record<string, number> = {}
  const roundToCents = positiveInt(body.roundToCents)
  const multiplier = positiveInt(body.multiplier)
  const thresholdCents = positiveInt(body.thresholdCents)
  const weeklyCapCents = positiveInt(body.weeklyCapCents)
  if (roundToCents !== undefined) update.round_to_cents = roundToCents
  if (multiplier !== undefined) update.multiplier = multiplier
  if (thresholdCents !== undefined) update.threshold_cents = thresholdCents
  if (weeklyCapCents !== undefined) update.weekly_cap_cents = weeklyCapCents

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 })
  }

  const sb = getServerClient()
  const { error } = await sb
    .from('roundup_demo_sessions')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
