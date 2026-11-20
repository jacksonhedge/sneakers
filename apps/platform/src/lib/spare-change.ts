// "Spare Change Millionaire": the newsletter's name, its words and the pure checks for its signup form. Nothing here touches the
// database, so both the page (client) and the route (server) can use it, and it can be tested on its own.
// Wording rule for everything a person can read: "long-shot parlays", "buy-in" and "payout". No dollar promise: "rewards for subscribers at launch".
// The reward terms are not final, so nothing here names an amount or says what a referral earns: only that up to 5 friends count.
export const NEWSLETTER_NAME = 'Spare Change Millionaire'
export const NEWSLETTER_SOURCE = 'spare-change'
export const NEWSLETTER_PITCH = 'A daily email of long-shot parlays. A small buy-in, a big payout if it hits. 18+ only.'
export const NEWSLETTER_REWARDS = 'Coming soon, with rewards for subscribers at launch.'
export const NEWSLETTER_OPT_IN = `Also send me ${NEWSLETTER_NAME}, our daily long-shot parlay email. 18+ only.`
export const NEWSLETTER_UNDER_18 = `${NEWSLETTER_NAME} is 18+ only, so we left you off that list.`
export const SNEAKERS_LINE = "You're also first in line for Sneakers."
export const EXAMPLE_TICKET = { buyIn: '$1.00', payout: '$1,800' } as const

// The 50 states and DC. Any of them can join the waitlist; who gets which tickets is decided when an issue is sent.
export const US_STATES: ReadonlyArray<readonly [code: string, name: string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
  ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'],
  ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
]
const STATE_CODES = new Set(US_STATES.map(([code]) => code))

/** A two-letter US state code (or DC), upper-cased, or null when it is not one. */
export function parseState(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return STATE_CODES.has(code) ? code : null
}

/** A person's name for the newsletter: trimmed, 1 to 80 characters, otherwise kept as typed. null when it is not one. */
export const NAME_MAX_LENGTH = 80
export function parseName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  return name.length >= 1 && name.length <= NAME_MAX_LENGTH ? name : null
}

// The newsletter is 18+. An age from 13 to 17 is a real answer (that person joins the Sneakers waitlist only); anything outside 13 to 120,
// or anything that is not a whole number, is a typing mistake and is refused.
export const NEWSLETTER_MIN_AGE = 18
const AGE_FLOOR = 13
const AGE_CEILING = 120

/** The age a person typed, as a whole number from 13 to 120, or null. Digits only: no decimals, signs, exponents or words. */
export function parseAge(raw: unknown): number | null {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d{1,3}$/.test(text)) return null
  const age = Number(text)
  return age >= AGE_FLOOR && age <= AGE_CEILING ? age : null
}

// Referrals: each person is credited for at most 5 friends who join with their link. What a credited friend is worth is not decided.
export const MAX_CREDITED_REFERRALS = 5
export const REFERRAL_CAP_NOTE = `Up to ${MAX_CREDITED_REFERRALS} friends count.`

/** How many of a person's friends count: the real number, never below 0 and never above the cap. */
export const creditedReferrals = (n: number): number => Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 0, 0), MAX_CREDITED_REFERRALS)

/** "3 of 5 friends joined." with the credited number. */
export const friendsJoinedText = (referrals: number): string => `${creditedReferrals(referrals)} of ${MAX_CREDITED_REFERRALS} friends joined.`
