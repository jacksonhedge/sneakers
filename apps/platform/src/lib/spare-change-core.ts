// Spare Change Millionaire: the rules behind issues, tickets, wagers and rewards (migration 049, tables sc_*).
//
// The daily email shows four long-shot parlay tickets. A member taps a button to open a ticket on the betting or prediction site, places it
// there themselves and sends a picture of the slip. A verified slip earns that day's reward, paid by hand on Venmo on Fridays.
// This code RECORDS what people did elsewhere. It never places a wager and never moves money.
//
// Nothing here touches the database: every read and write is handed in as a small store function (the Supabase side is in
// spare-change-core-store.ts), so the routes and the tests run the same code. All money is whole cents.
import { createHash, timingSafeEqual } from 'node:crypto'

// ------------------------------------------------------------------------------------------------ small shared pieces
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const parseUuid = (raw: unknown): string | null => (typeof raw === 'string' && UUID_RE.test(raw) ? raw.toLowerCase() : null)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** A real calendar date as YYYY-MM-DD, or null. */
export function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !DATE_RE.test(raw)) return null
  const t = Date.parse(`${raw}T00:00:00Z`)
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== raw ? null : raw
}

/** A calendar date some days later. */
export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null)
const nowIso = (now?: () => Date): string => (now?.() ?? new Date()).toISOString()

/** A whole number from an environment variable, or the default when it is unset, not a whole number, or out of range. */
export function intSetting(raw: string | undefined, fallback: number, min: number, max: number): number {
  const t = (raw ?? '').trim()
  if (!/^\d{1,6}$/.test(t)) return fallback
  const n = Number(t)
  return n >= min && n <= max ? n : fallback
}

// ------------------------------------------------------------------------------------------------ sites: minimum age and where a button may go
// THE one place that says how old someone must be for each site. Sportsbooks are 21; the exchange and the prediction markets are 18,
// except Novig, which is 21.
// A site that is not listed is treated as 21.
export const DEFAULT_MIN_AGE = 21
export const SITE_MIN_AGE: Readonly<Record<string, number>> = {
  draftkings: 21,
  fanduel: 21,
  fanatics: 21,
  prophetx: 18,
  kalshi: 18,
  polymarket: 18,
  novig: 21,
}
export const siteMinAge = (site: string): number => SITE_MIN_AGE[site.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? DEFAULT_MIN_AGE

// The only hosts a tracked link may send someone to (and their subdomains). Anything else gets the refusal page.
export const ALLOWED_LINK_HOSTS = ['prophetx.co', 'draftkings.com', 'kalshi.com', 'polymarket.us', 'polymarket.com', 'fanduel.com', 'fanatics.com'] as const

/** The destination as a URL when it is https, has no username or password in it, and is on the allow-list; otherwise null. */
export function allowedDestination(link: string | null | undefined): URL | null {
  if (!link) return null
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  return ALLOWED_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? url : null
}

// ------------------------------------------------------------------------------------------------ tokens and the ingest secret
// A member's link token: 24 random bytes (192 bits) as 32 URL-safe characters, the same shape as the claim token. It goes in tracked links
// (/go/<ticket>?m=<token>), so it says who tapped; it opens nothing else. Rows backfilled by the migration carry 64 hex characters.
const LINK_TOKEN_RE = /^[A-Za-z0-9_-]{22,128}$/
export function newLinkToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const parseLinkToken = (raw: unknown): string | null => (typeof raw === 'string' && LINK_TOKEN_RE.test(raw) ? raw : null)

/** Compare two secrets without the time taken depending on where they differ (or on their lengths): both are hashed first. */
export function secretsMatch(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b) && given.length > 0
}

// The ingest secret must be long enough to be worth having. Shorter than this (or unset) and the routes that need it answer 503.
export const MIN_SECRET_LENGTH = 24
export type SecretCheck = 'ok' | 'unauthorized' | 'disabled'
/** `Authorization: Bearer <secret>` against the configured secret. 'disabled' when none is configured. */
export function checkBearerSecret(authorization: string | null | undefined, configured: string | undefined): SecretCheck {
  const expected = (configured ?? '').trim()
  if (expected.length < MIN_SECRET_LENGTH) return 'disabled'
  const m = /^Bearer[ ]+(\S+)$/i.exec((authorization ?? '').trim())
  return m && secretsMatch(m[1], expected) ? 'ok' : 'unauthorized'
}

// ------------------------------------------------------------------------------------------------ 1. issue ingest
export interface IssueLeg {
  n: number
  sport: string | null
  league: string | null
  event: string
  startsAt: string | null
  market: string | null
  pick: string
  priceText: string
  priceDecimal: number
  sourceRef: string | null
}
export interface IssueTicket {
  position: number
  site: string
  name: string
  buyInCents: number
  estPayoutCents: number
  headlineCents: number
  oneIn: number | null
  fairOneIn: number | null
  feeCents: number
  minAge: number
  link: string | null
  estimated: boolean
  legs: IssueLeg[]
}
export interface ParsedIssue {
  issueDate: string
  issueNo: number | null
  subject: string
  preheader: string | null
  fromName: string | null
  builtAt: string | null
  tickets: IssueTicket[]
  warnings: string[]
}
export type IssueParse = { ok: true; issue: ParsedIssue } | { ok: false; error: 'invalid_issue'; detail: string }

class Invalid extends Error {}
const bad = (detail: string): never => {
  throw new Invalid(detail)
}

/**
 * Money from the pipeline. It writes dollars (`buy_in: 0.65`); a field named `<name>_cents` is taken as cents instead and must be a whole
 * number. Dollars must land on a whole cent: 0.655 is refused, not rounded.
 */
function cents(obj: Record<string, unknown>, name: string, where: string, required: boolean): number | null {
  const asCents = obj[`${name}_cents`]
  if (asCents !== undefined && asCents !== null) {
    if (typeof asCents !== 'number' || !Number.isSafeInteger(asCents)) bad(`${where}.${name}_cents: ${JSON.stringify(asCents)} is not a whole number of cents`)
    return asCents as number
  }
  const dollars = obj[name]
  if (dollars === undefined || dollars === null) return required ? bad(`${where}.${name}: missing`) : null
  if (typeof dollars !== 'number' || !Number.isFinite(dollars)) bad(`${where}.${name}: ${JSON.stringify(dollars)} is not a number`)
  const scaled = (dollars as number) * 100
  const whole = Math.round(scaled)
  if (Math.abs(scaled - whole) > 1e-6 || !Number.isSafeInteger(whole)) bad(`${where}.${name}: ${dollars} is not a whole number of cents`)
  return whole
}

function wholeOrNull(v: unknown, where: string): number | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1 || v > 2_147_483_647) bad(`${where}: ${JSON.stringify(v)} is not a whole number from 1 up`)
  return v as number
}

function timestampOrNull(v: unknown, where: string): string | null {
  if (v === undefined || v === null || v === '') return null
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  if (Number.isNaN(t)) bad(`${where}: ${JSON.stringify(v)} is not a date and time`)
  return new Date(t).toISOString()
}

const optionalText = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export const MAX_TICKETS = 4
export const MAX_LEGS = 40
// "Within one cent": the estimate in the issue against buy-in x (product of leg decimals - 1), worked out again here.
export const PAYOUT_TOLERANCE_CENTS = 1

/** What the estimated winnings should be, in cents (not rounded), from the buy-in and the legs. */
export const expectedPayoutCents = (buyInCents: number, decimals: number[]): number => buyInCents * (decimals.reduce((p, d) => p * d, 1) - 1)

function parseLeg(raw: unknown, n: number, where: string): IssueLeg {
  const l = isObject(raw) ? raw : bad(`${where}: not an object`)
  const decimal = l.price_decimal ?? l.decimal
  // Stored to four decimal places, so it must still be above 1 once rounded to four.
  if (typeof decimal !== 'number' || !Number.isFinite(decimal) || Math.round(decimal * 1e4) <= 1e4 || decimal >= 1e8) bad(`${where}.decimal: ${JSON.stringify(decimal)} must be a number greater than 1`)
  const event = text(l.event, 300) ?? bad(`${where}.event: missing`)
  const pick = text(l.pick ?? l.selection, 300) ?? bad(`${where}.selection: missing`)
  const priceText = text(l.price_text, 40) ?? bad(`${where}.price_text: missing`)
  return {
    n,
    sport: optionalText(l.sport, 60),
    league: optionalText(l.league, 60),
    event,
    startsAt: timestampOrNull(l.starts_at ?? l.start_et, `${where}.start_et`),
    market: optionalText(l.market, 60),
    pick,
    priceText,
    priceDecimal: decimal as number,
    // The site's own id for this side, whichever the collector kept.
    sourceRef: optionalText(l.source_ref ?? l.line_id ?? l.ticker ?? l.slug ?? l.game_key ?? l.id, 300),
  }
}

function parseTicket(raw: unknown, index: number, warnings: string[]): IssueTicket {
  const where = `tickets[${index}]`
  const t = isObject(raw) ? raw : bad(`${where}: not an object`)
  const position = t.position ?? t.n
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 1 || position > MAX_TICKETS) bad(`${where}.n: ${JSON.stringify(position)} must be a whole number from 1 to ${MAX_TICKETS}`)
  const site = text(t.site, 60) ?? bad(`${where}.site: missing`)
  const name = text(t.name, 120) ?? bad(`${where}.name: missing`)
  const buyInCents = cents(t, 'buy_in', where, true) as number
  if (buyInCents <= 0 || buyInCents > 2_147_483_647) bad(`${where}.buy_in: must be more than zero`)
  // The pipeline calls the exact estimate "winnings"; est_payout is the same number under the database's name.
  const estPayoutCents = cents(t, t.est_payout_cents !== undefined || t.est_payout !== undefined ? 'est_payout' : 'winnings', where, true) as number
  if (estPayoutCents < 0) bad(`${where}.winnings: can't be negative`)
  const headlineCents = cents(t, 'headline', where, true) as number
  if (headlineCents < 0) bad(`${where}.headline: can't be negative`)
  if (headlineCents > estPayoutCents) bad(`${where}.headline: ${headlineCents} cents is more than the estimated winnings (${estPayoutCents} cents); the headline is rounded DOWN`)
  const feeCents = cents(t, 'fee', where, false) ?? 0
  if (feeCents < 0 || feeCents > 2_147_483_647) bad(`${where}.fee: out of range`)
  if (t.estimated !== undefined && typeof t.estimated !== 'boolean') bad(`${where}.estimated: must be true or false`)
  let link: string | null = null
  if (t.link !== undefined && t.link !== null && t.link !== '') {
    link = typeof t.link === 'string' && t.link.length <= 2000 ? t.link : bad(`${where}.link: not a link`)
    if (!/^https:\/\//i.test(link as string)) bad(`${where}.link: must be an https link`)
    if (!allowedDestination(link)) warnings.push(`${where}.link: the host is not on the allow-list, so /go will show the refusal page for this ticket`)
  }
  const legsRaw = Array.isArray(t.legs) ? t.legs : bad(`${where}.legs: missing`)
  if (legsRaw.length < 1 || legsRaw.length > MAX_LEGS) bad(`${where}.legs: needs 1 to ${MAX_LEGS} legs, got ${legsRaw.length}`)
  const legs = (legsRaw as unknown[]).map((l, i) => parseLeg(l, i + 1, `${where}.legs[${i}]`))
  const expected = expectedPayoutCents(buyInCents, legs.map((l) => l.priceDecimal))
  if (Math.abs(estPayoutCents - expected) > PAYOUT_TOLERANCE_CENTS + 1e-6) {
    bad(`${where} (position ${position}): estimated winnings of ${estPayoutCents} cents do not match buy-in ${buyInCents} cents x (product of the ${legs.length} leg decimals - 1) = ${expected.toFixed(2)} cents (off by ${(estPayoutCents - expected).toFixed(2)}; allowed ${PAYOUT_TOLERANCE_CENTS})`)
  }
  return {
    position: position as number,
    site,
    name,
    buyInCents,
    estPayoutCents,
    headlineCents,
    oneIn: wholeOrNull(t.one_in, `${where}.one_in`),
    fairOneIn: wholeOrNull(t.fair_one_in, `${where}.fair_one_in`),
    feeCents,
    minAge: siteMinAge(site),
    link,
    estimated: t.estimated === undefined ? true : (t.estimated as boolean),
    legs,
  }
}

/** Check the pipeline's issue.json and turn it into rows. The first thing wrong is named exactly; nothing is rounded or guessed. */
export function parseIssue(body: unknown): IssueParse {
  try {
    const b = isObject(body) ? body : bad('the body is not a JSON object')
    const issueDate = parseIsoDate(b.issue_date) ?? bad(`issue_date: ${JSON.stringify(b.issue_date)} is not a date (YYYY-MM-DD)`)
    const subject = text(b.subject, 300) ?? bad('subject: missing')
    const ticketsRaw = Array.isArray(b.tickets) ? b.tickets : bad('tickets: missing')
    if (ticketsRaw.length < 1 || ticketsRaw.length > MAX_TICKETS) bad(`tickets: needs 1 to ${MAX_TICKETS} tickets, got ${ticketsRaw.length}`)
    const warnings: string[] = []
    const tickets = (ticketsRaw as unknown[]).map((t, i) => parseTicket(t, i, warnings))
    const positions = new Set(tickets.map((t) => t.position))
    if (positions.size !== tickets.length) bad('tickets: two tickets have the same position (n)')
    return {
      ok: true,
      issue: {
        issueDate,
        issueNo: wholeOrNull(b.issue_no, 'issue_no'),
        subject,
        preheader: optionalText(b.preheader, 500),
        fromName: optionalText(b.from_name, 120),
        builtAt: timestampOrNull(b.built_at ?? b.built_at_et, 'built_at_et'),
        tickets: tickets.sort((a, z) => a.position - z.position),
        warnings,
      },
    }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: 'invalid_issue', detail: e.message }
    throw e
  }
}

export interface StoredTicket {
  id: string
  position: number
  site: string
  legs: Array<{ n: number; event: string; pick: string; sourceRef: string | null }>
  /** How many sc_wagers rows point at this ticket. */
  wagers: number
}
export interface IngestStore {
  ticketsForIssue: (issueDate: string) => Promise<StoredTicket[]>
  /** Insert or update sc_issues by issue_date. `source` is the whole issue.json. */
  upsertIssue: (issue: ParsedIssue, source: unknown) => Promise<void>
  /** Insert or update sc_tickets by (issue_date, position): the row keeps its id, result and settled_at. Returns the id. */
  upsertTicket: (issueDate: string, ticket: IssueTicket) => Promise<string>
  /** Make sc_legs for this ticket exactly these: insert or update by (ticket_id, n), then drop any n beyond the last. Results are kept. */
  replaceLegs: (ticketId: string, legs: IssueLeg[]) => Promise<void>
  deleteTicket: (ticketId: string) => Promise<void>
}

export type IngestAction = 'created' | 'replaced' | 'updated_in_place' | 'deleted'
export interface IngestRefusal {
  position: number
  ticket_id: string
  refused: 'repoint' | 'delete'
  reason: 'has_wagers'
  wagers: number
  detail: string
}
export interface IngestResult {
  ok: true
  issue_date: string
  tickets: Array<{ position: number; id: string; site: string; min_age: number; action: IngestAction }>
  refused: IngestRefusal[]
  warnings: string[]
}

/** What makes a ticket the ticket it is: the site and which picks are on it. Names, prices, amounts and the link are display. */
function pointsElsewhere(stored: StoredTicket, incoming: IssueTicket): string | null {
  if (stored.site.toLowerCase() !== incoming.site.toLowerCase()) return `site changes from ${stored.site} to ${incoming.site}`
  if (stored.legs.length !== incoming.legs.length) return `legs change from ${stored.legs.length} to ${incoming.legs.length}`
  const byN = new Map(stored.legs.map((l) => [l.n, l]))
  for (const leg of incoming.legs) {
    const was = byN.get(leg.n)
    if (!was || was.event !== leg.event || was.pick !== leg.pick || (was.sourceRef ?? null) !== (leg.sourceRef ?? null)) return `leg ${leg.n} is a different pick`
  }
  return null
}

/**
 * Store a checked issue. Safe to post again: rows are matched by issue_date, position and n, and a ticket keeps its id (tracked links in
 * an email already built stay good). A ticket nobody has a wager on is simply made to match the new issue, and one that is no longer in
 * the issue is deleted. A ticket WITH wagers is only ever updated in place (name, amounts, prices, link); it is never deleted and never
 * turned into a different ticket (another site or other picks). Whatever was refused comes back in `refused`, and nothing else is held up.
 */
export async function ingestIssue(issue: ParsedIssue, source: unknown, store: IngestStore): Promise<IngestResult> {
  const existing = new Map((await store.ticketsForIssue(issue.issueDate)).map((t) => [t.position, t]))
  await store.upsertIssue(issue, source)
  const result: IngestResult = { ok: true, issue_date: issue.issueDate, tickets: [], refused: [], warnings: [...issue.warnings] }
  for (const ticket of issue.tickets) {
    const was = existing.get(ticket.position)
    existing.delete(ticket.position)
    if (was && was.wagers > 0) {
      const change = pointsElsewhere(was, ticket)
      if (change) {
        result.refused.push({ position: ticket.position, ticket_id: was.id, refused: 'repoint', reason: 'has_wagers', wagers: was.wagers, detail: `${change}; the stored ticket was left as it is` })
        continue
      }
    }
    const id = await store.upsertTicket(issue.issueDate, ticket)
    await store.replaceLegs(id, ticket.legs)
    result.tickets.push({ position: ticket.position, id, site: ticket.site, min_age: ticket.minAge, action: !was ? 'created' : was.wagers > 0 ? 'updated_in_place' : 'replaced' })
  }
  for (const gone of existing.values()) {
    if (gone.wagers > 0) {
      result.refused.push({ position: gone.position, ticket_id: gone.id, refused: 'delete', reason: 'has_wagers', wagers: gone.wagers, detail: 'this position is not in the new issue; the stored ticket was kept' })
      continue
    }
    await store.deleteTicket(gone.id)
    result.tickets.push({ position: gone.position, id: gone.id, site: gone.site, min_age: siteMinAge(gone.site), action: 'deleted' })
  }
  result.tickets.sort((a, z) => a.position - z.position)
  return result
}

// ------------------------------------------------------------------------------------------------ members, as the rules see them
export type MemberStatus = 'waitlist' | 'active' | 'paused' | 'removed'
export interface Member {
  id: string
  /** The age they gave when they signed up. It is the only age on record. */
  age: number
  status: MemberStatus
  tester: boolean
  dailyRewardCents: number
  rewardDays: number
  extraRewardDays: number
  startedOn: string | null
  referredByMemberId: string | null
  venmoHandle: string | null
}
export interface TicketRef {
  id: string
  issueDate: string
  position: number
  site: string
  minAge: number
  link: string | null
}
export interface MemberEvent {
  memberId: string | null
  type: 'tap' | 'tap_refused' | 'slip_submitted' | 'wager_verified' | 'wager_rejected' | 'referral_qualified' | 'rewards_paid'
  ticketId?: string | null
  meta?: Record<string, unknown>
  ipCountry?: string | null
}
/** Write one sc_member_events row. Best effort: it must never throw. */
export type LogEvent = (event: MemberEvent) => Promise<void>

// ------------------------------------------------------------------------------------------------ 2. the tracked link (/go/<ticketId>?m=<link_token>)
export type GoRefusal = 'unknown_ticket' | 'destination_not_allowed' | 'unknown_token' | 'member_removed' | 'under_age'
export type GoDecision = { action: 'redirect'; url: string; tap: 'member' | 'anonymous' } | { action: 'refuse'; reason: GoRefusal; status: 403 | 404; message: string }

const refuse = (reason: GoRefusal, status: 403 | 404, message: string): GoDecision => ({ action: 'refuse', reason, status, message })

/**
 * Where a tap goes. `hasToken` is whether the link carried `m` at all; `member` is the row that token belongs to (null when it is unknown
 * or malformed). No `m`: an anonymous tap, still sent on. The destination is the ticket's own link, untouched: the token is never added to it.
 */
export function decideGo(i: { ticket: Pick<TicketRef, 'minAge' | 'link'> | null; hasToken: boolean; member: Pick<Member, 'age' | 'status'> | null }): GoDecision {
  if (!i.ticket) return refuse('unknown_ticket', 404, "That link doesn't work.")
  const destination = allowedDestination(i.ticket.link)
  if (!destination) return refuse('destination_not_allowed', 403, "This ticket can't be opened from here.")
  if (!i.hasToken) return { action: 'redirect', url: destination.toString(), tap: 'anonymous' }
  if (!i.member) return refuse('unknown_token', 404, "That link doesn't work. Open the newest email and tap the button again.")
  if (i.member.status === 'removed') return refuse('member_removed', 403, 'This link is no longer active.')
  if (i.member.age < i.ticket.minAge) return refuse('under_age', 403, `This ticket is ${i.ticket.minAge}+.`)
  return { action: 'redirect', url: destination.toString(), tap: 'member' }
}

export interface GoStore {
  ticketById: (ticketId: string) => Promise<TicketRef | null>
  memberByLinkToken: (token: string) => Promise<Member | null>
  /**
   * The member's sc_wagers row for this ticket: made on the first tap (status 'tapped', tapped_at set, tap_count 1); after that only
   * tap_count goes up (and tapped_at is set if it was empty). status is never changed here.
   */
  recordTap: (memberId: string, ticketId: string, nowIso: string) => Promise<void>
  logEvent: LogEvent
}

/** One tap on a tracked link: look up, decide, record, and say where to send them. Throws only when the lookups cannot be made. */
export async function handleGo(i: { ticketId: unknown; token: string | null; ipCountry: string | null }, deps: { store: GoStore; now?: () => Date }): Promise<GoDecision> {
  const ticketId = parseUuid(i.ticketId)
  const ticket = ticketId ? await deps.store.ticketById(ticketId) : null
  const hasToken = i.token !== null
  const token = parseLinkToken(i.token)
  // A malformed token never reaches the database.
  const member = ticket && token ? await deps.store.memberByLinkToken(token) : null
  const decision = decideGo({ ticket, hasToken, member })
  if (!ticket) return decision
  const event = { ticketId: ticket.id, ipCountry: i.ipCountry }
  if (decision.action === 'refuse') {
    if (member) await deps.store.logEvent({ ...event, memberId: member.id, type: 'tap_refused', meta: { reason: decision.reason } })
    return decision
  }
  if (member) {
    // The tap is worth less than getting the person to their ticket: if recording it fails they are still sent on.
    await deps.store.recordTap(member.id, ticket.id, nowIso(deps.now)).catch(() => console.error('[spare-change-core] tap not recorded'))
    await deps.store.logEvent({ ...event, memberId: member.id, type: 'tap' })
  } else {
    await deps.store.logEvent({ ...event, memberId: null, type: 'tap', meta: { anonymous: true } })
  }
  return decision
}

// ------------------------------------------------------------------------------------------------ 3. slips, verification and THE reward rule
export interface RewardConfig {
  /** Nobody younger than this earns a daily reward, whatever the ticket (SPARE_CHANGE_REWARD_MIN_AGE, default 21). */
  rewardMinAge: number
  /** Cash a referrer earns per friend, in cents (SPARE_CHANGE_REFERRAL_CENTS_PER_FRIEND, default 500 = $5). */
  referralCentsPerFriend: number
  /** Extra reward days a referrer gets per friend (SPARE_CHANGE_REFERRAL_DAYS_PER_FRIEND, default 0: referrals pay cash now). */
  referralDaysPerFriend: number
  /** How many friends count (SPARE_CHANGE_REFERRAL_MAX_FRIENDS, default 5). */
  referralMaxFriends: number
}
export const REWARD_DEFAULTS: RewardConfig = { rewardMinAge: 21, referralCentsPerFriend: 500, referralDaysPerFriend: 0, referralMaxFriends: 5 }
export const WELCOME_REWARD_CENTS = 100
const MAX_EXTRA_DAYS = 365

export function rewardConfig(env: Record<string, string | undefined>): RewardConfig {
  return {
    rewardMinAge: intSetting(env.SPARE_CHANGE_REWARD_MIN_AGE, REWARD_DEFAULTS.rewardMinAge, 18, 120),
    referralCentsPerFriend: intSetting(env.SPARE_CHANGE_REFERRAL_CENTS_PER_FRIEND, REWARD_DEFAULTS.referralCentsPerFriend, 0, 10_000),
    referralDaysPerFriend: intSetting(env.SPARE_CHANGE_REFERRAL_DAYS_PER_FRIEND, REWARD_DEFAULTS.referralDaysPerFriend, 0, 60),
    referralMaxFriends: intSetting(env.SPARE_CHANGE_REFERRAL_MAX_FRIENDS, REWARD_DEFAULTS.referralMaxFriends, 0, 50),
  }
}

export type DailyWithheld =
  | 'member_paused'
  | 'member_removed'
  | 'under_ticket_min_age'
  | 'under_reward_min_age'
  | 'no_reward_amount'
  | 'no_reward_days'
  | 'before_reward_window'
  | 'after_reward_window'
  | 'already_rewarded_for_day'
export type DailyDecision =
  | { grant: true; amountCents: number; issueDate: string; windowStart: string; windowEnd: string; startsWindow: boolean }
  | { grant: false; code: DailyWithheld; detail: string }

const no = (code: DailyWithheld, detail: string): DailyDecision => ({ grant: false, code, detail })

/**
 * THE reward rule: does a verified slip for this ticket earn this member that day's reward? One daily reward of the member's own
 * daily_reward_cents (a tester simply has a different amount), for the ticket's issue date, when ALL of these hold:
 *   1. the member is 'waitlist' or 'active' (not paused, not removed);
 *   2. the member is old enough for the ticket, and at least the reward minimum age;
 *   3. the date is inside the member's reward window: started_on .. started_on + reward_days + extra_reward_days - 1
 *      (a member with no started_on starts on this date);
 *   4. that member has no daily reward for that date yet.
 */
export function decideDailyReward(i: {
  member: Pick<Member, 'age' | 'status' | 'dailyRewardCents' | 'rewardDays' | 'extraRewardDays' | 'startedOn'>
  ticket: Pick<TicketRef, 'issueDate' | 'minAge'>
  rewardMinAge: number
  alreadyRewarded: boolean
}): DailyDecision {
  const { member, ticket } = i
  if (member.status === 'paused') return no('member_paused', 'the member is paused')
  if (member.status === 'removed') return no('member_removed', 'the member was removed')
  if (member.age < ticket.minAge) return no('under_ticket_min_age', `the ticket is ${ticket.minAge}+ and the member signed up as ${member.age}`)
  if (member.age < i.rewardMinAge) return no('under_reward_min_age', `rewards are ${i.rewardMinAge}+ and the member signed up as ${member.age}`)
  if (member.dailyRewardCents <= 0) return no('no_reward_amount', "the member's daily reward is zero")
  const days = member.rewardDays + member.extraRewardDays
  if (days <= 0) return no('no_reward_days', 'the member has no reward days')
  const windowStart = member.startedOn ?? ticket.issueDate
  const windowEnd = addDays(windowStart, days - 1)
  if (ticket.issueDate < windowStart) return no('before_reward_window', `the reward window starts ${windowStart}`)
  if (ticket.issueDate > windowEnd) return no('after_reward_window', `the reward window ended ${windowEnd}`)
  if (i.alreadyRewarded) return no('already_rewarded_for_day', `a daily reward for ${ticket.issueDate} is already in the ledger`)
  return { grant: true, amountCents: member.dailyRewardCents, issueDate: ticket.issueDate, windowStart, windowEnd, startsWindow: member.startedOn === null }
}

export type WagerStatus = 'tapped' | 'submitted' | 'verified' | 'rejected'
export interface Wager {
  id: string
  memberId: string
  ticketId: string
  status: WagerStatus
}

export interface WagerStore {
  memberById: (id: string) => Promise<Member | null>
  memberByEmail: (email: string) => Promise<Member | null>
  ticketById: (id: string) => Promise<TicketRef | null>
  ticketByPosition: (issueDate: string, position: number) => Promise<TicketRef | null>
  wagerById: (id: string) => Promise<Wager | null>
  wagerFor: (memberId: string, ticketId: string) => Promise<Wager | null>
  /**
   * Record that a slip arrived. No row yet: insert one (status 'submitted', source 'slip'). A row that is 'tapped', 'submitted' or
   * 'rejected': set status 'submitted' and the slip fields, clear any rejected_reason. Never touches a 'verified' row.
   * 'duplicate_slip' when another wager already carries that slip_bet_id (the partial unique index).
   */
  saveSlip: (i: { memberId: string; ticketId: string; slipRef: string; slipBetId: string | null; stakeCents: number | null; nowIso: string }) => Promise<{ wagerId: string } | 'duplicate_slip' | 'already_verified'>
  /** status 'submitted' -> 'verified' with verified_at and verified_by. False when the row was not 'submitted' (someone got there first). */
  markVerified: (wagerId: string, verifiedBy: string, nowIso: string) => Promise<boolean>
  /** status 'tapped' or 'submitted' -> 'rejected' with the reason. False when the row was in neither state. */
  markRejected: (wagerId: string, reason: string) => Promise<boolean>
  hasDailyReward: (memberId: string, issueDate: string) => Promise<boolean>
  /** Set started_on only where it is still null, then return the member's started_on as it now stands. */
  startRewardWindow: (memberId: string, issueDate: string) => Promise<string>
  /** Insert the 'daily' sc_rewards row. 'duplicate' when the unique index says that member already has one for that date. */
  insertDailyReward: (i: { memberId: string; issueDate: string; amountCents: number; wagerId: string; note: string; nowIso: string }) => Promise<{ rewardId: string } | 'duplicate'>
  referralCredit: (friendId: string) => Promise<{ referrerId: string; qualifiedAt: string | null; daysGranted: number; centsGranted: number; wagerId: string | null } | null>
  /** How many of this referrer's friends have qualified AND earned them something (cash or days): the friends that count toward the cap. */
  creditedFriends: (referrerId: string) => Promise<number>
  /** Make (or fill in) the friend's sc_referral_credits row as qualified. False when it was already qualified. */
  qualifyReferral: (i: { referrerId: string; friendId: string; wagerId: string; daysGranted: number; centsGranted: number; nowIso: string }) => Promise<boolean>
  /** Insert the referrer's 'referral' sc_rewards row for this friend's qualifying wager. 'duplicate' when that wager already paid one. */
  insertReferralReward: (i: { referrerId: string; wagerId: string; amountCents: number; note: string; nowIso: string }) => Promise<{ rewardId: string } | 'duplicate'>
  /** The sum of days_granted over this referrer's qualified friends. */
  referralDaysGranted: (referrerId: string) => Promise<number>
  /** Raise the referrer's extra_reward_days to this number. Never lowers it. */
  raiseExtraRewardDays: (referrerId: string, days: number) => Promise<void>
  logEvent: LogEvent
}

type Problem<E extends string> = { ok: false; error: E; detail?: string }

async function findMember(b: Record<string, unknown>, store: WagerStore): Promise<Member | null> {
  const id = parseUuid(b.member_id)
  if (id) return store.memberById(id)
  const email = typeof b.email === 'string' && b.email.includes('@') && b.email.length <= 254 ? b.email.trim().toLowerCase() : null
  return email ? store.memberByEmail(email) : null
}
async function findTicket(b: Record<string, unknown>, store: WagerStore): Promise<TicketRef | null> {
  const id = parseUuid(b.ticket_id)
  if (id) return store.ticketById(id)
  const date = parseIsoDate(b.issue_date)
  const position = typeof b.position === 'number' && Number.isInteger(b.position) && b.position >= 1 && b.position <= MAX_TICKETS ? b.position : null
  return date && position ? store.ticketByPosition(date, position) : null
}
/** The wager a body points at: `wager_id`, or a member (`member_id` or `email`) plus a ticket (`ticket_id`, or `issue_date` + `position`). */
async function findWager(b: Record<string, unknown>, store: WagerStore): Promise<Wager | null> {
  const id = parseUuid(b.wager_id)
  if (id) return store.wagerById(id)
  const [member, ticket] = await Promise.all([findMember(b, store), findTicket(b, store)])
  return member && ticket ? store.wagerFor(member.id, ticket.id) : null
}

export type SubmitResult =
  | { ok: true; wager_id: string; member_id: string; ticket_id: string; status: 'submitted' }
  | Problem<'unknown_member' | 'unknown_ticket' | 'invalid_slip_ref' | 'invalid_slip_bet_id' | 'invalid_stake' | 'duplicate_slip' | 'already_verified'>

/** `submit`: a slip arrived for a member and a ticket. Body: member, ticket, `slip_ref`, optional `slip_bet_id` and `stake_cents`. */
export async function submitSlip(body: unknown, deps: { store: WagerStore; by: string; now?: () => Date }): Promise<SubmitResult> {
  const b = isObject(body) ? body : {}
  const slipRef = text(b.slip_ref, 500)
  if (!slipRef) return { ok: false, error: 'invalid_slip_ref', detail: 'slip_ref is the email message id or storage path of the slip picture' }
  const slipBetId = b.slip_bet_id === undefined || b.slip_bet_id === null || b.slip_bet_id === '' ? null : text(b.slip_bet_id, 200)
  if (b.slip_bet_id && !slipBetId) return { ok: false, error: 'invalid_slip_bet_id' }
  const stake = b.stake_cents
  if (stake !== undefined && stake !== null && (typeof stake !== 'number' || !Number.isInteger(stake) || stake <= 0 || stake > 100_000_000)) return { ok: false, error: 'invalid_stake', detail: 'stake_cents must be a whole number of cents above zero' }
  const member = await findMember(b, deps.store)
  if (!member) return { ok: false, error: 'unknown_member' }
  const ticket = await findTicket(b, deps.store)
  if (!ticket) return { ok: false, error: 'unknown_ticket' }
  const saved = await deps.store.saveSlip({ memberId: member.id, ticketId: ticket.id, slipRef, slipBetId, stakeCents: (stake as number | undefined) ?? null, nowIso: nowIso(deps.now) })
  if (saved === 'duplicate_slip') return { ok: false, error: 'duplicate_slip', detail: 'another wager already uses that slip_bet_id' }
  if (saved === 'already_verified') return { ok: false, error: 'already_verified' }
  await deps.store.logEvent({ memberId: member.id, type: 'slip_submitted', ticketId: ticket.id, meta: { wager_id: saved.wagerId, by: deps.by } })
  return { ok: true, wager_id: saved.wagerId, member_id: member.id, ticket_id: ticket.id, status: 'submitted' }
}

export type RejectResult = { ok: true; wager_id: string; status: 'rejected' } | Problem<'unknown_wager' | 'invalid_reason' | 'already_verified'>

/** `reject`: the slip does not count. A verified wager is not un-verified here (its reward may already be owed or paid). */
export async function rejectWager(body: unknown, deps: { store: WagerStore; by: string; now?: () => Date }): Promise<RejectResult> {
  const b = isObject(body) ? body : {}
  const reason = text(b.reason, 500)
  if (!reason) return { ok: false, error: 'invalid_reason', detail: 'a reason is required' }
  const wager = await findWager(b, deps.store)
  if (!wager) return { ok: false, error: 'unknown_wager' }
  if (wager.status === 'verified') return { ok: false, error: 'already_verified', detail: 'a verified wager stays verified; correct the ledger with an adjustment instead' }
  if (wager.status !== 'rejected') {
    const changed = await deps.store.markRejected(wager.id, reason)
    if (!changed) return { ok: false, error: 'already_verified', detail: 'the wager changed while this was running; look at it again' }
    await deps.store.logEvent({ memberId: wager.memberId, type: 'wager_rejected', ticketId: wager.ticketId, meta: { wager_id: wager.id, by: deps.by } })
  }
  return { ok: true, wager_id: wager.id, status: 'rejected' }
}

export type ReferralWithheld = 'no_referrer' | 'self_referral' | 'already_qualified' | 'referrer_cap_reached' | 'referrer_not_eligible'
export type Granted =
  | { kind: 'daily'; reward_id: string; member_id: string; issue_date: string; amount_cents: number }
  | { kind: 'referral_cash'; reward_id: string; referrer_id: string; friend_id: string; amount_cents: number }
  | { kind: 'referral_days'; referrer_id: string; friend_id: string; days: number; referrer_extra_reward_days: number }
export type Withheld = { what: 'daily'; code: DailyWithheld; detail: string } | { what: 'referral'; code: ReferralWithheld; detail: string }
export type VerifyResult =
  | { ok: true; wager_id: string; status: 'verified'; already_verified: boolean; granted: Granted[]; withheld: Withheld[] }
  | Problem<'unknown_wager' | 'not_submitted' | 'unknown_member' | 'unknown_ticket'>

/**
 * The referral half of verification. A friend's FIRST verified wager qualifies them, once (the friend's credit row is unique, and it is
 * only ever qualified once). For each of the referrer's first `referralMaxFriends` friends the referrer earns `referralCentsPerFriend` as
 * one 'referral' row in sc_rewards (paid on Fridays with everything else), plus `referralDaysPerFriend` extra days if that is set. Friends
 * after the cap still qualify but earn nothing. The referrer must be allowed rewards (not paused or removed, and at least the reward
 * minimum age); a friend who qualifies while their referrer is not still uses up their one qualification.
 * Safe to run again: the credit row remembers the wager and amount, and the reward row is unique per wager, so a run that stopped
 * half way finishes and a repeat adds nothing.
 */
const venmoKey = (h: string) => h.trim().replace(/^@/, '').toLowerCase()

async function qualifyReferral(friend: Member, wager: Wager, deps: { store: WagerStore; config: RewardConfig }, at: string): Promise<{ granted: Granted[]; withheld?: Withheld }> {
  const referrerId = friend.referredByMemberId
  if (!referrerId) return { granted: [], withheld: { what: 'referral', code: 'no_referrer', detail: 'nobody referred this member' } }
  if (referrerId === friend.id) return { granted: [], withheld: { what: 'referral', code: 'self_referral', detail: 'a member cannot refer themselves' } }
  const { store, config } = deps
  const cap = Math.min(config.referralMaxFriends * config.referralDaysPerFriend, MAX_EXTRA_DAYS)
  const syncReferrerDays = async (): Promise<number> => {
    const total = Math.min(await store.referralDaysGranted(referrerId), cap)
    if (total > 0) await store.raiseExtraRewardDays(referrerId, total)
    return total
  }
  const payCash = async (wagerId: string, cents: number): Promise<Granted | null> => {
    if (cents <= 0) return null
    const note = `Referral: friend ${friend.id} had a first slip verified`
    const inserted = await store.insertReferralReward({ referrerId, wagerId, amountCents: cents, note, nowIso: at })
    return inserted === 'duplicate' ? null : { kind: 'referral_cash', reward_id: inserted.rewardId, referrer_id: referrerId, friend_id: friend.id, amount_cents: cents }
  }
  const alreadyCounted: Withheld = { what: 'referral', code: 'already_qualified', detail: 'this friend already counted for their referrer' }

  const credit = await store.referralCredit(friend.id)
  if (credit?.qualifiedAt) {
    // Finish anything an earlier run left undone.
    await syncReferrerDays()
    const finished = credit.wagerId ? await payCash(credit.wagerId, credit.centsGranted) : null
    return { granted: finished ? [finished] : [], withheld: finished ? undefined : alreadyCounted }
  }

  const referrer = await store.memberById(referrerId)
  // Same Venmo username on both sides = one person paying themselves (the $5 can only be paid to a Venmo username).
  const sameVenmo = !!referrer?.venmoHandle && !!friend.venmoHandle && venmoKey(referrer.venmoHandle) === venmoKey(friend.venmoHandle)
  const friendOut = friend.status === 'paused' || friend.status === 'removed'
  const eligible = !!referrer && !sameVenmo && !friendOut && referrer.status !== 'paused' && referrer.status !== 'removed' && referrer.age >= config.rewardMinAge
  const counted = await store.creditedFriends(referrerId)
  const open = eligible && counted < config.referralMaxFriends
  const cents = open ? config.referralCentsPerFriend : 0
  const days = open ? config.referralDaysPerFriend : 0
  const won = await store.qualifyReferral({ referrerId, friendId: friend.id, wagerId: wager.id, daysGranted: days, centsGranted: cents, nowIso: at })
  if (!won) return { granted: [], withheld: alreadyCounted }
  await store.logEvent({ memberId: referrerId, type: 'referral_qualified', ticketId: wager.ticketId, meta: { friend_id: friend.id, cents, days, wager_id: wager.id } })
  if (!eligible) {
    const why = !referrer
      ? 'the referrer is no longer on the list'
      : sameVenmo
        ? 'the friend and the referrer have the same Venmo username'
        : friendOut
          ? `the friend is ${friend.status}`
          : referrer.status === 'paused' || referrer.status === 'removed' ? `the referrer is ${referrer.status}` : `referral rewards are ${config.rewardMinAge}+ and the referrer signed up as ${referrer.age}`
    return { granted: [], withheld: { what: 'referral', code: 'referrer_not_eligible', detail: why } }
  }
  if (!open) return { granted: [], withheld: { what: 'referral', code: 'referrer_cap_reached', detail: `the referrer already has ${config.referralMaxFriends} friends counted` } }
  const granted: Granted[] = []
  const cash = await payCash(wager.id, cents)
  if (cash) granted.push(cash)
  const total = await syncReferrerDays()
  if (days > 0) granted.push({ kind: 'referral_days', referrer_id: referrerId, friend_id: friend.id, days, referrer_extra_reward_days: total })
  return { granted }
}

/**
 * `verify`: the slip is real. Marks the wager verified, then runs the reward rule (decideDailyReward) and the referral rule, and says
 * exactly what was granted and why anything was not. Everything is safe to run again: a second verify finds the day's reward and the
 * friend's credit already there and grants nothing new. If a run stops half way, running it again finishes it.
 */
export async function verifyWager(body: unknown, deps: { store: WagerStore; config: RewardConfig; by: string; now?: () => Date }): Promise<VerifyResult> {
  const { store, config } = deps
  const wager = await findWager(isObject(body) ? body : {}, store)
  if (!wager) return { ok: false, error: 'unknown_wager' }
  if (wager.status === 'tapped' || wager.status === 'rejected') return { ok: false, error: 'not_submitted', detail: `the wager is '${wager.status}'; record the slip with action "submit" first` }
  let member = await store.memberById(wager.memberId)
  if (!member) return { ok: false, error: 'unknown_member' }
  const ticket = await store.ticketById(wager.ticketId)
  if (!ticket) return { ok: false, error: 'unknown_ticket' }
  const at = nowIso(deps.now)
  const alreadyVerified = wager.status === 'verified' || !(await store.markVerified(wager.id, deps.by, at))
  if (!alreadyVerified) await store.logEvent({ memberId: member.id, type: 'wager_verified', ticketId: ticket.id, meta: { wager_id: wager.id, by: deps.by } })

  const granted: Granted[] = []
  const withheld: Withheld[] = []
  const decide = (m: Member, alreadyRewarded: boolean) => decideDailyReward({ member: m, ticket, rewardMinAge: config.rewardMinAge, alreadyRewarded })
  let decision = decide(member, await store.hasDailyReward(member.id, ticket.issueDate))
  if (decision.grant && decision.startsWindow) {
    // Someone else may have started the window a moment ago on another date: use whatever is stored now, and decide again against it.
    member = { ...member, startedOn: await store.startRewardWindow(member.id, ticket.issueDate) }
    decision = decide(member, false)
  }
  if (decision.grant) {
    const note = `Daily reward: verified slip for ticket ${ticket.position} (${ticket.site}) of ${ticket.issueDate}`
    const inserted = await store.insertDailyReward({ memberId: member.id, issueDate: decision.issueDate, amountCents: decision.amountCents, wagerId: wager.id, note, nowIso: at })
    if (inserted === 'duplicate') withheld.push({ what: 'daily', code: 'already_rewarded_for_day', detail: `a daily reward for ${ticket.issueDate} is already in the ledger` })
    else granted.push({ kind: 'daily', reward_id: inserted.rewardId, member_id: member.id, issue_date: decision.issueDate, amount_cents: decision.amountCents })
  } else {
    withheld.push({ what: 'daily', code: decision.code, detail: decision.detail })
  }

  const referral = await qualifyReferral(member, wager, deps, at)
  granted.push(...referral.granted)
  if (referral.withheld) withheld.push(referral.withheld)
  return { ok: true, wager_id: wager.id, status: 'verified', already_verified: alreadyVerified, granted, withheld }
}

// ------------------------------------------------------------------------------------------------ 4. payouts (recording what was paid by hand)
export interface RewardForPayout {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
  /** The member's Venmo username as it is right now. */
  venmoHandle: string | null
}
export interface PayoutStore {
  rewardsByIds: (ids: string[]) => Promise<RewardForPayout[]>
  /** Set paid_at, pay_batch and paid_to on one reward, only where paid_at is still null. False when it was already paid. */
  markPaid: (rewardId: string, i: { paidAt: string; batch: string; paidTo: string }) => Promise<boolean>
  logEvent: LogEvent
}
export type PayoutRefusal = 'unknown_reward' | 'already_paid' | 'no_venmo_handle'
export type PayoutResult =
  | { ok: true; batch: string; paid_at: string; paid: Array<{ reward_id: string; member_id: string; amount_cents: number; paid_to: string }>; refused: Array<{ reward_id: string; reason: PayoutRefusal }>; total_paid_cents: number }
  | Problem<'invalid_batch' | 'invalid_reward_ids'>

export const MAX_PAYOUT_ROWS = 500
const BATCH_RE = /^[A-Za-z0-9][A-Za-z0-9 _.:-]{0,59}$/

/**
 * Mark rewards as paid, after they were paid by hand. Body: `reward_ids` and a `batch` label. Each reward is taken on its own: one that
 * is already paid, or whose member has no Venmo username, is refused and listed, and the rest are marked. paid_to is the member's Venmo
 * username at this moment. This moves no money; it writes down that money moved.
 */
export async function markRewardsPaid(body: unknown, deps: { store: PayoutStore; by: string; now?: () => Date }): Promise<PayoutResult> {
  const b = isObject(body) ? body : {}
  const batch = typeof b.batch === 'string' && BATCH_RE.test(b.batch.trim()) ? b.batch.trim() : null
  if (!batch) return { ok: false, error: 'invalid_batch', detail: 'batch is a label of 1 to 60 letters, numbers, spaces and _ . : -' }
  const raw = Array.isArray(b.reward_ids) ? b.reward_ids : null
  const ids = raw ? raw.map(parseUuid) : null
  if (!ids || ids.length < 1 || ids.length > MAX_PAYOUT_ROWS || ids.some((id) => id === null) || new Set(ids).size !== ids.length) {
    return { ok: false, error: 'invalid_reward_ids', detail: `reward_ids is a list of 1 to ${MAX_PAYOUT_ROWS} different reward ids` }
  }
  const paidAt = nowIso(deps.now)
  const rows = new Map((await deps.store.rewardsByIds(ids as string[])).map((r) => [r.id, r]))
  const result: Extract<PayoutResult, { ok: true }> = { ok: true, batch, paid_at: paidAt, paid: [], refused: [], total_paid_cents: 0 }
  for (const id of ids as string[]) {
    const row = rows.get(id)
    const reason: PayoutRefusal | null = !row ? 'unknown_reward' : row.paidAt ? 'already_paid' : !row.venmoHandle ? 'no_venmo_handle' : null
    if (!row || !row.venmoHandle || reason) {
      result.refused.push({ reward_id: id, reason: reason ?? 'unknown_reward' })
      continue
    }
    if (!(await deps.store.markPaid(id, { paidAt, batch, paidTo: row.venmoHandle }))) {
      result.refused.push({ reward_id: id, reason: 'already_paid' })
      continue
    }
    result.paid.push({ reward_id: id, member_id: row.memberId, amount_cents: row.amountCents, paid_to: row.venmoHandle })
    result.total_paid_cents += row.amountCents
  }
  if (result.paid.length) await deps.store.logEvent({ memberId: null, type: 'rewards_paid', meta: { batch, by: deps.by, count: result.paid.length, total_cents: result.total_paid_cents } })
  return result
}

// ------------------------------------------------------------------------------------------------ 6. settle (results, from the pipeline's grading)
export type LegResult = 'pending' | 'hit' | 'miss' | 'void' | 'ungraded'
export type TicketResult = 'pending' | 'won' | 'lost' | 'void'
// The pipeline's words (grade_yesterday.py) next to the database's. A push is a void leg; Hit / Miss / Pending are the ticket's status.
const LEG_WORDS: Record<string, LegResult> = { pending: 'pending', hit: 'hit', miss: 'miss', void: 'void', push: 'void', ungraded: 'ungraded' }
const TICKET_WORDS: Record<string, TicketResult> = { pending: 'pending', won: 'won', hit: 'won', lost: 'lost', miss: 'lost', void: 'void' }

export interface SettleTicket {
  position: number
  result: TicketResult
  legs: Array<{ n: number; result: LegResult }>
}
export type SettleParse = { ok: true; issueDate: string; tickets: SettleTicket[] } | { ok: false; error: 'invalid_settle'; detail: string }

/** The result a ticket must have given its legs: one miss loses it; otherwise anything still open keeps it pending; all void is void. */
export function ticketResultFromLegs(legs: LegResult[]): TicketResult {
  if (legs.includes('miss')) return 'lost'
  if (legs.some((r) => r === 'pending' || r === 'ungraded')) return 'pending'
  return legs.every((r) => r === 'void') ? 'void' : 'won'
}

/**
 * Check a settle body: `issue_date` and `tickets: [{ position, result, legs: [{ n, result }] }]`. Leg results may be in the pipeline's
 * words (hit, miss, push, pending, ungraded) and ticket results too (Hit, Miss, Pending). A ticket result that its own legs do not
 * support is refused: a ticket is never marked won on someone's say-so.
 */
export function parseSettle(body: unknown): SettleParse {
  try {
    const b = isObject(body) ? body : bad('the body is not a JSON object')
    const issueDate = parseIsoDate(b.issue_date) ?? bad(`issue_date: ${JSON.stringify(b.issue_date)} is not a date (YYYY-MM-DD)`)
    const raw = Array.isArray(b.tickets) && b.tickets.length >= 1 && b.tickets.length <= MAX_TICKETS ? (b.tickets as unknown[]) : bad(`tickets: needs 1 to ${MAX_TICKETS} tickets`)
    const tickets = raw.map((t, i): SettleTicket => {
      const where = `tickets[${i}]`
      const o = isObject(t) ? t : bad(`${where}: not an object`)
      const position = typeof o.position === 'number' && Number.isInteger(o.position) && o.position >= 1 && o.position <= MAX_TICKETS ? o.position : bad(`${where}.position: must be a whole number from 1 to ${MAX_TICKETS}`)
      const legsRaw = Array.isArray(o.legs) && o.legs.length >= 1 && o.legs.length <= MAX_LEGS ? (o.legs as unknown[]) : bad(`${where}.legs: needs 1 to ${MAX_LEGS} legs`)
      const legs = legsRaw.map((l, j) => {
        const lo = isObject(l) ? l : bad(`${where}.legs[${j}]: not an object`)
        const n = typeof lo.n === 'number' && Number.isInteger(lo.n) && lo.n >= 1 && lo.n <= MAX_LEGS ? lo.n : bad(`${where}.legs[${j}].n: must be a whole number from 1 up`)
        const result = (typeof lo.result === 'string' ? LEG_WORDS[lo.result.toLowerCase()] : undefined) ?? bad(`${where}.legs[${j}].result: ${JSON.stringify(lo.result)} is not a leg result`)
        return { n, result }
      })
      if (new Set(legs.map((l) => l.n)).size !== legs.length) bad(`${where}.legs: two legs have the same n`)
      const fromLegs = ticketResultFromLegs(legs.map((l) => l.result))
      const said = o.result === undefined || o.result === null ? fromLegs : ((typeof o.result === 'string' ? TICKET_WORDS[o.result.toLowerCase()] : undefined) ?? bad(`${where}.result: ${JSON.stringify(o.result)} is not a ticket result`))
      if (said !== fromLegs) bad(`${where} (position ${position}): result '${said}' does not follow from its legs, which make it '${fromLegs}'`)
      return { position, result: said, legs }
    })
    if (new Set(tickets.map((t) => t.position)).size !== tickets.length) bad('tickets: two tickets have the same position')
    return { ok: true, issueDate, tickets }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: 'invalid_settle', detail: e.message }
    throw e
  }
}

/**
 * What a won wager paid, in cents: the stake times the ticket's multiplier, where the multiplier is (product of the decimals of the legs
 * that hit) - 1, the same "winnings" the ticket's estimate uses. A void leg drops out, as it does on a real slip. null without a stake.
 * It is worked out from the stored leg prices, so it is an estimate of what the site paid, not a statement from the site.
 */
export function wonPayoutCents(stakeCents: number | null, legs: Array<{ priceDecimal: number; result: LegResult }>): number | null {
  if (stakeCents === null) return null
  const multiplier = legs.filter((l) => l.result === 'hit').reduce((p, l) => p * l.priceDecimal, 1) - 1
  return Math.max(0, Math.round(stakeCents * multiplier))
}

export interface SettleStore {
  ticketsWithLegs: (issueDate: string) => Promise<Array<{ id: string; position: number; legs: Array<{ n: number; priceDecimal: number }> }>>
  setLegResults: (ticketId: string, legs: Array<{ n: number; result: LegResult }>) => Promise<void>
  /** settledAt is null while the ticket is pending. */
  setTicketResult: (ticketId: string, result: TicketResult, settledAt: string | null) => Promise<void>
  wagersForTicket: (ticketId: string) => Promise<Array<{ id: string; stakeCents: number | null }>>
  /** Set result and payout_cents (null clears it) on these wagers. */
  setWagerResults: (wagerIds: string[], result: TicketResult, payoutCents: number | null) => Promise<void>
}
export type SettleResult =
  | { ok: true; issue_date: string; tickets: Array<{ position: number; ticket_id: string; result: TicketResult; legs_updated: number; wagers_updated: number; wagers_with_payout: number }> }
  | Problem<'unknown_issue' | 'unknown_ticket' | 'unknown_leg'>

/**
 * Write graded results: each leg, each ticket (settled_at is set once it is no longer pending), and every wager on that ticket (its
 * result is the ticket's; payout_cents only for a won wager with a known stake). Nothing is changed unless every position and leg in the
 * body exists. Safe to post again as more games finish. No money moves.
 */
export async function settleIssue(settle: Extract<SettleParse, { ok: true }>, deps: { store: SettleStore; now?: () => Date }): Promise<SettleResult> {
  const stored = new Map((await deps.store.ticketsWithLegs(settle.issueDate)).map((t) => [t.position, t]))
  if (stored.size === 0) return { ok: false, error: 'unknown_issue', detail: `no tickets are stored for ${settle.issueDate}` }
  for (const t of settle.tickets) {
    const ticket = stored.get(t.position)
    if (!ticket) return { ok: false, error: 'unknown_ticket', detail: `no ticket at position ${t.position} for ${settle.issueDate}` }
    const known = new Set(ticket.legs.map((l) => l.n))
    const missing = t.legs.find((l) => !known.has(l.n))
    if (missing) return { ok: false, error: 'unknown_leg', detail: `position ${t.position} has no leg ${missing.n}` }
    if (t.legs.length !== ticket.legs.length) return { ok: false, error: 'unknown_leg', detail: `position ${t.position} has ${ticket.legs.length} legs and the body grades ${t.legs.length}` }
  }
  const at = nowIso(deps.now)
  const out: Extract<SettleResult, { ok: true }> = { ok: true, issue_date: settle.issueDate, tickets: [] }
  for (const t of settle.tickets) {
    const ticket = stored.get(t.position)!
    await deps.store.setLegResults(ticket.id, t.legs)
    await deps.store.setTicketResult(ticket.id, t.result, t.result === 'pending' ? null : at)
    const wagers = await deps.store.wagersForTicket(ticket.id)
    const resultByN = new Map(t.legs.map((l) => [l.n, l.result]))
    const legs = ticket.legs.map((l) => ({ priceDecimal: l.priceDecimal, result: resultByN.get(l.n) as LegResult }))
    // Wagers that get the same payout are written together (in practice: one group with no payout, and one per stake).
    const groups = new Map<number | null, string[]>()
    for (const w of wagers) {
      const payout = t.result === 'won' ? wonPayoutCents(w.stakeCents, legs) : null
      groups.set(payout, [...(groups.get(payout) ?? []), w.id])
    }
    let withPayout = 0
    for (const [payout, ids] of groups) {
      await deps.store.setWagerResults(ids, t.result, payout)
      if (payout !== null) withPayout += ids.length
    }
    out.tickets.push({ position: t.position, ticket_id: ticket.id, result: t.result, legs_updated: t.legs.length, wagers_updated: wagers.length, wagers_with_payout: withPayout })
  }
  return out
}
