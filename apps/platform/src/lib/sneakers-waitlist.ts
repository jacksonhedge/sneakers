import { getServerClient } from './supabase-server'
import { generateUniqueReferralCode } from './referral-code'
import { pickAvatarDefaults } from './avatar-defaults'

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

/** One row per address. `existing` when the address was already on the list. */
export async function addToSneakersWaitlist(i: { email: string; referrer: string | null; ipCountry: string | null }): Promise<{ ok: true; existing: boolean } | { ok: false }> {
  const { emoji, color } = pickAvatarDefaults()
  const { error } = await getServerClient().from('waitlist').insert({
    email: i.email,
    source: SNEAKERS_WAITLIST_SOURCE,
    referrer: i.referrer,
    ip_country: i.ipCountry,
    referral_code: await generateUniqueReferralCode(),
    account_type: 'individual',
    avatar_emoji: emoji,
    avatar_color: color,
  })
  if (error?.code === '23505') return { ok: true, existing: true }
  if (error) {
    console.error('[sneakers-waitlist] insert failed', error.code)
    return { ok: false }
  }
  return { ok: true, existing: false }
}
