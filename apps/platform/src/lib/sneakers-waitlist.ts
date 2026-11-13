import { getServerClient } from './supabase-server'
import { generateUniqueReferralCode } from './referral-code'
import { pickAvatarDefaults } from './avatar-defaults'
import { rankPosition } from './waitlist-referral'

// The Sneakers P2P waitlist: rows in the shared `waitlist` table, told apart by `source`. The number shown on the page is the REAL count
// of those rows (no offset, no seed), and it is shown only once it is big enough to mean something.
export const SNEAKERS_WAITLIST_SOURCE = 'sneakers-p2p-landing'
export const MIN_PUBLIC_COUNT = 50

export async function getSneakersWaitlistCount(): Promise<number> {
  try {
    const { count, error } = await getServerClient().from('waitlist').select('*', { count: 'exact', head: true }).eq('source', SNEAKERS_WAITLIST_SOURCE)
    return error || count === null ? 0 : count
  } catch {
    return 0
  }
}

/** The count to print, or null while it is too small to print (never an invented number). */
export const publicCount = (real: number): number | null => (real >= MIN_PUBLIC_COUNT ? real : null)

export interface WaitlistJoined {
  ok: true
  existing: boolean
  /** Their own code, only for someone who just joined (never for an address that was already on the list: that would confirm who is on it). */
  code: string | null
}

/** One row per address. A valid `referredBy` (a code on another person's row) is stored on the new row; the database counts it for the referrer. */
export async function addToSneakersWaitlist(i: { email: string; referrer: string | null; ipCountry: string | null; referredBy: string | null }): Promise<WaitlistJoined | { ok: false }> {
  const supabase = getServerClient()
  // Only a code that exists, and that is not this same address, counts (no referring yourself).
  let referredByCode: string | null = null
  if (i.referredBy) {
    const { data: referrer } = await supabase.from('waitlist').select('email').eq('referral_code', i.referredBy).maybeSingle()
    if (referrer && referrer.email !== i.email) referredByCode = i.referredBy
  }
  const { emoji, color } = pickAvatarDefaults()
  const code = await generateUniqueReferralCode()
  const { error } = await supabase.from('waitlist').insert({
    email: i.email,
    source: SNEAKERS_WAITLIST_SOURCE,
    referrer: i.referrer,
    ip_country: i.ipCountry,
    referral_code: code,
    referred_by_code: referredByCode,
    account_type: 'individual',
    avatar_emoji: emoji,
    avatar_color: color,
  })
  if (error?.code === '23505') return { ok: true, existing: true, code: null }
  if (error) {
    console.error('[sneakers-waitlist] insert failed', error.code)
    return { ok: false }
  }
  return { ok: true, existing: false, code }
}

/** Your real numbers: friends who joined with your link, and your place in line (more friends first, then who joined earlier). null for an unknown code. */
export async function waitlistStanding(code: string): Promise<{ referrals: number; position: number } | null> {
  try {
    const supabase = getServerClient()
    const { data: mine } = await supabase.from('waitlist').select('direct_referrals, created_at').eq('referral_code', code).eq('source', SNEAKERS_WAITLIST_SOURCE).maybeSingle()
    if (!mine) return null
    const referrals = Number(mine.direct_referrals ?? 0)
    const head = { count: 'exact' as const, head: true }
    const [more, same] = await Promise.all([
      supabase.from('waitlist').select('*', head).eq('source', SNEAKERS_WAITLIST_SOURCE).gt('direct_referrals', referrals),
      supabase.from('waitlist').select('*', head).eq('source', SNEAKERS_WAITLIST_SOURCE).eq('direct_referrals', referrals).lt('created_at', mine.created_at),
    ])
    return { referrals, position: rankPosition({ withMoreReferrals: more.count ?? 0, withSameReferralsEarlier: same.count ?? 0 }) }
  } catch {
    return null
  }
}
