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
  REFERRAL_OFFER_HEADING,
  REFERRAL_OFFER_STEPS,
  REFERRAL_OFFER_TERMS,
  REFERRAL_SHARE_LINE,
  SNEAKERS_LINE,
  US_STATES,
  creditedReferrals,
  friendsJoinedText,
  parseAge,
  parseBirthday,
  todayEastern,
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

// Ages are counted on this day in the tests.
const TODAY = '2026-11-20'

describe('the birthday field', () => {
  it('takes a YYYY-MM-DD date and works out the age on the day', () => {
    expect(parseBirthday('2007-11-20', TODAY)).toEqual({ birthDate: '2007-11-20', age: 19 })
    expect(parseBirthday(' 2008-11-20 ', TODAY)).toEqual({ birthDate: '2008-11-20', age: 18 })
    expect(parseBirthday('2008-11-21', TODAY)?.age).toBe(17) // 18 tomorrow
    expect(parseBirthday('2005-11-21', TODAY)?.age).toBe(20) // 21 tomorrow
    expect(parseBirthday('2004-02-29', '2026-02-28')?.age).toBe(21)
    expect(parseBirthday('2013-11-20', TODAY)?.age).toBe(13)
  })
  it('refuses anything that is not a real date, and ages outside 13 to 120', () => {
    for (const bad of [undefined, null, '', '19', 19, '11/20/2007', '2007-13-01', '2007-02-30', '2007-2-3', '2013-11-21', '2027-01-01', '1900-01-01', true, {}]) {
      expect(parseBirthday(bad, TODAY), String(bad)).toBeNull()
    }
  })
  it('counts the day in US Eastern time', () => {
    expect(todayEastern(new Date('2026-11-21T03:30:00Z'))).toBe('2026-11-20')
    expect(todayEastern(new Date('2026-11-21T05:30:00Z'))).toBe('2026-11-21')
  })
})

const good = { name: ' Sam Lee ', email: ' Sam@School.edu ', state: 'nj', birthday: '2007-06-01', ref: 'k7m3qx' }

describe('checking a signup before anything is stored', () => {
  it('normalizes a good one', () => {
    expect(validateSpareChange(good, TODAY)).toEqual({ ok: true, email: 'sam@school.edu', newsletter: true, name: 'Sam Lee', age: 19, birthDate: '2007-06-01', state: 'NJ', referredBy: 'K7M3QX', referredByName: null })
    expect(validateSpareChange({ ...good, referrerName: '  Jamie Fox ' }, TODAY)).toMatchObject({ ok: true, referredByName: 'Jamie Fox' })
    for (const referrerName of ['', '   ', 42, 'a'.repeat(81)]) expect(validateSpareChange({ ...good, referrerName }, TODAY), String(referrerName)).toMatchObject({ ok: true, referredByName: null })
    expect(validateSpareChange({ ...good, birthday: '2008-11-20' }, TODAY)).toMatchObject({ ok: true, newsletter: true, age: 18 })
  })
  it('refuses a bad email first', () => {
    expect(validateSpareChange({ ...good, email: 'nope' }, TODAY)).toEqual({ ok: false, error: 'invalid_email' })
    expect(validateSpareChange(null)).toEqual({ ok: false, error: 'invalid_email' })
  })
  it('refuses a missing, malformed or out-of-range birthday (a typed age is not one)', () => {
    for (const birthday of [undefined, '', 'abc', '19', 19, '2007-02-30', '2015-01-01', '1900-01-01']) expect(validateSpareChange({ ...good, birthday }, TODAY), String(birthday)).toEqual({ ok: false, error: 'invalid_birthday' })
    expect(validateSpareChange({ ...good, birthday: undefined, age: '19' }, TODAY)).toEqual({ ok: false, error: 'invalid_birthday' })
  })
  it('refuses an adult signup with no name or one that is too long', () => {
    expect(validateSpareChange({ ...good, name: '  ' }, TODAY)).toEqual({ ok: false, error: 'invalid_name' })
    expect(validateSpareChange({ ...good, name: undefined }, TODAY)).toEqual({ ok: false, error: 'invalid_name' })
    expect(validateSpareChange({ ...good, name: 'a'.repeat(81) }, TODAY)).toEqual({ ok: false, error: 'invalid_name' })
  })
  it('refuses an adult signup with no state or a made-up one', () => {
    expect(validateSpareChange({ ...good, state: undefined }, TODAY)).toEqual({ ok: false, error: 'invalid_state' })
    expect(validateSpareChange({ ...good, state: 'ZZ' }, TODAY)).toEqual({ ok: false, error: 'invalid_state' })
  })
  it('under 18 (13 to 17) is a Sneakers-only signup: the name, birthday and state are dropped', () => {
    for (const birthday of ['2013-11-20', '2008-11-21']) {
      expect(validateSpareChange({ ...good, birthday, ref: undefined }, TODAY), birthday).toEqual({ ok: true, email: 'sam@school.edu', newsletter: false, reason: 'under_18', referredBy: null })
    }
    expect(validateSpareChange({ email: 'sam@school.edu', birthday: '2010-06-01' }, TODAY)).toMatchObject({ ok: true, newsletter: false, reason: 'under_18' })
  })
  it('the old 21+ box means nothing any more', () => {
    expect(validateSpareChange({ email: 'sam@school.edu', state: 'NJ', confirmed21: true })).toEqual({ ok: false, error: 'invalid_birthday' })
  })
  it('drops a ref that is not a code', () => {
    expect(validateSpareChange({ ...good, ref: "x';--" }, TODAY)).toMatchObject({ ok: true, referredBy: null })
  })
})

function fakes(over: Partial<SpareChangeDeps> = {}) {
  const deps = {
    addToSneakers: vi.fn<SpareChangeDeps['addToSneakers']>(async () => ({ ok: true, existing: false, code: 'K7M3QX' })),
    upsertNewsletter: vi.fn<SpareChangeDeps['upsertNewsletter']>(async () => 'new' as const),
    resolveReferrer: vi.fn<SpareChangeDeps['resolveReferrer']>(async () => null),
    welcome: vi.fn<SpareChangeDeps['welcome']>(async () => 'sent'),
    ...over,
  }
  return deps
}
const context = { referrer: 'https://sneakersterminal.com/spare-change', ipCountry: 'US' }
const adult = { ok: true, email: 'sam@school.edu', newsletter: true, name: 'Sam Lee', age: 19, birthDate: '2007-06-01', state: 'NJ', referredBy: 'ABCDEF', referredByName: 'Jamie Fox' } as const
const minor = { ok: true, email: 'sam@school.edu', newsletter: false, reason: 'under_18', referredBy: null } as const

describe('joining both lists with one form', () => {
  it('tells Slack about a NEW subscriber only: not a repeat signup, not someone under 18, and a broken notifier never fails the signup', async () => {
    const onNewSubscriber = vi.fn()
    await joinSpareChange(adult, context, fakes({ onNewSubscriber, resolveReferrer: vi.fn(async () => 'member-1') }))
    expect(onNewSubscriber).toHaveBeenCalledWith({ name: 'Sam Lee', state: 'NJ', age: 19, referredByMemberId: 'member-1', referredByName: 'Jamie Fox' })
    await joinSpareChange(adult, context, fakes({ onNewSubscriber, upsertNewsletter: vi.fn(async () => 'existing' as const) }))
    await joinSpareChange(minor, context, fakes({ onNewSubscriber }))
    expect(onNewSubscriber).toHaveBeenCalledTimes(1)
    const broken = fakes({ onNewSubscriber: () => { throw new Error('slack down') } })
    expect(await joinSpareChange(adult, context, broken)).toMatchObject({ ok: true, newsletter: true })
  })
  it('a new adult lands on the newsletter list and the Sneakers waitlist, and gets their code', async () => {
    const deps = fakes()
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: false, code: 'K7M3QX', newsletter: true, welcome: 'sent' })
    expect(deps.upsertNewsletter).toHaveBeenCalledWith({ email: 'sam@school.edu', name: 'Sam Lee', ageAtSignup: 19, birthDate: '2007-06-01', state: 'NJ', referredByCode: 'ABCDEF', referredByName: 'Jamie Fox', claimToken: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/), linkToken: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/), referredByMemberId: null })
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
    const deps = fakes({ upsertNewsletter: vi.fn(async () => false as const) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: false })
    expect(deps.addToSneakers).not.toHaveBeenCalled()
  })
  it('a failed Sneakers write is a failure, and no welcome email goes out', async () => {
    const deps = fakes({ addToSneakers: vi.fn(async () => ({ ok: false as const })) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: false })
    expect(deps.welcome).not.toHaveBeenCalled()
  })
  it('a failed newsletter write sends no welcome email', async () => {
    const deps = fakes({ upsertNewsletter: vi.fn(async () => false as const) })
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
    expect(NEWSLETTER_REWARDS).toBe('Subscribers get a free $0.25 a day.')
    expect(REFERRAL_CAP_NOTE).toBe('Up to 5 friends count.')
    for (const text of words) {
      expect(text).not.toMatch(/\b(bets?|betting|cash|winnings|sportsbooks?|jackpot)\b/i)
      expect(text).not.toContain('—')
      expect(text).not.toContain('21')
    }
  })
  it('the only amounts promised are $0.25 a day and $5 a verified friend; nothing else names money', () => {
    for (const text of [NEWSLETTER_OPT_IN, NEWSLETTER_UNDER_18, REFERRAL_CAP_NOTE, SNEAKERS_LINE, friendsJoinedText(5)]) expect(text).not.toMatch(/[$]|dollars?|\bfree\b|\bearn/i)
    expect(REFERRAL_OFFER_HEADING).toBe('Refer a friend, get $5')
    // every line that names the $5 also says when it is paid
    for (const text of [REFERRAL_OFFER_STEPS.join(' '), REFERRAL_SHARE_LINE]) expect(text).toMatch(/\$5.*verified/)
    expect(REFERRAL_OFFER_TERMS).toMatch(/Up to 5 friends.*verified.*Terms apply/)
    for (const text of [REFERRAL_OFFER_HEADING, ...REFERRAL_OFFER_STEPS, REFERRAL_OFFER_TERMS, REFERRAL_SHARE_LINE]) expect(text).not.toMatch(/\b(bets?|betting|cash|winnings|sportsbooks?|jackpot)\b/i)
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
  const ok = { name: 'Sam', email: 'sam@school.edu', state: 'NJ', birthday: '2007-06-01' }
  it('a complete form has no problems', () => {
    expect(signupProblems(ok, TODAY)).toEqual({})
  })
  it('each gap is named against its own field, all at once', () => {
    expect(signupProblems({ name: ' ', email: 'nope', state: '', birthday: 'abc' }, TODAY)).toEqual({
      name: 'Add your name.',
      email: 'That email does not look right.',
      state: 'Pick your state.',
      birthday: 'Add your birthday.',
    })
    expect(Object.keys(signupProblems({ ...ok, state: '' }, TODAY))).toEqual(['state'])
  })
  it('under 18 needs only an email and a birthday (that person joins the Sneakers waitlist only)', () => {
    expect(signupProblems({ name: '', email: 'sam@school.edu', state: '', birthday: '2010-06-01' }, TODAY)).toEqual({})
  })
})

describe('who referred a new member, and their link token', () => {
  it('a referral code that belongs to a newsletter member is stored as that member', async () => {
    const deps = fakes({ resolveReferrer: vi.fn(async () => 'member-1') })
    await joinSpareChange(adult, context, deps)
    expect(deps.resolveReferrer).toHaveBeenCalledWith('ABCDEF', 'sam@school.edu')
    expect(vi.mocked(deps.upsertNewsletter).mock.calls[0][0]).toMatchObject({ referredByCode: 'ABCDEF', referredByMemberId: 'member-1' })
  })
  it('no code, no lookup; a lookup that fails never fails the signup', async () => {
    const none = fakes()
    await joinSpareChange({ ...adult, referredBy: null }, context, none)
    expect(none.resolveReferrer).not.toHaveBeenCalled()
    const down = fakes({ resolveReferrer: vi.fn(async () => { throw new Error('down') }) })
    expect(await joinSpareChange(adult, context, down)).toMatchObject({ ok: true, newsletter: true })
    expect(vi.mocked(down.upsertNewsletter).mock.calls[0][0].referredByMemberId).toBeNull()
  })
  it('someone under 18 gets no newsletter row, so no referrer is looked up', async () => {
    const deps = fakes()
    await joinSpareChange({ ...minor, referredBy: 'ABCDEF' }, context, deps)
    expect(deps.resolveReferrer).not.toHaveBeenCalled()
  })
  it('every signup gets its own link token, different from its claim token', async () => {
    const deps = fakes()
    await joinSpareChange(adult, context, deps)
    await joinSpareChange(adult, context, deps)
    const rows = vi.mocked(deps.upsertNewsletter).mock.calls.map(([row]) => row)
    expect(rows[0].linkToken).not.toBe(rows[1].linkToken)
    expect(rows[0].linkToken).not.toBe(rows[0].claimToken)
  })
})
