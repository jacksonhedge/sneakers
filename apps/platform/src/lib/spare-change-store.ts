import { sendSpareChangeWelcome } from './email'
import { addToSneakersWaitlist, waitlistStanding, SNEAKERS_WAITLIST_SOURCE } from './sneakers-waitlist'
import { claimCap, claimOrigin, type ClaimDeps, type ClaimStore } from './spare-change-claim'
import { sendWelcomeOnce, type WelcomeStore } from './spare-change-email'
import { WELCOME_REWARD_CENTS } from './spare-change-core'
import { resolveReferrerMember, upsertNewsletterRow, type SpareChangeDeps } from './spare-change-waitlist'
import { after } from 'next/server'
import { notifyNewSubscriber } from './spare-change-slack'
import { getServerClient } from './supabase-server'

// The Supabase side of the Spare Change welcome email and the claim page: the small reads and writes that spare-change-email.ts and
// spare-change-claim.ts are handed. Server only (service role). Every function is one statement against `newsletter_waitlist`.
// Nothing here logs an email address, a token or a Venmo username.
const table = () => getServerClient().from('newsletter_waitlist')

const welcomeStore: WelcomeStore = {
  async read(email) {
    const { data, error } = await table().select('name, claim_token, welcome_sent_at').eq('email', email).maybeSingle()
    if (error) throw new Error(`read ${error.code}`)
    return data ? { name: data.name, claimToken: data.claim_token, welcomeSentAt: data.welcome_sent_at } : null
  },
  // Compare and swap on welcome_sent_at: only the request that still sees the old value gets to send.
  async reserve(email, previous, nowIso) {
    const q = table().update({ welcome_sent_at: nowIso }).eq('email', email)
    const { data, error } = await (previous === null ? q.is('welcome_sent_at', null) : q.eq('welcome_sent_at', previous)).select('id')
    if (error) throw new Error(`reserve ${error.code}`)
    return (data?.length ?? 0) === 1
  },
  async release(email, reservedIso, previous) {
    const { error } = await table().update({ welcome_sent_at: previous }).eq('email', email).eq('welcome_sent_at', reservedIso)
    if (error) console.error('[spare-change-store] release failed', error.code)
  },
}

/** What the signup route hands joinSpareChange: the two list writes, and the welcome email with a link built for this request. */
export function spareChangeDeps(requestOrigin: string | null): SpareChangeDeps {
  return {
    addToSneakers: addToSneakersWaitlist,
    upsertNewsletter: upsertNewsletterRow,
    resolveReferrer: resolveReferrerMember,
    // After the signup has answered, so Slack never slows it down.
    onNewSubscriber: (sub) => after(() => notifyNewSubscriber(sub)),
    welcome: (email) =>
      sendWelcomeOnce(email, {
        store: welcomeStore,
        send: sendSpareChangeWelcome,
        configured: Boolean(process.env.RESEND_API_KEY),
        origin: claimOrigin({ siteUrl: process.env.NEXT_PUBLIC_SITE_URL, requestOrigin }),
        postalAddress: process.env.SPARE_CHANGE_POSTAL_ADDRESS,
      }),
  }
}

const claimStore: ClaimStore = {
  async findByToken(token) {
    const { data, error } = await table().select('email, venmo_handle, claimed_at, email_confirmed_at').eq('claim_token', token).maybeSingle()
    if (error) throw new Error(`find ${error.code}`)
    return data ? { email: data.email, venmoHandle: data.venmo_handle, claimedAt: data.claimed_at, emailConfirmedAt: data.email_confirmed_at } : null
  },
  async countClaimed() {
    const { count, error } = await table().select('id', { count: 'exact', head: true }).not('claimed_at', 'is', null)
    if (error || count === null) throw new Error(`count ${error?.code ?? 'null'}`)
    return count
  },
  async confirmEmail(token, nowIso) {
    const { error } = await table().update({ email_confirmed_at: nowIso }).eq('claim_token', token).is('email_confirmed_at', null)
    if (error) throw new Error(`confirm ${error.code}`)
  },
  // The one conditional write. `claimed_at is null` in the WHERE is what lets only one of two taps (or two tabs) change the row; the
  // unique index on venmo_handle_key is what refuses a username someone else already used (Postgres error 23505).
  async claim(token, handle, key, nowIso) {
    const { data, error } = await table().update({ venmo_handle: handle, venmo_handle_key: key, claimed_at: nowIso }).eq('claim_token', token).is('claimed_at', null).select('id')
    if (error?.code === '23505') return 'duplicate_venmo'
    if (error) throw new Error(`claim ${error.code}`)
    return (data?.length ?? 0) === 1 ? 'claimed' : 'none'
  },
  // The welcome dollar in the rewards ledger (sc_rewards, migration 049). The partial unique index allows one 'welcome' row per member,
  // so a claim that is cleared and made again (a corrected username) does not add a second dollar: that insert is refused (23505) and ignored.
  async recordWelcomeReward(token, nowIso) {
    const { data: member, error: findError } = await table().select('id').eq('claim_token', token).maybeSingle()
    if (findError || !member) throw new Error(`welcome member ${findError?.code ?? 'missing'}`)
    const { error } = await getServerClient().from('sc_rewards').insert({ member_id: member.id, kind: 'welcome', amount_cents: WELCOME_REWARD_CENTS, note: 'Welcome dollar', earned_at: nowIso })
    if (error && error.code !== '23505') throw new Error(`welcome reward ${error.code}`)
  },
}

export const claimDeps = (defer?: ClaimDeps['defer']): ClaimDeps => ({ store: claimStore, cap: claimCap(process.env.SPARE_CHANGE_CLAIM_CAP), defer })

/**
 * The share block for the person who just claimed: their own Sneakers waitlist code and standing, looked up by the email on their
 * newsletter row. Safe to hand back here (and only here) because holding the claim link already proves the address is theirs.
 * null when anything is missing; the page then shows a plain link back instead.
 */
export async function shareForEmail(email: string): Promise<{ code: string; referrals: number; position: number | null } | null> {
  try {
    const { data } = await getServerClient().from('waitlist').select('referral_code').eq('email', email).eq('source', SNEAKERS_WAITLIST_SOURCE).maybeSingle()
    const code = typeof data?.referral_code === 'string' ? data.referral_code : null
    if (!code) return null
    const standing = await waitlistStanding(code)
    return { code, referrals: standing?.referrals ?? 0, position: standing?.position ?? null }
  } catch {
    return null
  }
}
