// "Spare Change Millionaire": the newsletter's name, its words and the pure checks for its signup form. Nothing here touches the
// database, so both the page (client) and the route (server) can use it, and it can be tested on its own.
// Wording rule for everything a person can read: "long-shot parlays", "buy-in" and "payout". No dollar promise: "rewards for subscribers at launch".
export const NEWSLETTER_NAME = 'Spare Change Millionaire'
export const NEWSLETTER_SOURCE = 'spare-change'
export const NEWSLETTER_PITCH = 'A daily email of long-shot parlays. A small buy-in, a big payout if it hits. 21+ only.'
export const NEWSLETTER_REWARDS = 'Coming soon, with rewards for subscribers at launch.'
export const NEWSLETTER_OPT_IN = `Also send me ${NEWSLETTER_NAME}, our daily long-shot parlay email. 21+ only.`
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

/** Only the literal `true` counts as "I'm 21 or older": not "true", not 1, not a missing field. */
export const confirmed21 = (raw: unknown): boolean => raw === true
