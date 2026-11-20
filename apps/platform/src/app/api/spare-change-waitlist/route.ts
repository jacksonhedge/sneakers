import { waitlistStanding } from '@/lib/sneakers-waitlist'
import { joinSpareChange, validateSpareChange } from '@/lib/spare-change-waitlist'

export const dynamic = 'force-dynamic'

// The same small per-address limit as /api/sneakers-waitlist (this server only; one process). Enough to stop a loop, nothing more.
const hits = new Map<string, number[]>()
function allowed(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= 5) return false
  hits.set(ip, [...recent, now])
  return true
}

/**
 * Join the Spare Change Millionaire newsletter list and the Sneakers waitlist with one form.
 * Body: `name`, `email`, `state`, `age` (a whole number, as typed) and an optional `ref` code.
 * 400 errors: `invalid_email`, `invalid_age` (not a whole number from 13 to 120), `invalid_name`, `invalid_state`.
 * Under 18 the person joins the Sneakers waitlist only: `newsletter` comes back false with `reason: "under_18"`. No email is sent.
 * The answer has the same fields as /api/sneakers-waitlist (a code and standing only for someone new to that list), plus `newsletter`.
 * `referrals` is the real Sneakers-waitlist count; the pages cap what they show for the newsletter at 5.
 */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!allowed(ip)) return Response.json({ error: 'too_many' }, { status: 429 })
  const signup = validateSpareChange(await req.json().catch(() => ({})))
  if (!signup.ok) return Response.json({ error: signup.error }, { status: 400 })
  const result = await joinSpareChange(signup, { referrer: req.headers.get('referer'), ipCountry: req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country') })
  if (!result.ok) return Response.json({ error: 'server_error' }, { status: 500 })
  const newsletter = result.newsletter ? { newsletter: true } : { newsletter: false, reason: result.reason }
  if (result.existing || !result.code) return Response.json({ ok: true, existing: true, ...newsletter })
  const standing = await waitlistStanding(result.code)
  return Response.json({ ok: true, existing: false, ...newsletter, code: result.code, referrals: standing?.referrals ?? 0, position: standing?.position ?? null })
}
