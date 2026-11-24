// "Spare Change Millionaire": the newsletter's name, its words and the pure checks for its signup form. Nothing here touches the
// database, so both the page (client) and the route (server) can use it, and it can be tested on its own.
// Wording rule for everything a person can read: "long-shot parlays", "buy-in", "payout" and "free dollar". The only amount promised
// anywhere are: the one welcome dollar (saved screen, welcome email, claim page), the free $0.25 a day for subscribers, and $5 for each
// referred friend once that friend is verified (up to 5 friends). Those three numbers live here and nowhere else.
import { normalizeEmail } from './email-validation'

export const NEWSLETTER_NAME = 'Spare Change Millionaire'
export const NEWSLETTER_SOURCE = 'spare-change'
export const NEWSLETTER_PITCH = 'A daily email of long-shot parlays. A small buy-in, a big payout if it hits. 18+ only.'
export const NEWSLETTER_REWARDS = 'Subscribers get a free $0.25 a day.'
// The referral offer, as the page states it. The condition ("once your friend is verified") is part of every line that names the $5.
export const REFERRAL_OFFER_HEADING = 'Refer a friend, get $5'
export const REFERRAL_OFFER_STEPS = ['Subscribe, and you get your own link.', 'Text or email it to a friend.', 'We pay you $5 once your friend is verified.'] as const
export const REFERRAL_OFFER_TERMS = 'Up to 5 friends. A friend counts once they have subscribed with your link and been verified. Terms apply.'
export const REFERRAL_SHARE_LINE = 'Get $5 for each friend who joins with your link, once they are verified.'
export const NEWSLETTER_OPT_IN = `Also send me ${NEWSLETTER_NAME}, our daily long-shot parlay email. 18+ only.`
export const NEWSLETTER_UNDER_18 = `${NEWSLETTER_NAME} is 18+ only, so we left you off that list.`
export const SNEAKERS_LINE = "You're also first in line for Sneakers."
export const EXAMPLE_TICKET = { buyIn: '$0.25', payout: '$80,000' } as const

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

/**
 * An optional US phone number -> "+1" and ten digits. Blank (or missing) is fine: { ok: true, phone: null }. Anything else that isn't a US
 * number (ten digits, or eleven starting with 1, any punctuation; the area code and exchange can't start with 0 or 1) is { ok: false }.
 */
export function parsePhone(raw: unknown): { ok: true; phone: string | null } | { ok: false } {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, phone: null }
  if (typeof raw !== 'string' || !/^[\d\s()+.-]{7,20}$/.test(raw.trim())) return { ok: false }
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? { ok: true, phone: `+1${digits}` } : { ok: false }
}

/** The name of whoever told them about the newsletter, as typed: optional, trimmed, up to 80 characters. '' or anything else -> null. */
export function parseReferrerName(raw: unknown): string | null {
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

/** Today's date in US Eastern time as YYYY-MM-DD: the day a person's age is counted on. */
export function todayEastern(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * A birthday as YYYY-MM-DD (what a date box sends) -> that date and the person's age on `today`. null when it is not a real calendar
 * date, or when the age it gives is outside 13 to 120 (a typing mistake, like parseAge). The age is worked out here, never typed.
 */
export function parseBirthday(raw: unknown, today: string = todayEastern()): { birthDate: string; age: number } | null {
  if (typeof raw !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  const [ty, tm, td] = today.split('-').map(Number)
  const age = ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0)
  return age >= AGE_FLOOR && age <= AGE_CEILING ? { birthDate: m[0], age } : null
}

// Referrals: each person is credited for at most 5 friends who join with their link. What a credited friend is worth is not decided.
export const MAX_CREDITED_REFERRALS = 5
export const REFERRAL_CAP_NOTE = `Up to ${MAX_CREDITED_REFERRALS} friends count.`

/** How many of a person's friends count: the real number, never below 0 and never above the cap. */
export const creditedReferrals = (n: number): number => Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 0, 0), MAX_CREDITED_REFERRALS)

/** "3 of 5 friends joined." with the credited number. */
export const friendsJoinedText = (referrals: number): string => `${creditedReferrals(referrals)} of ${MAX_CREDITED_REFERRALS} friends joined.`

// What the form says about each field before anything is sent: the same checks the route makes, all at once. Someone whose birthday makes them
// 13 to 17 needs only an email, because that person joins the Sneakers waitlist only. Keys come out in the order the fields sit on the page.
// The phone and the two boxes are checked only by a form that has them (the /spare-change and /waitlist page): the subscribe box and the
// Terms box must be ticked there, and a phone, when one is typed, must be a US number. The Terms apply under 18 too; the subscribe box doesn't.
export type SignupField = 'name' | 'email' | 'phone' | 'state' | 'birthday' | 'subscribe' | 'terms'
export const SIGNUP_FIELD_PROBLEM: Record<SignupField, string> = {
  name: 'Add your name.',
  email: 'That email does not look right.',
  phone: 'That phone number does not look right.',
  state: 'Pick your state.',
  birthday: 'Add your birthday.',
  subscribe: 'Tick this to get the email.',
  terms: 'Agree to the Terms to join.',
}
export function signupProblems(
  v: { name: string; email: string; state: string; birthday: string; phone?: string; subscribe?: boolean; terms?: boolean },
  today: string = todayEastern(),
): Partial<Record<SignupField, string>> {
  const age = parseBirthday(v.birthday, today)?.age ?? null
  const adult = age === null || age >= NEWSLETTER_MIN_AGE
  const bad: SignupField[] = []
  if (adult && !parseName(v.name)) bad.push('name')
  if (!normalizeEmail(v.email)) bad.push('email')
  if (adult && v.phone !== undefined && !parsePhone(v.phone).ok) bad.push('phone')
  if (adult && !parseState(v.state)) bad.push('state')
  if (age === null) bad.push('birthday')
  if (adult && v.subscribe === false) bad.push('subscribe')
  if (v.terms === false) bad.push('terms')
  return Object.fromEntries(bad.map((f) => [f, SIGNUP_FIELD_PROBLEM[f]]))
}

/**
 * The first name to greet someone by, or null when what they typed is not plainly a name. Letters in any alphabet, apostrophes, hyphens
 * and dots, up to 30 characters: so a link or markup typed into the name box is never echoed in a heading or an email.
 */
export function greetingName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const first = raw.trim().split(/\s+/)[0] ?? ''
  return /^\p{L}[\p{L}\p{M}'’.-]{0,29}$/u.test(first) ? first : null
}

// The screen after a newsletter signup. It says "check your email" only when a welcome email really went out (now, or within the last day).
export const SAVED_STEPS = ['Open the welcome email.', 'Tap "Claim your free dollar" and add your Venmo username.', 'We send your dollar on Friday.'] as const
export function savedScreenCopy(i: { name: unknown; emailSent: boolean }): { heading: string; body: string; steps: string[] } {
  const first = greetingName(i.name)
  return {
    heading: first ? `You're in, ${first}.` : "You're in.",
    body: i.emailSent ? "We saved your spot. Check your email: there's a link to claim your free dollar." : 'We saved your spot. Your welcome email is on its way shortly.',
    steps: [...SAVED_STEPS],
  }
}
