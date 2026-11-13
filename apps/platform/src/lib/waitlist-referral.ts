import { isValidReferralCodeFormat } from './referral-code'

// Referrals on the Sneakers waitlist. A code is the six characters already on every waitlist row; a link is the launching-soon page with
// `?ref=`. The page shows the real number of friends who joined with your link and your real place in line: people with more friends who
// joined come first, then people who joined earlier. Nothing here is estimated or invented.
export const referralLink = (origin: string, code: string): string => `${origin.replace(/\/+$/, '')}/launching-soon?ref=${code}`

export const referralShareText = (link: string): string => `I'm on the waitlist for Sneakers, the fun way to split payments with friends. Join with my link: ${link}`

/** The code in `?ref=`, upper-cased, or null when it is not exactly a code. */
export function parseRefParam(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return isValidReferralCodeFormat(code) ? code : null
}

/** Your place: one behind everyone with more friends joined, and everyone with the same who joined before you. */
export const rankPosition = (i: { withMoreReferrals: number; withSameReferralsEarlier: number }): number => 1 + i.withMoreReferrals + i.withSameReferralsEarlier
