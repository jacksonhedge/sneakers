import { createHash, randomBytes } from 'node:crypto'
import { allowedDestination } from './spare-change-core'

// The partner API for Spare Change Millionaire: outside services (a Whop community, a parlay-builder app, a Discord bot) pull each
// day's tickets as JSON with their own key. This file is the rules only (no database); spare-change-api-store.ts does the reads and
// writes and app/api/spare-change/v1/picks/route.ts puts them together.
//
// Keys look like `scm_` + 43 URL-safe characters (32 random bytes). Only the SHA-256 of a key is stored; a 256-bit random key needs no
// slow hash. Nothing here places a wager, moves money or changes a slip link: the link a partner gets is the same one the email uses,
// partner code included.

export const KEY_PREFIX = 'scm_'
const KEY_RE = /^scm_[A-Za-z0-9_-]{43}$/
/** How much of a key is kept in the clear to tell keys apart: `scm_` + 6 characters. */
export const SHOWN_PREFIX_LENGTH = KEY_PREFIX.length + 6

export const DEFAULT_PER_MINUTE = 60
export const DEFAULT_DAILY = 2000
export const MAX_PER_MINUTE = 600
export const MAX_DAILY = 100_000

export interface NewKey {
  key: string
  prefix: string
  hash: string
}

export const hashKey = (key: string): string => createHash('sha256').update(key, 'utf8').digest('hex')

export function newApiKey(): NewKey {
  const key = KEY_PREFIX + randomBytes(32).toString('base64url')
  return { key, prefix: key.slice(0, SHOWN_PREFIX_LENGTH), hash: hashKey(key) }
}

/**
 * The key a request brings: `Authorization: Bearer scm_…` or `X-API-Key: scm_…`. 'missing' when there is neither, 'malformed' when
 * what's there can't be one of our keys (so no database lookup is spent on it).
 */
export function keyFromHeaders(headers: Headers): { ok: true; key: string } | { ok: false; error: 'missing' | 'malformed' } {
  const auth = headers.get('authorization')?.trim()
  const bearer = auth ? /^Bearer[ ]+(\S+)$/i.exec(auth)?.[1] : undefined
  const raw = bearer ?? headers.get('x-api-key')?.trim()
  if (!raw) return { ok: false, error: 'missing' }
  return KEY_RE.test(raw) ? { ok: true, key: raw } : { ok: false, error: 'malformed' }
}

/** A limit typed on the admin page: a whole number from 1 to max, or the default when blank. null when it's something else. */
export function parseLimit(raw: unknown, fallback: number, max: number): number | null {
  const text = typeof raw === 'string' ? raw.trim().replace(/,/g, '') : ''
  if (!text) return fallback
  if (!/^\d{1,6}$/.test(text)) return null
  const n = Number(text)
  return n >= 1 && n <= max ? n : null
}

/**
 * Per-key requests per minute, on this server process only (like ip-limit.ts). The daily limit is the one counted in the database;
 * this only stops a loop from burning through it in seconds.
 */
export function perKeyMinuteLimiter(windowMs = 60_000): (keyId: string, max: number, now?: number) => boolean {
  const hits = new Map<string, number[]>()
  return (keyId, max, now = Date.now()) => {
    if (hits.size > 5_000) for (const [id, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(id)
    const recent = (hits.get(keyId) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) return false
    hits.set(keyId, [...recent, now])
    return true
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/**
 * Which issue a request asks for. No `date` (or `latest`) = the newest issue dated today or earlier, Eastern. A date after today is
 * refused even when that issue is already built: the pipeline builds the next day's issue overnight, and partners get it on its day,
 * the same day the email goes out.
 */
export function requestedDate(raw: string | null, today: string): { ok: true; date: string | null } | { ok: false; error: 'bad_date' | 'not_published' } {
  const v = raw?.trim() ?? ''
  if (!v || v === 'latest') return { ok: true, date: null }
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) return { ok: false, error: 'bad_date' }
  return v > today ? { ok: false, error: 'not_published' } : { ok: true, date: v }
}

// ------------------------------------------------------------------------------------------------ the response
export interface PicksIssueRow {
  issue_date: string
  issue_no: number | null
  subject: string
}
export interface PicksTicketRow {
  id: string
  position: number
  site: string
  name: string
  buy_in_cents: number
  est_payout_cents: number
  headline_cents: number
  one_in: number | null
  min_age: number
  link: string | null
  estimated: boolean
  result: string
}
export interface PicksLegRow {
  ticket_id: string
  n: number
  sport: string | null
  league: string | null
  event: string
  starts_at: string | null
  market: string | null
  pick: string
  price_text: string
  price_decimal: number | string
  result: string
}

/** Shown with the picks wherever a partner puts them. Partners agree to show it (see docs/spare-change-picks-api.md). */
export const ATTRIBUTION = 'Picks by Spare Change Millionaire'
export const RESPONSIBLE_GAMING =
  'Must be of legal age in your state (18+ or 21+, shown on each ticket). Long shots usually lose: only play what you can afford to lose. ' +
  'Gambling problem? Call 1-800-GAMBLER.'

export function picksResponse(issue: PicksIssueRow, tickets: PicksTicketRow[], legs: PicksLegRow[]) {
  const byTicket = new Map<string, PicksLegRow[]>()
  for (const l of legs) byTicket.set(l.ticket_id, [...(byTicket.get(l.ticket_id) ?? []), l])
  return {
    ok: true as const,
    issue_date: issue.issue_date,
    issue_no: issue.issue_no,
    title: issue.subject,
    attribution: ATTRIBUTION,
    responsible_gaming: RESPONSIBLE_GAMING,
    tickets: [...tickets]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        position: t.position,
        site: t.site,
        name: t.name,
        buy_in_cents: t.buy_in_cents,
        est_payout_cents: Number(t.est_payout_cents),
        headline_cents: Number(t.headline_cents),
        one_in: t.one_in,
        min_age: t.min_age,
        // True while the payout is our estimate from leg prices, not a price quoted by the site.
        estimated: t.estimated,
        result: t.result,
        // Opens the parlay on the site with every leg filled in (and our partner code on it). Only an https link to an allowed site is
        // passed on; anything else is null.
        slip_link: allowedDestination(t.link)?.toString() ?? null,
        legs: (byTicket.get(t.id) ?? [])
          .sort((a, b) => a.n - b.n)
          .map((l) => ({
            n: l.n,
            sport: l.sport,
            league: l.league,
            event: l.event,
            starts_at: l.starts_at,
            market: l.market,
            pick: l.pick,
            price_text: l.price_text,
            price_decimal: Number(l.price_decimal),
            result: l.result,
          })),
      })),
  }
}
