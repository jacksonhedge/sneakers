import { describe, expect, it, vi } from 'vitest'
import {
  MAX_CREDITED_REFERRALS,
  NEWSLETTER_MIN_AGE,
  NEWSLETTER_NAME,
  NEWSLETTER_OPT_IN,
  NEWSLETTER_PITCH,
  NEWSLETTER_REWARDS,
  NEWSLETTER_UNDER_18,
  REFERRAL_CAP_NOTE,
  SNEAKERS_LINE,
  US_STATES,
  creditedReferrals,
  friendsJoinedText,
  parseAge,
  parseName,
  parseState,
  greetingName,
  savedScreenCopy,
  signupProblems,
} from './spare-change'
import { joinSpareChange, validateSpareChange, type SpareChangeDeps } from './spare-change-waitlist'

describe('the state field', () => {
  it('lists the 50 states and DC, each once', () => {
    expect(US_STATES).toHaveLength(51)
    expect(new Set(US_STATES.map(([code]) => code)).size).toBe(51)
    expect(US_STATES.map(([code]) => code)).toContain('DC')
  })
  it('accepts a two-letter code in either case, with stray spaces', () => {
    expect(parseState('pa')).toBe('PA')
    expect(parseState(' DC ')).toBe('DC')
  })
  it('refuses anything that is not a US state code', () => {
    for (const bad of [undefined, null, '', 'P', 'PAA', 'XX', 'PR', 'Pennsylvania', 42, ['PA'], "PA';"]) {
      expect(parseState(bad), String(bad)).toBeNull()
    }
  })
})

describe('the name field', () => {
  it('trims and keeps a name as given', () => {
    expect(parseName('  Sam O\'Neil-García ')).toBe('Sam O\'Neil-García')
    expect(parseName('x')).toBe('x')
    expect(parseName('a'.repeat(80))).toBe('a'.repeat(80))
  })
  it('refuses an empty, too long or non-text name', () => {
    for (const bad of [undefined, null, '', '   ', 'a'.repeat(81), 42, ['Sam'], {}]) expect(parseName(bad), String(bad)).toBeNull()
  })
})

describe('the age field', () => {
  it('takes a whole number, typed or as a number', () => {
    expect(parseAge('18')).toBe(18)
    expect(parseAge(' 21 ')).toBe(21)
    expect(parseAge(13)).toBe(13)
    expect(parseAge('120')).toBe(120)
  })
  it('refuses non-numbers and anything outside 13 to 120', () => {
    for (const bad of [undefined, null, '', ' ', 'abc', '18.5', 18.5, '1e2', '-18', '+18', '0x12', '18 years', 12, '12', 0, 121, '121', '999', NaN, Infinity, true, ['18'], {}]) {
      expect(parseAge(bad), String(bad)).toBeNull()
    }
  })
  it('the newsletter starts at 18', () => {
    expect(NEWSLETTER_MIN_AGE).toBe(18)
  })
})

describe('the referral cap', () => {
  it('credits at most 5 friends, and never fewer than 0', () => {
    expect(MAX_CREDITED_REFERRALS).toBe(5)
    expect(creditedReferrals(0)).toBe(0)
    expect(creditedReferrals(3)).toBe(3)
    expect(creditedReferrals(5)).toBe(5)
    expect(creditedReferrals(6)).toBe(5)
    expect(creditedReferrals(400)).toBe(5)
    expect(creditedReferrals(-2)).toBe(0)
  })
  it('says "N of 5 friends joined" with the credited number', () => {
    expect(friendsJoinedText(0)).toBe('0 of 5 friends joined.')
    expect(friendsJoinedText(1)).toBe('1 of 5 friends joined.')
    expect(friendsJoinedText(12)).toBe('5 of 5 friends joined.')
  })
})

const good = { name: ' Sam Lee ', email: ' Sam@School.edu ', state: 'nj', age: '19', ref: 'k7m3qx' }

describe('checking a signup before anything is stored', () => {
  it('normalizes a good one', () => {
    expect(validateSpareChange(good)).toEqual({ ok: true, email: 'sam@school.edu', newsletter: true, name: 'Sam Lee', age: 19, state: 'NJ', referredBy: 'K7M3QX' })
    expect(validateSpareChange({ ...good, age: 18 })).toMatchObject({ ok: true, newsletter: true, age: 18 })
  })
  it('refuses a bad email first', () => {
    expect(validateSpareChange({ ...good, email: 'nope' })).toEqual({ ok: false, error: 'invalid_email' })
    expect(validateSpareChange(null)).toEqual({ ok: false, error: 'invalid_email' })
  })
  it('refuses a missing, non-numeric or out-of-range age', () => {
    for (const age of [undefined, '', 'abc', '18.5', 12, 121]) expect(validateSpareChange({ ...good, age }), String(age)).toEqual({ ok: false, error: 'invalid_age' })
  })
  it('refuses an adult signup with no name or one that is too long', () => {
    expect(validateSpareChange({ ...good, name: '  ' })).toEqual({ ok: false, error: 'invalid_name' })
    expect(validateSpareChange({ ...good, name: undefined })).toEqual({ ok: false, error: 'invalid_name' })
    expect(validateSpareChange({ ...good, name: 'a'.repeat(81) })).toEqual({ ok: false, error: 'invalid_name' })
  })
  it('refuses an adult signup with no state or a made-up one', () => {
    expect(validateSpareChange({ ...good, state: undefined })).toEqual({ ok: false, error: 'invalid_state' })
    expect(validateSpareChange({ ...good, state: 'ZZ' })).toEqual({ ok: false, error: 'invalid_state' })
  })
  it('under 18 (13 to 17) is a Sneakers-only signup: the name, age and state are dropped', () => {
    for (const age of [13, '17']) {
      expect(validateSpareChange({ ...good, age, ref: undefined }), String(age)).toEqual({ ok: true, email: 'sam@school.edu', newsletter: false, reason: 'under_18', referredBy: null })
    }
    expect(validateSpareChange({ email: 'sam@school.edu', age: 16 })).toMatchObject({ ok: true, newsletter: false, reason: 'under_18' })
  })
  it('the old 21+ box means nothing any more', () => {
    expect(validateSpareChange({ email: 'sam@school.edu', state: 'NJ', confirmed21: true })).toEqual({ ok: false, error: 'invalid_age' })
  })
  it('drops a ref that is not a code', () => {
    expect(validateSpareChange({ ...good, ref: "x';--" })).toMatchObject({ ok: true, referredBy: null })
  })
})

function fakes(over: Partial<SpareChangeDeps> = {}) {
  const deps = {
    addToSneakers: vi.fn<SpareChangeDeps['addToSneakers']>(async () => ({ ok: true, existing: false, code: 'K7M3QX' })),
    upsertNewsletter: vi.fn<SpareChangeDeps['upsertNewsletter']>(async () => true),
    welcome: vi.fn<SpareChangeDeps['welcome']>(async () => 'sent'),
    ...over,
  }
  return deps
}
const context = { referrer: 'https://sneakersterminal.com/spare-change', ipCountry: 'US' }
const adult = { ok: true, email: 'sam@school.edu', newsletter: true, name: 'Sam Lee', age: 19, state: 'NJ', referredBy: 'ABCDEF' } as const
const minor = { ok: true, email: 'sam@school.edu', newsletter: false, reason: 'under_18', referredBy: null } as const

describe('joining both lists with one form', () => {
  it('a new adult lands on the newsletter list and the Sneakers waitlist, and gets their code', async () => {
    const deps = fakes()
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: false, code: 'K7M3QX', newsletter: true, welcome: 'sent' })
    expect(deps.upsertNewsletter).toHaveBeenCalledWith({ email: 'sam@school.edu', name: 'Sam Lee', ageAtSignup: 19, state: 'NJ', referredByCode: 'ABCDEF', claimToken: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/) })
    expect(deps.welcome).toHaveBeenCalledWith('sam@school.edu')
    expect(deps.addToSneakers).toHaveBeenCalledWith({ email: 'sam@school.edu', referrer: context.referrer, ipCountry: 'US', referredBy: 'ABCDEF' })
  })
  it('someone already on the Sneakers waitlist can still opt in (no code is handed back for an address already on the list)', async () => {
    const deps = fakes({ addToSneakers: vi.fn(async () => ({ ok: true as const, existing: true, code: null })) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: true, code: null, newsletter: true, welcome: 'sent' })
    expect(deps.upsertNewsletter).toHaveBeenCalledTimes(1)
  })
  it('under 18: Sneakers waitlist only, no newsletter row is written, and the answer says why', async () => {
    const deps = fakes()
    expect(await joinSpareChange(minor, context, deps)).toEqual({ ok: true, existing: false, code: 'K7M3QX', newsletter: false, reason: 'under_18' })
    expect(deps.upsertNewsletter).not.toHaveBeenCalled()
    expect(deps.welcome).not.toHaveBeenCalled()
    expect(deps.addToSneakers).toHaveBeenCalledTimes(1)
    expect(deps.addToSneakers).toHaveBeenCalledWith({ email: 'sam@school.edu', referrer: context.referrer, ipCountry: 'US', referredBy: null })
  })
  it('signing up twice is fine both times (the newsletter write is an upsert)', async () => {
    const addToSneakers = vi.fn<SpareChangeDeps['addToSneakers']>().mockResolvedValueOnce({ ok: true, existing: false, code: 'K7M3QX' }).mockResolvedValueOnce({ ok: true, existing: true, code: null })
    const deps = fakes({ addToSneakers })
    expect(await joinSpareChange(adult, context, deps)).toMatchObject({ ok: true, existing: false, newsletter: true })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: true, code: null, newsletter: true, welcome: 'sent' })
    expect(deps.upsertNewsletter).toHaveBeenCalledTimes(2)
  })
  it('a failed newsletter write stops before the Sneakers row, so trying again still returns the person\'s code', async () => {
    const deps = fakes({ upsertNewsletter: vi.fn(async () => false) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: false })
    expect(deps.addToSneakers).not.toHaveBeenCalled()
  })
  it('a failed Sneakers write is a failure, and no welcome email goes out', async () => {
    const deps = fakes({ addToSneakers: vi.fn(async () => ({ ok: false as const })) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: false })
    expect(deps.welcome).not.toHaveBeenCalled()
  })
  it('a failed newsletter write sends no welcome email', async () => {
    const deps = fakes({ upsertNewsletter: vi.fn(async () => false) })
    await joinSpareChange(adult, context, deps)
    expect(deps.welcome).not.toHaveBeenCalled()
  })
  it('every signup offers a fresh claim token (the database keeps the first one for an email already on the list)', async () => {
    const deps = fakes()
    await joinSpareChange(adult, context, deps)
    await joinSpareChange(adult, context, deps)
    const [a, b] = vi.mocked(deps.upsertNewsletter).mock.calls.map(([row]) => row.claimToken)
    expect(a).not.toBe(b)
  })
  it('the signup still succeeds when the welcome email could not go, and says so', async () => {
    const deps = fakes({ welcome: vi.fn(async () => 'pending' as const) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: false, code: 'K7M3QX', newsletter: true, welcome: 'pending' })
    const threw = fakes({ welcome: vi.fn(async () => { throw new Error('boom') }) })
    expect(await joinSpareChange(adult, context, threw)).toMatchObject({ ok: true, newsletter: true, welcome: 'pending' })
  })
  it('a first signup and a repeat one get the same welcome answer', async () => {
    const addToSneakers = vi.fn<SpareChangeDeps['addToSneakers']>().mockResolvedValueOnce({ ok: true, existing: false, code: 'K7M3QX' }).mockResolvedValueOnce({ ok: true, existing: true, code: null })
    const deps = fakes({ addToSneakers })
    const first = await joinSpareChange(adult, context, deps)
    const again = await joinSpareChange(adult, context, deps)
    expect(first).toMatchObject({ newsletter: true, welcome: 'sent' })
    expect(again).toMatchObject({ newsletter: true, welcome: 'sent' })
  })
})

describe('the words people read', () => {
  const words = [NEWSLETTER_NAME, NEWSLETTER_PITCH, NEWSLETTER_REWARDS, NEWSLETTER_OPT_IN, NEWSLETTER_UNDER_18, REFERRAL_CAP_NOTE, SNEAKERS_LINE, friendsJoinedText(3)]
  it('name the newsletter, say 18+ and keep to the site\'s wording', () => {
    expect(NEWSLETTER_OPT_IN).toBe('Also send me Spare Change Millionaire, our daily long-shot parlay email. 18+ only.')
    expect(NEWSLETTER_PITCH).toContain('18+ only')
    expect(NEWSLETTER_UNDER_18).toBe('Spare Change Millionaire is 18+ only, so we left you off that list.')
    expect(NEWSLETTER_REWARDS).toContain('rewards for subscribers at launch')
    expect(REFERRAL_CAP_NOTE).toBe('Up to 5 friends count.')
    for (const text of words) {
      expect(text).not.toMatch(/\b(bets?|betting|cash|winnings|sportsbooks?|jackpot)\b/i)
      expect(text).not.toContain('—')
      expect(text).not.toContain('21')
    }
  })
  it('promise no amount for referrals or rewards', () => {
    for (const text of [NEWSLETTER_REWARDS, NEWSLETTER_OPT_IN, NEWSLETTER_UNDER_18, REFERRAL_CAP_NOTE, SNEAKERS_LINE, friendsJoinedText(5)]) expect(text).not.toMatch(/[$]|dollars?|\bfree\b|\bearn/i)
  })
})

describe('the saved screen', () => {
  const steps = ['Open the welcome email.', 'Tap "Claim your free dollar" and add your Venmo username.', 'We send your dollar on Friday.']
  it('greets by first name and points at the email when one was sent', () => {
    expect(savedScreenCopy({ name: ' Sam Lee ', emailSent: true })).toEqual({ heading: "You're in, Sam.", body: "We saved your spot. Check your email: there's a link to claim your free dollar.", steps })
  })
  it('never says an email was sent when it was not', () => {
    const copy = savedScreenCopy({ name: 'Sam', emailSent: false })
    expect(copy.body).toBe('We saved your spot. Your welcome email is on its way shortly.')
    expect(copy.body).not.toMatch(/check your email/i)
    expect(copy.steps).toEqual(steps)
  })
  it('with no usable name the heading is just "You\'re in."', () => {
    for (const name of ['', '   ', undefined, 'http://evil.example', '<b>x</b>', '12345']) expect(savedScreenCopy({ name, emailSent: true }).heading, String(name)).toBe("You're in.")
  })
  it('a first name is letters (any alphabet), apostrophes, hyphens and dots, up to 30', () => {
    expect(greetingName("  O'Neil-García Sam")).toBe("O'Neil-García")
    expect(greetingName('J.R. Smith')).toBe('J.R.')
    expect(greetingName('李 雷')).toBe('李')
    expect(greetingName('a'.repeat(31))).toBeNull()
    expect(greetingName(42)).toBeNull()
  })
  it('keeps to the site\'s wording and promises one dollar, nothing more', () => {
    for (const emailSent of [true, false]) {
      const copy = savedScreenCopy({ name: 'Sam', emailSent })
      for (const text of [copy.heading, copy.body, ...copy.steps]) {
        expect(text).not.toMatch(/\b(bets?|betting|cash|winnings|sportsbooks?|jackpot)\b/i)
        expect(text).not.toContain('—')
        expect(text).not.toMatch(/[$]\d/)
      }
    }
  })
})

describe('what the form says about each field, before anything is sent', () => {
  const ok = { name: 'Sam', email: 'sam@school.edu', state: 'NJ', age: '19' }
  it('a complete form has no problems', () => {
    expect(signupProblems(ok)).toEqual({})
  })
  it('each gap is named against its own field, all at once', () => {
    expect(signupProblems({ name: ' ', email: 'nope', state: '', age: 'abc' })).toEqual({
      name: 'Add your name.',
      email: 'That email does not look right.',
      state: 'Pick your state.',
      age: 'Type your age as a number.',
    })
    expect(Object.keys(signupProblems({ ...ok, state: '' }))).toEqual(['state'])
  })
  it('under 18 needs only an email and an age (that person joins the Sneakers waitlist only)', () => {
    expect(signupProblems({ name: '', email: 'sam@school.edu', state: '', age: '16' })).toEqual({})
  })
})
