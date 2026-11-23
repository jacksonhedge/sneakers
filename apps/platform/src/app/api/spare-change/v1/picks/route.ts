import { ipLimiter, requestIp } from '@/lib/ip-limit'
import { todayEastern } from '@/lib/spare-change'
import { hashKey, keyFromHeaders, perKeyMinuteLimiter, picksResponse, requestedDate } from '@/lib/spare-change-api'
import { countRequest, issueFor, keyByHash, ticketsAndLegs } from '@/lib/spare-change-api-store'

export const dynamic = 'force-dynamic'

// Per address, per minute, before any key is looked up: slows down someone guessing keys. Generous, because one partner server may
// serve many keys' worth of traffic from one address.
const mayTry = ipLimiter(120)
const mayUse = perKeyMinuteLimiter()

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } })

/**
 * GET /api/spare-change/v1/picks?date=YYYY-MM-DD — one day's Spare Change Millionaire tickets for a partner.
 * Key: `Authorization: Bearer scm_…` or `X-API-Key: scm_…` (made on the admin Picks API page). No `date` = today's issue (the newest
 * one dated today or earlier, US Eastern). Past dates also carry results once graded.
 *
 * 200 picks (see picksResponse). 400 `bad_date`. 401 `missing_key` / `invalid_key` / `revoked_key`. 404 `no_issue`, or `not_published`
 * for a date after today. 429 `rate_limited` (per minute, Retry-After: 60) or `daily_limit` (resets at midnight Eastern).
 * Every response to a valid key has X-RateLimit-Limit / X-RateLimit-Remaining for the day.
 */
export async function GET(req: Request) {
  if (!mayTry(requestIp(req.headers))) return json({ ok: false, error: 'rate_limited' }, 429, { 'Retry-After': '60' })

  const found = keyFromHeaders(req.headers)
  if (!found.ok) return json({ ok: false, error: found.error === 'missing' ? 'missing_key' : 'invalid_key' }, 401)

  const today = todayEastern()
  try {
    const key = await keyByHash(hashKey(found.key))
    if (!key) return json({ ok: false, error: 'invalid_key' }, 401)
    if (key.revoked_at) return json({ ok: false, error: 'revoked_key' }, 401)
    if (!mayUse(key.id, key.per_minute_limit)) return json({ ok: false, error: 'rate_limited' }, 429, { 'Retry-After': '60' })

    const used = await countRequest(key.id, today)
    const limits = { 'X-RateLimit-Limit': String(key.daily_limit), 'X-RateLimit-Remaining': String(Math.max(0, key.daily_limit - used)) }
    if (used > key.daily_limit) return json({ ok: false, error: 'daily_limit' }, 429, limits)

    const asked = requestedDate(new URL(req.url).searchParams.get('date'), today)
    if (!asked.ok) return json({ ok: false, error: asked.error }, asked.error === 'bad_date' ? 400 : 404, limits)

    const issue = await issueFor(asked.date, today)
    if (!issue) return json({ ok: false, error: 'no_issue' }, 404, limits)
    const { tickets, legs } = await ticketsAndLegs(issue.issue_date)
    return json(picksResponse(issue, tickets, legs), 200, limits)
  } catch {
    console.error('[spare-change-picks-api] read failed')
    return json({ ok: false, error: 'server_error' }, 500)
  }
}
