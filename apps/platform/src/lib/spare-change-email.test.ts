import { describe, expect, it, vi } from 'vitest'
import { WELCOME_FROM_NAME, WELCOME_SUBJECT, buildWelcomeEmail, sendWelcomeOnce, welcomeDue, welcomeFrom, type WelcomeDeps, type WelcomeStore } from './spare-change-email'

const CLAIM = `https://sneakersterminal.com/spare-change/claim?t=${'T'.repeat(32)}`
const BANNED = /\b(bets?|betting|cash|winnings|sportsbooks?)\b/i

describe('who the welcome email is from', () => {
  it('is The Hedge Team, at the address the site already sends from', () => {
    expect(WELCOME_FROM_NAME).toBe('The Hedge Team')
    expect(welcomeFrom({ override: undefined, helperFrom: 'Sneakers Terminal <onboarding@resend.dev>' })).toBe('The Hedge Team <onboarding@resend.dev>')
    expect(welcomeFrom({ override: '', helperFrom: 'hello@sneakersterminal.com' })).toBe('The Hedge Team <hello@sneakersterminal.com>')
  })
  it('can be overridden whole', () => {
    expect(welcomeFrom({ override: ' Someone <a@b.co> ', helperFrom: 'Sneakers Terminal <onboarding@resend.dev>' })).toBe('Someone <a@b.co>')
  })
})

describe('the welcome email', () => {
  const mail = buildWelcomeEmail({ name: 'Sam Lee', claimUrl: CLAIM, postalAddress: '1 Main St, Springfield, PA 19000' })
  it('has the subject asked for', () => {
    expect(WELCOME_SUBJECT).toBe("🪙 You're in. Claim your free dollar")
    expect(mail.subject).toBe(WELCOME_SUBJECT)
  })
  it('both versions carry the claim link, the 18+ line and the rest of the footer', () => {
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain(CLAIM)
      expect(body).toContain('18+ only.')
      expect(body).toContain('Claim your free dollar')
      expect(body).toContain('Spare Change Millionaire')
      expect(body).toContain('A daily email of long-shot parlays. A small buy-in, a big payout if it hits. Most long shots miss.')
      expect(body).toContain("The link is yours alone, so don't forward it.")
      expect(body).toContain("You're getting this because you signed up at sneakersterminal.com/spare-change.")
      expect(body).toContain("Reply STOP to this email and we'll remove you.")
      expect(body).toContain('Spare Change Millionaire is a Hedge, Inc. product.')
      expect(body).toContain('Hedge, Inc., 1 Main St, Springfield, PA 19000')
      expect(body).toContain('The Hedge Team')
      expect(body).toContain('Sam')
      expect(body).not.toContain('Lee')
    }
  })
  it('the button and the plain link both go to the claim page', () => {
    expect(mail.html.match(new RegExp(`href="${CLAIM.replace(/[?.]/g, '\\$&')}"`, 'g'))).toHaveLength(2)
  })
  it('has the lime band and dark ink, and nothing an email client would strip or block', () => {
    expect(mail.html).toContain('#C9F73A')
    expect(mail.html).toContain('#0B0F0C')
    expect(mail.html).toContain('<table')
    expect(mail.html).not.toMatch(/<script|<style|<link|@font-face|@import|javascript:|<img|<form/i)
  })
  it('uses none of the words the site avoids, and promises only the one dollar', () => {
    for (const body of [mail.subject, mail.html, mail.text]) {
      expect(body).not.toMatch(BANNED)
      expect(body).not.toContain('—')
      expect(body.replace(/\$1\b/g, '')).not.toMatch(/\$\d/)
    }
  })
  it('with no postal address set it prints the company name alone, never a made-up address', () => {
    const bare = buildWelcomeEmail({ name: 'Sam', claimUrl: CLAIM, postalAddress: undefined })
    for (const body of [bare.html, bare.text]) {
      expect(body).toContain('Spare Change Millionaire is a Hedge, Inc. product.')
      expect(body).not.toContain('Hedge, Inc.,')
      expect(body).toMatch(/Hedge, Inc\.\s*(<|$)/m)
    }
    expect(buildWelcomeEmail({ name: 'Sam', claimUrl: CLAIM, postalAddress: '   ' }).text).not.toContain('Hedge, Inc.,')
  })
  it('a name is never markup, and a name that is not a name is left out', () => {
    const odd = buildWelcomeEmail({ name: '<script>alert(1)</script> x', claimUrl: CLAIM, postalAddress: '<b>1 Main</b>' })
    expect(odd.html).not.toContain('<script')
    expect(odd.html).not.toContain('<b>1 Main')
    expect(odd.html).toContain('&lt;b&gt;1 Main')
    expect(odd.text).toContain('Hi there,')
    const link = buildWelcomeEmail({ name: 'http://evil.example now', claimUrl: CLAIM, postalAddress: undefined })
    expect(link.html).not.toContain('evil.example')
    expect(link.text).not.toContain('evil.example')
    expect(buildWelcomeEmail({ name: "O'Neil-García Sam", claimUrl: CLAIM, postalAddress: undefined }).text).toContain("Hi O'Neil-García,")
  })
})

describe('at most one welcome email per 24 hours', () => {
  const now = new Date('2026-11-20T15:00:00.000Z')
  it('is due when none was ever sent, or the last one is a day old', () => {
    expect(welcomeDue(null, now)).toBe(true)
    expect(welcomeDue('2026-11-19T15:00:00.000Z', now)).toBe(true)
    expect(welcomeDue('2026-11-18T10:00:00+00:00', now)).toBe(true)
  })
  it('is not due inside 24 hours', () => {
    expect(welcomeDue('2026-11-19T15:00:00.001Z', now)).toBe(false)
    expect(welcomeDue('2026-11-20T14:59:59.000Z', now)).toBe(false)
    expect(welcomeDue('2026-11-20T16:00:00.000Z', now)).toBe(false) // a clock ahead of ours: still "just sent"
  })
  it('a date that cannot be read counts as never sent', () => {
    expect(welcomeDue('not a date', now)).toBe(true)
  })
})

const NOW = new Date('2026-11-20T15:00:00.000Z')
const row = { name: 'Sam Lee', claimToken: 'T'.repeat(32), welcomeSentAt: null as string | null }
function deps(over: Partial<WelcomeDeps> = {}, storeOver: Partial<WelcomeStore> = {}) {
  const store = {
    read: vi.fn<WelcomeStore['read']>(async () => row),
    reserve: vi.fn<WelcomeStore['reserve']>(async () => true),
    release: vi.fn<WelcomeStore['release']>(async () => {}),
    ...storeOver,
  }
  return { store, send: vi.fn<WelcomeDeps['send']>(async () => 'sent'), configured: true, origin: 'https://sneakersterminal.com', postalAddress: undefined, now: () => NOW, ...over }
}

describe('sending the welcome email once', () => {
  it('a new signup: the slot is taken first, then the email goes with the person\'s own claim link', async () => {
    const d = deps()
    expect(await sendWelcomeOnce('sam@school.edu', d)).toBe('sent')
    expect(d.store.reserve).toHaveBeenCalledWith('sam@school.edu', null, NOW.toISOString())
    expect(d.send).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(d.send).mock.calls[0][0]
    expect(sent.to).toBe('sam@school.edu')
    expect(sent.text).toContain(CLAIM)
    expect(d.store.release).not.toHaveBeenCalled()
  })
  it('the same email again within 24 hours: no second email, and the screen can still say "check your email"', async () => {
    const d = deps({}, { read: vi.fn(async () => ({ ...row, welcomeSentAt: '2026-11-20T09:00:00.000Z' })) })
    expect(await sendWelcomeOnce('sam@school.edu', d)).toBe('sent')
    expect(d.send).not.toHaveBeenCalled()
    expect(d.store.reserve).not.toHaveBeenCalled()
  })
  it('the same email again a day later: one more, guarded by the time of the last one', async () => {
    const d = deps({}, { read: vi.fn(async () => ({ ...row, welcomeSentAt: '2026-11-19T09:00:00+00:00' })) })
    expect(await sendWelcomeOnce('sam@school.edu', d)).toBe('sent')
    expect(d.store.reserve).toHaveBeenCalledWith('sam@school.edu', '2026-11-19T09:00:00+00:00', NOW.toISOString())
    expect(d.send).toHaveBeenCalledTimes(1)
  })
  it('no email key: nothing is sent, nothing is recorded as sent, and the screen says "on its way"', async () => {
    const d = deps({ configured: false })
    expect(await sendWelcomeOnce('sam@school.edu', d)).toBe('pending')
    expect(d.send).not.toHaveBeenCalled()
    expect(d.store.reserve).not.toHaveBeenCalled()
  })
  it('a send that fails or is skipped gives the slot back, so the row never says an email went when it did not', async () => {
    for (const outcome of ['failed', 'skipped'] as const) {
      const d = deps({ send: vi.fn(async () => outcome) })
      expect(await sendWelcomeOnce('sam@school.edu', d)).toBe('pending')
      expect(d.store.release).toHaveBeenCalledWith('sam@school.edu', NOW.toISOString(), null)
    }
    const threw = deps({ send: vi.fn(async () => { throw new Error('boom') }) })
    expect(await sendWelcomeOnce('sam@school.edu', threw)).toBe('pending')
    expect(threw.store.release).toHaveBeenCalledTimes(1)
  })
  it('two signups at once: only the one that takes the slot sends', async () => {
    const d = deps({}, { reserve: vi.fn(async () => false) })
    expect(await sendWelcomeOnce('sam@school.edu', d)).toBe('pending')
    expect(d.send).not.toHaveBeenCalled()
  })
  it('a missing row or a database failure never breaks the signup', async () => {
    expect(await sendWelcomeOnce('sam@school.edu', deps({}, { read: vi.fn(async () => null) }))).toBe('pending')
    expect(await sendWelcomeOnce('sam@school.edu', deps({}, { read: vi.fn(async () => { throw new Error('down') }) }))).toBe('pending')
  })
})
