import { normalizeEmail } from '@/lib/email-validation'
import { addToSneakersWaitlist, getSneakersWaitlistCount, publicCount } from '@/lib/sneakers-waitlist'

export const dynamic = 'force-dynamic'

// A small per-address limit (this server only; one process). Enough to stop a loop, nothing more.
const hits = new Map<string, number[]>()
function allowed(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= 5) return false
  hits.set(ip, [...recent, now])
  return true
}

/** Join the Sneakers waitlist: an email, nothing else. No confirmation email and no position: just a row with the time it arrived. */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!allowed(ip)) return Response.json({ error: 'too_many' }, { status: 429 })
  const body = (await req.json().catch(() => ({}))) as { email?: unknown }
  const email = normalizeEmail(body.email)
  if (!email) return Response.json({ error: 'invalid_email' }, { status: 400 })
  const result = await addToSneakersWaitlist({ email, referrer: req.headers.get('referer'), ipCountry: req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country') })
  if (!result.ok) return Response.json({ error: 'server_error' }, { status: 500 })
  return Response.json({ ok: true, existing: result.existing })
}

/** The real count, or null while it is too small to show. */
export async function GET() {
  return Response.json({ count: publicCount(await getSneakersWaitlistCount()) })
}
