import { normalizeEmail } from './email-validation'
import { addToSneakersWaitlist, type WaitlistJoined } from './sneakers-waitlist'
import { NEWSLETTER_SOURCE, confirmed21, parseState } from './spare-change'
import { getServerClient } from './supabase-server'
import { parseRefParam } from './waitlist-referral'

// One form, two lists. Someone who asks for the Spare Change Millionaire newsletter (and ticks 21+) gets a row in `newsletter_waitlist`
// AND a row on the Sneakers waitlist, with the same referral code and place in line as anyone else. Someone who does not tick 21+ joins
// the Sneakers waitlist only: no newsletter row is ever written for them. Nothing here sends an email.

export type SpareChangeSignup =
  | { ok: true; email: string; newsletter: true; state: string; referredBy: string | null }
  | { ok: true; email: string; newsletter: false; state: null; referredBy: string | null }
export type SpareChangeInvalid = { ok: false; error: 'invalid_email' | 'invalid_state' }

/** Pure check of a posted body. Without the 21+ box it is a Sneakers-only signup and the state is dropped (never stored). */
export function validateSpareChange(body: unknown): SpareChangeSignup | SpareChangeInvalid {
  const b = (body && typeof body === 'object' ? body : {}) as { email?: unknown; state?: unknown; confirmed21?: unknown; ref?: unknown }
  const email = normalizeEmail(b.email)
  if (!email) return { ok: false, error: 'invalid_email' }
  const referredBy = parseRefParam(b.ref)
  if (!confirmed21(b.confirmed21)) return { ok: true, email, newsletter: false, state: null, referredBy }
  const state = parseState(b.state)
  if (!state) return { ok: false, error: 'invalid_state' }
  return { ok: true, email, newsletter: true, state, referredBy }
}

export interface NewsletterRow {
  email: string
  state: string
  confirmed21At: string
  referredByCode: string | null
}

export interface SpareChangeDeps {
  addToSneakers: (i: { email: string; referrer: string | null; ipCountry: string | null; referredBy: string | null }) => Promise<WaitlistJoined | { ok: false }>
  upsertNewsletter: (row: NewsletterRow) => Promise<boolean>
  now: () => Date
}

/** One row per email. A second signup with the same address changes nothing: the first row (and the time they first confirmed 21+) stays. */
export async function upsertNewsletterRow(row: NewsletterRow): Promise<boolean> {
  try {
    const { error } = await getServerClient()
      .from('newsletter_waitlist')
      .upsert({ email: row.email, state: row.state, confirmed_21_at: row.confirmed21At, source: NEWSLETTER_SOURCE, referred_by_code: row.referredByCode }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) console.error('[spare-change-waitlist] upsert failed', error.code)
    return !error
  } catch {
    console.error('[spare-change-waitlist] upsert threw')
    return false
  }
}

const realDeps: SpareChangeDeps = { addToSneakers: addToSneakersWaitlist, upsertNewsletter: upsertNewsletterRow, now: () => new Date() }

export type SpareChangeJoined = { ok: true; existing: boolean; code: string | null; newsletter: boolean }

/**
 * Store a checked signup. The newsletter row goes first: both writes are safe to repeat, and if the second one fails the person can try
 * again and still be "new" to the Sneakers waitlist (so they still get their own link). `existing` and `code` mean what they mean on the
 * Sneakers waitlist; `newsletter` says whether this person is on the newsletter list.
 */
export async function joinSpareChange(signup: SpareChangeSignup, context: { referrer: string | null; ipCountry: string | null }, deps: SpareChangeDeps = realDeps): Promise<SpareChangeJoined | { ok: false }> {
  if (signup.newsletter) {
    const stored = await deps.upsertNewsletter({ email: signup.email, state: signup.state, confirmed21At: deps.now().toISOString(), referredByCode: signup.referredBy })
    if (!stored) return { ok: false }
  }
  const joined = await deps.addToSneakers({ email: signup.email, referrer: context.referrer, ipCountry: context.ipCountry, referredBy: signup.referredBy })
  if (!joined.ok) return { ok: false }
  return { ok: true, existing: joined.existing, code: joined.code, newsletter: signup.newsletter }
}
