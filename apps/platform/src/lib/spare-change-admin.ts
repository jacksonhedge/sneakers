import { isAdminEmail } from './admin-auth'
import { checkBearerSecret } from './spare-change-core'
import { getAuthClient } from './supabase-auth'

// Who may call the Spare Change admin routes (/api/spare-change/admin/*).
//
// People: the same gate as /api/admin/* (see approve-user/route.ts): a signed-in Supabase session whose email is on ADMIN_EMAILS.
// 401 when nobody is signed in, 403 when they are not an admin.
//
// The pipeline: `Authorization: Bearer <SPARE_CHANGE_INGEST_SECRET>`, compared in constant time. It is accepted only by the two routes
// the pipeline posts to (ingest and settle); verifying slips and marking payouts always need a signed-in admin.
export const NO_STORE = { 'Cache-Control': 'no-store' } as const
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE })

export type AdminGate = { ok: true; by: string } | { ok: false; response: Response }

export async function requireAdminSession(): Promise<AdminGate> {
  let email: string | null = null
  try {
    const supabase = await getAuthClient()
    const { data } = await supabase.auth.getUser()
    email = data.user?.email ?? null
  } catch {
    email = null
  }
  if (!email) return { ok: false, response: json({ ok: false, error: 'unauthenticated' }, 401) }
  if (!isAdminEmail(email)) return { ok: false, response: json({ ok: false, error: 'forbidden' }, 403) }
  return { ok: true, by: email.toLowerCase() }
}

/**
 * The ingest secret only. 503 `not_configured` when SPARE_CHANGE_INGEST_SECRET is unset (or too short to be a secret): the route is off.
 * 401 `unauthorized` without the right bearer token.
 */
export function requireIngestSecret(req: Request): AdminGate {
  const check = checkBearerSecret(req.headers.get('authorization'), process.env.SPARE_CHANGE_INGEST_SECRET)
  if (check === 'disabled') return { ok: false, response: json({ ok: false, error: 'not_configured' }, 503) }
  if (check === 'unauthorized') return { ok: false, response: json({ ok: false, error: 'unauthorized' }, 401) }
  return { ok: true, by: 'pipeline' }
}

/** The pipeline's secret, or else a signed-in admin. A request that brings a bearer token is judged on that token alone. */
export async function requireIngestSecretOrAdmin(req: Request): Promise<AdminGate> {
  if (req.headers.get('authorization')) {
    const gate = requireIngestSecret(req)
    // With no secret configured a bearer token proves nothing: say 401, not 503, because this route still works for a signed-in admin.
    return gate.ok || process.env.SPARE_CHANGE_INGEST_SECRET ? gate : { ok: false, response: json({ ok: false, error: 'unauthorized' }, 401) }
  }
  return requireAdminSession()
}

// The largest body these routes read: an issue.json is about 60 KB.
export const MAX_BODY_BYTES = 1_000_000
/** The JSON body, or null when it is missing, too big or not JSON. */
export async function readJson(req: Request): Promise<unknown | null> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return null
  try {
    const raw = await req.text()
    return raw.length > MAX_BODY_BYTES ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
