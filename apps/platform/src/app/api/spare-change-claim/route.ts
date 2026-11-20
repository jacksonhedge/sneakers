import { after } from 'next/server'
import { ipLimiter, requestIp } from '@/lib/ip-limit'
import { submitClaim, viewClaim } from '@/lib/spare-change-claim'
import { claimDeps, shareForEmail } from '@/lib/spare-change-store'

export const dynamic = 'force-dynamic'

// Per address, per minute, on this server: 10 looks at a link and 5 tries at saving a username (the same 5 as the waitlist routes).
const mayView = ipLimiter(10)
const maySubmit = ipLimiter(5)
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const tooMany = () => json({ status: 'too_many' }, 429)

/**
 * What the claim page should show for `?t=`: `open` (the form), `claimed` (with the username masked), `cap_reached`, or `unknown`.
 * A token that never existed, a malformed one and a missing one all get the same 404 `unknown`. Asking counts as confirming the email
 * address; that write runs after the answer has gone, so a known and an unknown token do the same work before answering.
 */
export async function GET(req: Request) {
  if (!mayView(requestIp(req.headers))) return tooMany()
  const view = await viewClaim(new URL(req.url).searchParams.get('t'), claimDeps(after))
  return json(view, view.status === 'unknown' ? 404 : view.status === 'error' ? 500 : 200)
}

/**
 * Save a Venmo username for a claim link. Body: `t` (the token) and `venmo`.
 * 200 `saved` (with the username as typed, and the person's share details when they can be found) or `claimed` (already saved: masked, unchanged).
 * 400 `invalid_venmo`; 404 `unknown`; 409 `duplicate_venmo` (another person used that username) or `cap_reached` (nothing stored); 429; 500.
 */
export async function POST(req: Request) {
  if (!maySubmit(requestIp(req.headers))) return tooMany()
  const result = await submitClaim(await req.json().catch(() => ({})), claimDeps())
  if (result.status === 'saved') return json({ status: 'saved', handle: result.handle, share: await shareForEmail(result.email) })
  const status = { claimed: 200, invalid_venmo: 400, unknown: 404, duplicate_venmo: 409, cap_reached: 409, error: 500 }[result.status]
  return json(result, status)
}
