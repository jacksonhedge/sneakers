// apps/platform/src/lib/roundup/session.ts
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import type { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'

export const ROUNDUP_SESSION_COOKIE = 'roundup_demo_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function readSessionId(): Promise<string | null> {
  const store = await cookies()
  return store.get(ROUNDUP_SESSION_COOKIE)?.value ?? null
}

/**
 * Reads the session cookie if present; otherwise creates a new
 * roundup_demo_sessions row and returns a fresh id. Callers must attach the
 * cookie to their response via attachSessionCookie when isNew is true —
 * this function only touches the DB, never the response (route handlers
 * set cookies on NextResponse, not via next/headers, per this repo's
 * existing pattern in src/app/r/[code]/route.ts).
 */
export async function ensureSession(): Promise<{ sessionId: string; isNew: boolean }> {
  const existing = await readSessionId()
  const sb = getServerClient()

  if (existing) {
    const { data, error } = await sb
      .from('roundup_demo_sessions')
      .select('session_id')
      .eq('session_id', existing)
      .maybeSingle()
    if (error) throw new Error(`failed to verify roundup_demo session: ${error.message}`)
    if (data) return { sessionId: existing, isNew: false }
    // cookie references a missing row (e.g. demo data reset) — fall through
    // and create a fresh session below instead of trusting the stale cookie.
  }

  const sessionId = randomUUID()
  const { error } = await sb.from('roundup_demo_sessions').insert({ session_id: sessionId })
  if (error) throw new Error(`failed to create roundup_demo session: ${error.message}`)
  return { sessionId, isNew: true }
}

export function attachSessionCookie(res: NextResponse, sessionId: string): NextResponse {
  res.cookies.set(ROUNDUP_SESSION_COOKIE, sessionId, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
  })
  return res
}
