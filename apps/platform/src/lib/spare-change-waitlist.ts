import { normalizeEmail } from './email-validation'
import { type WaitlistJoined } from './sneakers-waitlist'
import { newClaimToken } from './spare-change-claim'
import { newLinkToken } from './spare-change-core'
import { NEWSLETTER_MIN_AGE, NEWSLETTER_SOURCE, parseBirthday, parseName, parseReferrerName, parseState } from './spare-change'
import type { NewSubscriber } from './spare-change-slack'
import { getServerClient } from './supabase-server'
import { parseRefParam } from './waitlist-referral'

// One form, two lists. Someone who asks for the Spare Change Millionaire newsletter and is 18 or older gets a row in `newsletter_waitlist`
// AND a row on the Sneakers waitlist, with the same referral code and place in line as anyone else. Someone aged 13 to 17 joins the
// Sneakers waitlist only: no newsletter row is ever written for them, their name, birthday and state are dropped, and they get no welcome email.
// An adult signup that stored cleanly gets the welcome email with their claim link (at most one per 24 hours: see spare-change-email.ts).

export type SpareChangeSignup =
  | { ok: true; email: string; newsletter: true; name: string; age: number; birthDate: string; state: string; referredBy: string | null; referredByName: string | null }
  | { ok: true; email: string; newsletter: false; reason: 'under_18'; referredBy: string | null }
export type SpareChangeInvalid = { ok: false; error: 'invalid_email' | 'invalid_birthday' | 'invalid_name' | 'invalid_state' }

/** Pure check of a posted body: email, then birthday (the age is worked out from it, on `today`), then (18 and over only) name and state. Under 18 is a Sneakers-only signup. */
export function validateSpareChange(body: unknown, today?: string): SpareChangeSignup | SpareChangeInvalid {
  const b = (body && typeof body === 'object' ? body : {}) as { name?: unknown; email?: unknown; state?: unknown; birthday?: unknown; ref?: unknown; referrerName?: unknown }
  const email = normalizeEmail(b.email)
  if (!email) return { ok: false, error: 'invalid_email' }
  const born = parseBirthday(b.birthday, today)
  if (born === null) return { ok: false, error: 'invalid_birthday' }
  const { age, birthDate } = born
  const referredBy = parseRefParam(b.ref)
  if (age < NEWSLETTER_MIN_AGE) return { ok: true, email, newsletter: false, reason: 'under_18', referredBy }
  const name = parseName(b.name)
  if (!name) return { ok: false, error: 'invalid_name' }
  const state = parseState(b.state)
  if (!state) return { ok: false, error: 'invalid_state' }
  // Optional, and never a reason to refuse a signup: a name that is too long or not text is simply left off.
  return { ok: true, email, newsletter: true, name, age, birthDate, state, referredBy, referredByName: parseReferrerName(b.referrerName) }
}

export interface NewsletterRow {
  email: string
  name: string
  ageAtSignup: number
  /** Their birthday, YYYY-MM-DD. Stored only when the row is new, like the rest of the row. */
  birthDate: string
  state: string
  referredByCode: string | null
  /** Who they said referred them, as typed (a name, not a code). Kept for a person to match by hand; it credits nobody on its own. */
  referredByName: string | null
  /** A fresh token for the link in the welcome email. Stored only when the row is new: an email already on the list keeps its first one. */
  claimToken: string
  /** A fresh token for tracked links in the daily email (/go/<ticket>?m=<token>). Stored only when the row is new, like claimToken. */
  linkToken: string
  /** The newsletter member who referred them (their id in this same table), or null. Stored only when the row is new. */
  referredByMemberId: string | null
}

export interface SpareChangeDeps {
  addToSneakers: (i: { email: string; referrer: string | null; ipCountry: string | null; referredBy: string | null }) => Promise<WaitlistJoined | { ok: false }>
  /** 'new' when this signup wrote the row, 'existing' when the email was already on the list, false when the write failed. */
  upsertNewsletter: (row: NewsletterRow) => Promise<'new' | 'existing' | false>
  /**
   * The newsletter member behind a referral code: the code is on a Sneakers waitlist row, that row has an email, and that email may have
   * a newsletter row. null when any step finds nothing, or when it is this same person. Never throws.
   */
  resolveReferrer: (code: string, email: string) => Promise<string | null>
  /** Send the welcome email if one is due. 'sent' = one went now or in the last 24 hours; 'pending' = none has gone. */
  welcome: (email: string) => Promise<'sent' | 'pending'>
  /** Told about each NEW newsletter subscriber (Slack). Must not throw or wait on the network: the route sends it after answering. */
  onNewSubscriber?: (s: NewSubscriber) => void
}

/** One row per email. A second signup with the same address changes nothing: the first row (their name, state, birthday, age and claim token at that signup) stays. */
export async function upsertNewsletterRow(row: NewsletterRow): Promise<'new' | 'existing' | false> {
  try {
    const { data, error } = await getServerClient()
      .from('newsletter_waitlist')
      .upsert({ email: row.email, name: row.name, age_at_signup: row.ageAtSignup, birth_date: row.birthDate, state: row.state, source: NEWSLETTER_SOURCE, referred_by_code: row.referredByCode, referred_by_name: row.referredByName, claim_token: row.claimToken, link_token: row.linkToken, referred_by_member_id: row.referredByMemberId }, { onConflict: 'email', ignoreDuplicates: true })
      // A skipped duplicate comes back as no rows, so this also says whether the row is new.
      .select('id')
    if (error) {
      console.error('[spare-change-waitlist] upsert failed', error.code)
      return false
    }
    return (data?.length ?? 0) > 0 ? 'new' : 'existing'
  } catch {
    console.error('[spare-change-waitlist] upsert threw')
    return false
  }
}

/**
 * A referral code -> the newsletter member who owns it. Two small reads: the Sneakers waitlist row with that code (the same lookup
 * addToSneakersWaitlist makes), then the newsletter row with that row's email. The referrer has to be on the newsletter list themselves.
 */
export async function resolveReferrerMember(code: string, email: string): Promise<string | null> {
  try {
    const supabase = getServerClient()
    const { data: owner } = await supabase.from('waitlist').select('email').eq('referral_code', code).maybeSingle()
    const ownerEmail = typeof owner?.email === 'string' ? owner.email.trim().toLowerCase() : null
    if (!ownerEmail || ownerEmail === email) return null
    const { data: member } = await supabase.from('newsletter_waitlist').select('id').eq('email', ownerEmail).maybeSingle()
    return typeof member?.id === 'string' ? member.id : null
  } catch {
    return null
  }
}

export type SpareChangeJoined = { ok: true; existing: boolean; code: string | null } & ({ newsletter: true; welcome: 'sent' | 'pending' } | { newsletter: false; reason: 'under_18' })

/**
 * Store a checked signup. The newsletter row goes first: both writes are safe to repeat, and if the second one fails the person can try
 * again and still be "new" to the Sneakers waitlist (so they still get their own link). `existing` and `code` mean what they mean on the
 * Sneakers waitlist; `newsletter` says whether this person is on the newsletter list, and `reason` says why not (under 18).
 * The welcome email comes last, only once both rows are in, and can never fail the signup. `welcome` is the same for a first signup and
 * a repeat one inside 24 hours, so the saved screen does not show whether an address was already on the list.
 */
export async function joinSpareChange(signup: SpareChangeSignup, context: { referrer: string | null; ipCountry: string | null }, deps: SpareChangeDeps): Promise<SpareChangeJoined | { ok: false }> {
  if (signup.newsletter) {
    // Who referred them, as a newsletter member. Looking this up can never fail the signup: no answer just means no referrer on the row.
    const referredByMemberId = signup.referredBy ? await deps.resolveReferrer(signup.referredBy, signup.email).catch(() => null) : null
    const stored = await deps.upsertNewsletter({ email: signup.email, name: signup.name, ageAtSignup: signup.age, birthDate: signup.birthDate, state: signup.state, referredByCode: signup.referredBy, referredByName: signup.referredByName, claimToken: newClaimToken(), linkToken: newLinkToken(), referredByMemberId })
    if (!stored) return { ok: false }
    if (stored === 'new') {
      try {
        deps.onNewSubscriber?.({ name: signup.name, state: signup.state, age: signup.age, referredByMemberId, referredByName: signup.referredByName })
      } catch {
        // A notification can never fail a signup.
      }
    }
  }
  const joined = await deps.addToSneakers({ email: signup.email, referrer: context.referrer, ipCountry: context.ipCountry, referredBy: signup.referredBy })
  if (!joined.ok) return { ok: false }
  const base = { ok: true as const, existing: joined.existing, code: joined.code }
  if (!signup.newsletter) return { ...base, newsletter: false, reason: signup.reason }
  const welcome = await deps.welcome(signup.email).catch((): 'pending' => 'pending')
  return { ...base, newsletter: true, welcome }
}
