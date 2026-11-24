import { after } from 'next/server'
import { ipLimiter, requestIp } from '@/lib/ip-limit'
import { handleGo } from '@/lib/spare-change-core'
import { goStore } from '@/lib/spare-change-core-store'
import { notifyParlayClick } from '@/lib/spare-change-slack'

export const dynamic = 'force-dynamic'

// Per address, per minute, on this server: enough for someone opening all four tickets a few times, not for a loop.
const mayTap = ipLimiter(30)

// Never indexed, never cached, and the browser sends no Referer onward: this address carries the member's link token, and the site
// being opened must not see it.
const HEADERS = { 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The small plain page shown instead of a redirect. `message` is one of our own fixed sentences. */
function page(message: string, status: number): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Spare Change Millionaire</title><style>body{margin:0;font:16px/1.5 system-ui,-apple-system,sans-serif;background:#f4f5f0;color:#14160f;display:grid;min-height:100vh;place-items:center}main{max-width:28rem;padding:2rem 1.25rem;text-align:center}p{margin:0}</style></head><body><main><p>${esc(message)}</p></main></body></html>`
  return new Response(html, { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } })
}

/**
 * A button in the daily email: `/go/<ticketId>?m=<link_token>`. Notes that this member tapped this ticket (their sc_wagers row and an
 * sc_member_events row), then sends them to the ticket's own link with a 302. Without `m` it is an anonymous tap: an event, then the redirect.
 * No redirect, just a plain page, when: the ticket or the token is unknown (404); the member was removed, is younger than the ticket's
 * minimum age ("This ticket is 21+."), or the ticket's link is not https on the allow-list of sites (403). 429 after 30 taps a minute.
 * The destination is the stored link exactly: the token is never added to it. Opening a link places nothing and moves no money.
 * Each redirect is posted to Slack (#spare-change-parlay-clicks) after it answers.
 */
export async function GET(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!mayTap(requestIp(req.headers))) return page('Too many taps. Wait a minute and try again.', 429)
  const { ticketId } = await params
  const token = new URL(req.url).searchParams.get('m')
  const ipCountry = req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country')
  try {
    const decision = await handleGo({ ticketId, token, ipCountry }, { store: goStore })
    if (decision.action === 'refuse') return page(decision.message, decision.status)
    // The click goes to #spare-change-parlay-clicks after the redirect has answered (spare-change-slack.ts).
    after(() => notifyParlayClick({ ticketId, token }))
    return new Response(null, { status: 302, headers: { ...HEADERS, Location: decision.url } })
  } catch {
    console.error('[go] lookup failed')
    return page('Something went wrong. Try again in a minute.', 503)
  }
}
