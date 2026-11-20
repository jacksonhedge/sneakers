// Claiming the one welcome dollar: the link in the welcome email, the Venmo username form behind it, and the rules that keep it to one
// dollar per person. Nothing here touches the database directly (the reads and writes are handed in), so the page, the route and the
// tests all use the same code. The Supabase side is in spare-change-store.ts.
//
// The controls: the link is only ever sent to the email address that signed up (so claiming proves the address is real); a link can be
// claimed once; a Venmo username can be used once; and the whole round stops at SPARE_CHANGE_CLAIM_CAP claims. Paying is done by hand.

export const CLAIM_COPY = {
  heading: 'Claim your free dollar',
  fieldLabel: 'Venmo username',
  fieldPlaceholder: 'your-venmo',
  fieldNote: "We'll send $1 to this Venmo on Friday. Double-check the spelling.",
  save: 'Save',
  saving: 'Saving…',
  invalidVenmo: 'That does not look like a Venmo username. Use 5 to 30 letters, numbers, hyphens or underscores.',
  duplicate: 'That Venmo username has already been used for a free dollar.',
  capReached: "All the free dollars for this round have been claimed. You're still on the list.",
  unknown: "That link doesn't work. Open the newest welcome email and tap the button again.",
  claimedHeading: "You're all set.",
  claimedNote: 'Wrong username? Reply to your welcome email.',
  tooMany: 'Too many tries. Wait a minute and try again.',
  error: 'Something went wrong. Try again in a minute.',
  saved: (handle: string) => `Saved. Your dollar goes to @${handle} on Friday.`,
  claimedLine: (masked: string) => `Your dollar goes to ${masked}.`,
} as const

// A Venmo username: 5 to 30 letters, digits, hyphens or underscores. People type it with an @ or paste their profile link, so both are
// accepted. `handle` is what they typed (shown back and paid to); `key` is the lower-cased form used to hold one dollar per username.
const VENMO_RE = /^[A-Za-z0-9_-]{5,30}$/
export function parseVenmoHandle(raw: unknown): { handle: string; key: string } | null {
  if (typeof raw !== 'string') return null
  const handle = raw
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.|account\.)?venmo\.com\/(?:u\/)?/i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@+/, '')
    .trim()
  return VENMO_RE.test(handle) ? { handle, key: handle.toLowerCase() } : null
}

/** "@sa•••ld": enough for the owner of the username to recognize it, not enough for anyone else to read it off the screen. */
export const maskVenmoHandle = (handle: string): string => `@${handle.slice(0, 2)}•••${handle.slice(-2)}`

// The token in the welcome email's link: 24 random bytes (192 bits) from the platform's cryptographic generator, as 32 URL-safe characters.
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/
export function newClaimToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The token from `?t=`, or null when it is not exactly the shape of one (so junk never reaches the database). */
export const parseClaimToken = (raw: unknown): string | null => (typeof raw === 'string' && TOKEN_RE.test(raw) ? raw : null)

export const claimUrl = (origin: string, token: string): string => `${origin.replace(/\/+$/, '')}/spare-change/claim?t=${token}`

// Where the link in the email points. The configured site address first (the one every other email uses). Without it, the address the
// request came in on, but only when that is one of our own hosts or local: a request can carry any Host header, and the link holds a
// secret, so a stranger's host must never end up in an email. Otherwise the live site.
export const DEFAULT_SITE_ORIGIN = 'https://sneakersterminal.com'
function httpOrigin(raw: string | null | undefined): URL | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}
export function claimOrigin(i: { siteUrl: string | null | undefined; requestOrigin: string | null | undefined }): string {
  const site = httpOrigin(i.siteUrl?.trim())
  if (site) return site.origin
  const request = httpOrigin(i.requestOrigin)
  const host = request?.hostname ?? ''
  const ours = host === 'localhost' || host === '127.0.0.1' || host === 'sneakersterminal.com' || host.endsWith('.sneakersterminal.com')
  return request && ours ? request.origin : DEFAULT_SITE_ORIGIN
}

// How many free dollars there are in this round. 0 closes it.
export const CLAIM_CAP_DEFAULT = 100
export function claimCap(raw: string | undefined): number {
  const text = (raw ?? '').trim()
  return /^\d{1,7}$/.test(text) ? Number(text) : CLAIM_CAP_DEFAULT
}

export interface ClaimRow {
  email: string
  venmoHandle: string | null
  claimedAt: string | null
  emailConfirmedAt: string | null
}

/** The four things the claim flow asks of the database. All of them throw when the database cannot be reached. */
export interface ClaimStore {
  findByToken: (token: string) => Promise<ClaimRow | null>
  /** How many rows have claimed so far. */
  countClaimed: () => Promise<number>
  /** Set email_confirmed_at, only where it is still empty. */
  confirmEmail: (token: string, nowIso: string) => Promise<void>
  /**
   * ONE conditional write: set the username, its key and the time where the token matches AND nothing is claimed yet.
   * 'claimed' when a row changed; 'none' when no row matched (unknown token, or already claimed); 'duplicate_venmo' when another row
   * already holds that username's key.
   */
  claim: (token: string, handle: string, key: string, nowIso: string) => Promise<'claimed' | 'none' | 'duplicate_venmo'>
  /**
   * Put the welcome dollar in the rewards ledger: one 'welcome' row of 100 cents in sc_rewards for the member behind this token. A member
   * who already has one keeps that one (a unique index), so calling this twice adds nothing. Throws when the database cannot be reached.
   */
  recordWelcomeReward: (token: string, nowIso: string) => Promise<void>
}

export interface ClaimDeps {
  store: ClaimStore
  cap: number
  now?: () => Date
  /** Run a small write after the answer has gone out (the route passes Next's `after`). Left out, it runs straight away. */
  defer?: (work: () => Promise<void>) => void
}

export type ClaimView = { status: 'open' } | { status: 'claimed'; masked: string } | { status: 'cap_reached' } | { status: 'unknown' } | { status: 'error' }

const claimedView = (row: ClaimRow): ClaimView => ({ status: 'claimed', masked: maskVenmoHandle(row.venmoHandle ?? '') })

/**
 * What the claim page shows for a token. A known and an unknown token cost the same two reads (the row and the count, side by side), and
 * the one extra write for a known token (confirming the email) can be deferred until after the answer, so the two take the same time.
 * Opening the page counts as confirming the email address.
 */
export async function viewClaim(rawToken: unknown, deps: ClaimDeps): Promise<ClaimView> {
  const token = parseClaimToken(rawToken)
  if (!token) return { status: 'unknown' }
  try {
    const [row, claimed] = await Promise.all([deps.store.findByToken(token), deps.store.countClaimed()])
    if (!row) return { status: 'unknown' }
    if (!row.emailConfirmedAt) {
      const nowIso = (deps.now?.() ?? new Date()).toISOString()
      const confirm = () => deps.store.confirmEmail(token, nowIso).catch(() => console.error('[spare-change-claim] confirm failed'))
      if (deps.defer) deps.defer(confirm)
      else await confirm()
    }
    if (row.claimedAt) return claimedView(row)
    return claimed >= deps.cap ? { status: 'cap_reached' } : { status: 'open' }
  } catch {
    console.error('[spare-change-claim] view failed')
    return { status: 'error' }
  }
}

export type ClaimSubmit = { status: 'saved'; handle: string; email: string } | { status: 'invalid_venmo' } | { status: 'duplicate_venmo' } | Exclude<ClaimView, { status: 'open' }>

/**
 * Save a Venmo username against a token. Checks in order: the username is plausible; the token is one of ours; it is not claimed yet;
 * the round is not full. Then the single conditional write, which is what makes a double tap or a second tab harmless: only one of them
 * can change the row, and the one that loses is shown what the winner saved.
 *
 * The cap is "count, then write": two people claiming the last dollar in the same instant can both get through, so the round can end
 * above the cap by at most the number of claims in flight at that moment (each still needs its own emailed link and its own username).
 */
export async function submitClaim(body: unknown, deps: ClaimDeps): Promise<ClaimSubmit> {
  const b = (body && typeof body === 'object' ? body : {}) as { t?: unknown; venmo?: unknown }
  const token = parseClaimToken(b.t)
  if (!token) return { status: 'unknown' }
  const venmo = parseVenmoHandle(b.venmo)
  if (!venmo) return { status: 'invalid_venmo' }
  try {
    const [row, claimed] = await Promise.all([deps.store.findByToken(token), deps.store.countClaimed()])
    if (!row) return { status: 'unknown' }
    if (row.claimedAt) return claimedView(row) as ClaimSubmit
    if (claimed >= deps.cap) return { status: 'cap_reached' }
    const nowIso = (deps.now?.() ?? new Date()).toISOString()
    const outcome = await deps.store.claim(token, venmo.handle, venmo.key, nowIso)
    if (outcome === 'claimed') {
      // The claim is stored; the ledger row is the record that a dollar is now owed. If writing it fails the claim still stands (the
      // Friday runbook has a query that adds any welcome row that is missing), so the person is never told their claim failed.
      await deps.store.recordWelcomeReward(token, nowIso).catch(() => console.error('[spare-change-claim] welcome reward not recorded'))
      return { status: 'saved', handle: venmo.handle, email: row.email }
    }
    if (outcome === 'duplicate_venmo') return { status: 'duplicate_venmo' }
    const after = await deps.store.findByToken(token)
    return after?.claimedAt ? (claimedView(after) as ClaimSubmit) : { status: 'unknown' }
  } catch {
    console.error('[spare-change-claim] submit failed')
    return { status: 'error' }
  }
}
