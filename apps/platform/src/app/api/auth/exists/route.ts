import { getServerClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/email-validation'

// GET /api/auth/exists?email=<e>
//
// Returns { ok: true, exists: boolean } — the single bit the onboarding door
// needs to route Panel 1 (email capture) to either the LOGIN panel (exists:
// true) or the SIGNUP panels (exists: false).
//
// "exists" means: a Supabase auth user has been created for this email, i.e.
// the person has a password and should LOG IN, not sign up again.
//
// Existence signal — we use waitlist.invite_used_at IS NOT NULL:
//   - All code paths through /api/auth/signup that successfully create a
//     Supabase auth user also set invite_used_at = now() on the waitlist row
//     (both the invite-code path and the open-signup path).
//   - Marketing-waitlist rows (email captured before signup) always have
//     invite_used_at = null, so they correctly return exists: false.
//   - Edge case accepted: an auth user whose waitlist row is missing or
//     invite_used_at is null (unlikely in normal flow) would get exists: false
//     and be routed to signup, where /api/auth/signup catches the duplicate
//     and returns { error: 'email_in_use' } — an acceptable safety net.
//   - We cannot query the auth schema directly via PostgREST (auth.users is
//     not in Supabase's exposed-schemas list), and supabase-js v2's
//     auth.admin.listUsers() has no email-filter parameter.
//
// Security: response never leaks more than the single `exists` bit.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter: per-key (IP:email) window of 10 req/min.
// This is intentionally lightweight (no Redis) — the endpoint is read-only and
// only called during the onboarding flow. For a higher-traffic surface, back
// this with a distributed store.
const hits = new Map<string, { n: number; at: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const w = hits.get(key)
  if (!w || now - w.at > 60_000) {
    hits.set(key, { n: 1, at: now })
    return false
  }
  w.n += 1
  return w.n > 10
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const email = normalizeEmail(url.searchParams.get('email'))

  if (!email) {
    return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (rateLimited(`${ip}:${email}`)) {
    return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const admin = getServerClient()
  const { data, error } = await admin
    .from('waitlist')
    .select('invite_used_at')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    console.error('[auth/exists] waitlist lookup failed', error)
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 })
  }

  return Response.json({ ok: true, exists: Boolean(data?.invite_used_at) })
}
