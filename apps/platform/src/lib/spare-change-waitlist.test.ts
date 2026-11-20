import { describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_NAME, NEWSLETTER_OPT_IN, NEWSLETTER_PITCH, NEWSLETTER_REWARDS, SNEAKERS_LINE, US_STATES, confirmed21, parseState } from './spare-change'
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

describe('the 21+ box', () => {
  it('counts only the literal true', () => {
    expect(confirmed21(true)).toBe(true)
    for (const no of [false, undefined, null, 'true', 'on', 1, {}]) expect(confirmed21(no), String(no)).toBe(false)
  })
})

describe('checking a signup before anything is stored', () => {
  it('normalizes a good one', () => {
    expect(validateSpareChange({ email: ' Sam@School.edu ', state: 'nj', confirmed21: true, ref: 'k7m3qx' })).toEqual({ ok: true, email: 'sam@school.edu', newsletter: true, state: 'NJ', referredBy: 'K7M3QX' })
  })
  it('refuses a bad email first', () => {
    expect(validateSpareChange({ email: 'nope', state: 'NJ', confirmed21: true })).toEqual({ ok: false, error: 'invalid_email' })
    expect(validateSpareChange(null)).toEqual({ ok: false, error: 'invalid_email' })
  })
  it('refuses a 21+ signup with no state or a made-up one', () => {
    expect(validateSpareChange({ email: 'sam@school.edu', confirmed21: true })).toEqual({ ok: false, error: 'invalid_state' })
    expect(validateSpareChange({ email: 'sam@school.edu', state: 'ZZ', confirmed21: true })).toEqual({ ok: false, error: 'invalid_state' })
  })
  it('without the 21+ box it is a Sneakers-only signup, and the state is dropped', () => {
    expect(validateSpareChange({ email: 'sam@school.edu', state: 'NJ', confirmed21: false })).toEqual({ ok: true, email: 'sam@school.edu', newsletter: false, state: null, referredBy: null })
    expect(validateSpareChange({ email: 'sam@school.edu', state: 'NJ', confirmed21: 'true' })).toMatchObject({ ok: true, newsletter: false, state: null })
  })
  it('drops a ref that is not a code', () => {
    expect(validateSpareChange({ email: 'sam@school.edu', state: 'NJ', confirmed21: true, ref: "x';--" })).toMatchObject({ ok: true, referredBy: null })
  })
})

const NOW = new Date('2026-11-19T12:00:00.000Z')
function fakes(over: Partial<SpareChangeDeps> = {}) {
  const deps = {
    addToSneakers: vi.fn<SpareChangeDeps['addToSneakers']>(async () => ({ ok: true, existing: false, code: 'K7M3QX' })),
    upsertNewsletter: vi.fn<SpareChangeDeps['upsertNewsletter']>(async () => true),
    now: () => NOW,
    ...over,
  }
  return deps
}
const context = { referrer: 'https://sneakersterminal.com/spare-change', ipCountry: 'US' }
const adult = { ok: true, email: 'sam@school.edu', newsletter: true, state: 'NJ', referredBy: 'ABCDEF' } as const
const minor = { ok: true, email: 'sam@school.edu', newsletter: false, state: null, referredBy: null } as const

describe('joining both lists with one form', () => {
  it('a new 21+ person lands on the newsletter list and the Sneakers waitlist, and gets their code', async () => {
    const deps = fakes()
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: false, code: 'K7M3QX', newsletter: true })
    expect(deps.upsertNewsletter).toHaveBeenCalledWith({ email: 'sam@school.edu', state: 'NJ', confirmed21At: NOW.toISOString(), referredByCode: 'ABCDEF' })
    expect(deps.addToSneakers).toHaveBeenCalledWith({ email: 'sam@school.edu', referrer: context.referrer, ipCountry: 'US', referredBy: 'ABCDEF' })
  })
  it('someone already on the Sneakers waitlist can still opt in (no code is handed back for an address already on the list)', async () => {
    const deps = fakes({ addToSneakers: vi.fn(async () => ({ ok: true as const, existing: true, code: null })) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: true, code: null, newsletter: true })
    expect(deps.upsertNewsletter).toHaveBeenCalledTimes(1)
  })
  it('under 21: Sneakers waitlist only, and no newsletter row is written', async () => {
    const deps = fakes()
    expect(await joinSpareChange(minor, context, deps)).toEqual({ ok: true, existing: false, code: 'K7M3QX', newsletter: false })
    expect(deps.upsertNewsletter).not.toHaveBeenCalled()
    expect(deps.addToSneakers).toHaveBeenCalledTimes(1)
  })
  it('signing up twice is fine both times (the newsletter write is an upsert)', async () => {
    const addToSneakers = vi.fn<SpareChangeDeps['addToSneakers']>().mockResolvedValueOnce({ ok: true, existing: false, code: 'K7M3QX' }).mockResolvedValueOnce({ ok: true, existing: true, code: null })
    const deps = fakes({ addToSneakers })
    expect(await joinSpareChange(adult, context, deps)).toMatchObject({ ok: true, existing: false, newsletter: true })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: true, existing: true, code: null, newsletter: true })
    expect(deps.upsertNewsletter).toHaveBeenCalledTimes(2)
  })
  it('a failed newsletter write stops before the Sneakers row, so trying again still returns the person\'s code', async () => {
    const deps = fakes({ upsertNewsletter: vi.fn(async () => false) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: false })
    expect(deps.addToSneakers).not.toHaveBeenCalled()
  })
  it('a failed Sneakers write is a failure', async () => {
    const deps = fakes({ addToSneakers: vi.fn(async () => ({ ok: false as const })) })
    expect(await joinSpareChange(adult, context, deps)).toEqual({ ok: false })
  })
})

describe('the words people read', () => {
  it('name the newsletter and keep to the site\'s wording', () => {
    expect(NEWSLETTER_OPT_IN).toBe('Also send me Spare Change Millionaire, our daily long-shot parlay email. 21+ only.')
    expect(NEWSLETTER_REWARDS).toContain('rewards for subscribers at launch')
    for (const text of [NEWSLETTER_NAME, NEWSLETTER_PITCH, NEWSLETTER_REWARDS, NEWSLETTER_OPT_IN, SNEAKERS_LINE]) {
      expect(text).not.toMatch(/\b(bets?|betting|cash|winnings|sportsbooks?|jackpot)\b/i)
      expect(text).not.toContain('—')
    }
  })
})
