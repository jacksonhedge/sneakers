import { normalizeEmail } from './email-validation'
import { addToSneakersWaitlist, type WaitlistJoined } from './sneakers-waitlist'
import { NEWSLETTER_MIN_AGE, NEWSLETTER_SOURCE, parseAge, parseName, parseState } from './spare-change'
import { getServerClient } from './supabase-server'
import { parseRefParam } from './waitlist-referral'

// One form, two lists. Someone who asks for the Spare Change Millionaire newsletter and is 18 or older gets a row in `newsletter_waitlist`
// AND a row on the Sneakers waitlist, with the same referral code and place in line as anyone else. Someone aged 13 to 17 joins the
// Sneakers waitlist only: no newsletter row is ever written for them, and their name, age and state are dropped. Nothing here sends an email.

export type SpareChangeSignup =
  | { ok: true; email: string; newsletter: true; name: string; age: number; state: string; referredBy: string | null }
  | { ok: true; email: string; newsletter: false; reason: 'under_18'; referredBy: string | null }
export type SpareChangeInvalid = { ok: false; error: 'invalid_email' | 'invalid_age' | 'invalid_name' | 'invalid_state' }

/** Pure check of a posted body: email, then age, then (18 and over only) name and state. Under 18 is a Sneakers-only signup. */
export function validateSpareChange(body: unknown): SpareChangeSignup | SpareChangeInvalid {
  const b = (body && typeof body === 'object' ? body : {}) as { name?: unknown; email?: unknown; state?: unknown; age?: unknown; ref?: unknown }
  const email = normalizeEmail(b.email)
  if (!email) return { ok: false, error: 'invalid_email' }
  const age = parseAge(b.age)
  if (age === null) return { ok: false, error: 'invalid_age' }
  const referredBy = parseRefParam(b.ref)
  if (age < NEWSLETTER_MIN_AGE) return { ok: true, email, newsletter: false, reason: 'under_18', referredBy }
  const name = parseName(b.name)
  if (!name) return { ok: false, error: 'invalid_name' }
  const state = parseState(b.state)
  if (!state) return { ok: false, error: 'invalid_state' }
  return { ok: true, email, newsletter: true, name, age, state, referredBy }
}

export interface NewsletterRow {
  email: string
  name: string
  ageAtSignup: number
  state: string
  referredByCode: string | null
}

export interface SpareChangeDeps {
  addToSneakers: (i: { email: string; referrer: string | null; ipCountry: string | null; referredBy: string | null }) => Promise<WaitlistJoined | { ok: false }>
  upsertNewsletter: (row: NewsletterRow) => Promise<boolean>
}

/** One row per email. A second signup with the same address changes nothing: the first row (their name, state and age at that signup) stays. */
export async function upsertNewsletterRow(row: NewsletterRow): Promise<boolean> {
  try {
    const { error } = await getServerClient()
      .from('newsletter_waitlist')
      .upsert({ email: row.email, name: row.name, age_at_signup: row.ageAtSignup, state: row.state, source: NEWSLETTER_SOURCE, referred_by_code: row.referredByCode }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) console.error('[spare-change-waitlist] upsert failed', error.code)
    return !error
  } catch {
    console.error('[spare-change-waitlist] upsert threw')
    return false
  }
}

const realDeps: SpareChangeDeps = { addToSneakers: addToSneakersWaitlist, upsertNewsletter: upsertNewsletterRow }

export type SpareChangeJoined = { ok: true; existing: boolean; code: string | null } & ({ newsletter: true } | { newsletter: false; reason: 'under_18' })

/**
 * Store a checked signup. The newsletter row goes first: both writes are safe to repeat, and if the second one fails the person can try
 * again and still be "new" to the Sneakers waitlist (so they still get their own link). `existing` and `code` mean what they mean on the
 * Sneakers waitlist; `newsletter` says whether this person is on the newsletter list, and `reason` says why not (under 18).
 */
export async function joinSpareChange(signup: SpareChangeSignup, context: { referrer: string | null; ipCountry: string | null }, deps: SpareChangeDeps = realDeps): Promise<SpareChangeJoined | { ok: false }> {
  if (signup.newsletter) {
    const stored = await deps.upsertNewsletter({ email: signup.email, name: signup.name, ageAtSignup: signup.age, state: signup.state, referredByCode: signup.referredBy })
    if (!stored) return { ok: false }
  }
  const joined = await deps.addToSneakers({ email: signup.email, referrer: context.referrer, ipCountry: context.ipCountry, referredBy: signup.referredBy })
  if (!joined.ok) return { ok: false }
  const base = { ok: true as const, existing: joined.existing, code: joined.code }
  return signup.newsletter ? { ...base, newsletter: true } : { ...base, newsletter: false, reason: signup.reason }
}
