import { describe, expect, it, vi } from 'vitest'
import {
  CLAIM_CAP_DEFAULT,
  CLAIM_COPY,
  claimCap,
  claimOrigin,
  claimUrl,
  maskVenmoHandle,
  newClaimToken,
  parseClaimToken,
  parseVenmoHandle,
  submitClaim,
  viewClaim,
  type ClaimRow,
  type ClaimStore,
} from './spare-change-claim'

describe('a Venmo username', () => {
  it('drops a leading @ and stray spaces, keeps the case for display and lower-cases the key', () => {
    expect(parseVenmoHandle(' @Sam-Gold_25 ')).toEqual({ handle: 'Sam-Gold_25', key: 'sam-gold_25' })
    expect(parseVenmoHandle('samgold')).toEqual({ handle: 'samgold', key: 'samgold' })
    expect(parseVenmoHandle('@@samgold')).toEqual({ handle: 'samgold', key: 'samgold' })
  })
  it('takes a pasted profile link', () => {
    expect(parseVenmoHandle('https://venmo.com/u/Sam-Gold')).toEqual({ handle: 'Sam-Gold', key: 'sam-gold' })
    expect(parseVenmoHandle('venmo.com/Sam-Gold')).toEqual({ handle: 'Sam-Gold', key: 'sam-gold' })
    expect(parseVenmoHandle('https://account.venmo.com/u/Sam-Gold?x=1')).toEqual({ handle: 'Sam-Gold', key: 'sam-gold' })
  })
  it('is 5 to 30 letters, digits, hyphens or underscores', () => {
    expect(parseVenmoHandle('abcde')).not.toBeNull()
    expect(parseVenmoHandle('a'.repeat(30))).not.toBeNull()
    for (const bad of [undefined, null, 42, '', '@', 'abcd', 'a'.repeat(31), 'sam gold', 'sam.gold', 'sam@gold.com', 'sam/gold', "sam';--x", 'samgöld', '<b>samgold</b>', ['samgold']]) {
      expect(parseVenmoHandle(bad), String(bad)).toBeNull()
    }
  })
  it('is shown masked: first two, dots, last two', () => {
    expect(maskVenmoHandle('samgold')).toBe('@sa•••ld')
    expect(maskVenmoHandle('Sam-Gold_25')).toBe('@Sa•••25')
    expect(maskVenmoHandle('abcde')).toBe('@ab•••de')
    expect(maskVenmoHandle('abcde')).not.toContain('c')
  })
})

describe('a claim token', () => {
  it('is 192 random bits, URL-safe, different every time', () => {
    const tokens = Array.from({ length: 200 }, () => newClaimToken())
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/)
      expect(encodeURIComponent(t)).toBe(t)
      expect(parseClaimToken(t)).toBe(t)
    }
    expect(new Set(tokens).size).toBe(200)
  })
  it('anything that is not exactly a token is refused before the database is asked', () => {
    for (const bad of [undefined, null, 42, '', 'short', 'a'.repeat(31), 'a'.repeat(33), `${'a'.repeat(31)}!`, `${'a'.repeat(31)} `, ['a'.repeat(32)]]) expect(parseClaimToken(bad), String(bad)).toBeNull()
  })
  it('goes in a link to the claim page', () => {
    expect(claimUrl('https://sneakersterminal.com/', 'T'.repeat(32))).toBe(`https://sneakersterminal.com/spare-change/claim?t=${'T'.repeat(32)}`)
  })
})

describe('where the claim link points', () => {
  const fallback = 'https://sneakersterminal.com'
  it('uses the configured site address first', () => {
    expect(claimOrigin({ siteUrl: 'https://sneakersterminal.com/', requestOrigin: 'http://localhost:3000' })).toBe('https://sneakersterminal.com')
  })
  it('falls back to where the request came in, for our own hosts and local work only', () => {
    expect(claimOrigin({ siteUrl: undefined, requestOrigin: 'http://localhost:3111' })).toBe('http://localhost:3111')
    expect(claimOrigin({ siteUrl: '', requestOrigin: 'http://127.0.0.1:3111' })).toBe('http://127.0.0.1:3111')
    expect(claimOrigin({ siteUrl: undefined, requestOrigin: 'https://www.sneakersterminal.com' })).toBe('https://www.sneakersterminal.com')
  })
  it('never puts a stranger\'s host in the email', () => {
    for (const requestOrigin of ['https://evil.example', 'https://sneakersterminal.com.evil.example', 'https://evilsneakersterminal.com', 'javascript:alert(1)', 'nope', null]) {
      expect(claimOrigin({ siteUrl: undefined, requestOrigin }), String(requestOrigin)).toBe(fallback)
    }
    expect(claimOrigin({ siteUrl: 'javascript:alert(1)', requestOrigin: null })).toBe(fallback)
  })
})

describe('the cap on free dollars', () => {
  it('is 100 unless set to a whole number', () => {
    expect(CLAIM_CAP_DEFAULT).toBe(100)
    for (const raw of [undefined, '', 'abc', '-5', '1.5', '1e3']) expect(claimCap(raw), String(raw)).toBe(100)
    expect(claimCap('250')).toBe(250)
    expect(claimCap(' 0 ')).toBe(0)
  })
})

const TOKEN = 'k'.repeat(32)
const NOW = new Date('2026-11-20T15:00:00.000Z')
const open: ClaimRow = { email: 'sam@school.edu', venmoHandle: null, claimedAt: null, emailConfirmedAt: null }
const taken: ClaimRow = { email: 'sam@school.edu', venmoHandle: 'samgold', claimedAt: '2026-11-20T14:00:00.000Z', emailConfirmedAt: '2026-11-20T13:00:00.000Z' }

function store(over: Partial<ClaimStore> = {}) {
  return {
    findByToken: vi.fn<ClaimStore['findByToken']>(async () => open),
    countClaimed: vi.fn<ClaimStore['countClaimed']>(async () => 3),
    confirmEmail: vi.fn<ClaimStore['confirmEmail']>(async () => {}),
    claim: vi.fn<ClaimStore['claim']>(async () => 'claimed'),
    recordWelcomeReward: vi.fn<ClaimStore['recordWelcomeReward']>(async () => {}),
    ...over,
  }
}
const now = () => NOW

describe('opening the claim page', () => {
  it('a good, unclaimed link shows the form and confirms the email', async () => {
    const s = store()
    expect(await viewClaim(TOKEN, { store: s, cap: 100, now })).toEqual({ status: 'open' })
    expect(s.confirmEmail).toHaveBeenCalledWith(TOKEN, NOW.toISOString())
  })
  it('an email already confirmed is not confirmed again', async () => {
    const s = store({ findByToken: vi.fn(async () => ({ ...open, emailConfirmedAt: '2026-11-20T13:00:00.000Z' })) })
    await viewClaim(TOKEN, { store: s, cap: 100, now })
    expect(s.confirmEmail).not.toHaveBeenCalled()
  })
  it('the confirming write can be put off until after the answer', async () => {
    const s = store()
    const later: Array<() => Promise<void>> = []
    await viewClaim(TOKEN, { store: s, cap: 100, now, defer: (work) => void later.push(work) })
    expect(s.confirmEmail).not.toHaveBeenCalled()
    await later[0]()
    expect(s.confirmEmail).toHaveBeenCalledTimes(1)
  })
  it('an already claimed link shows the masked username and nothing else', async () => {
    const s = store({ findByToken: vi.fn(async () => taken) })
    const view = await viewClaim(TOKEN, { store: s, cap: 100, now })
    expect(view).toEqual({ status: 'claimed', masked: '@sa•••ld' })
    expect(JSON.stringify(view)).not.toContain('samgold')
  })
  it('an already claimed link still says so when the round is full', async () => {
    const s = store({ findByToken: vi.fn(async () => taken), countClaimed: vi.fn(async () => 100) })
    expect(await viewClaim(TOKEN, { store: s, cap: 100, now })).toMatchObject({ status: 'claimed' })
  })
  it('an unknown link and a malformed one get the same answer; a malformed one never reaches the database', async () => {
    const s = store({ findByToken: vi.fn(async () => null) })
    expect(await viewClaim(TOKEN, { store: s, cap: 100, now })).toEqual({ status: 'unknown' })
    expect(s.confirmEmail).not.toHaveBeenCalled()
    const untouched = store()
    expect(await viewClaim('nope', { store: untouched, cap: 100, now })).toEqual({ status: 'unknown' })
    expect(await viewClaim(undefined, { store: untouched, cap: 100, now })).toEqual({ status: 'unknown' })
    expect(untouched.findByToken).not.toHaveBeenCalled()
  })
  it('known and unknown links ask the database the same questions', async () => {
    const known = store()
    const unknown = store({ findByToken: vi.fn(async () => null) })
    await viewClaim(TOKEN, { store: known, cap: 100, now, defer: () => {} })
    await viewClaim(TOKEN, { store: unknown, cap: 100, now, defer: () => {} })
    for (const s of [known, unknown]) {
      expect(s.findByToken).toHaveBeenCalledTimes(1)
      expect(s.countClaimed).toHaveBeenCalledTimes(1)
    }
  })
  it('when the round is full an unclaimed link says so (and still counts as confirming the email)', async () => {
    const s = store({ countClaimed: vi.fn(async () => 100) })
    expect(await viewClaim(TOKEN, { store: s, cap: 100, now })).toEqual({ status: 'cap_reached' })
    expect(s.confirmEmail).toHaveBeenCalledTimes(1)
  })
  it('a database failure is an error, not "that link does not work"', async () => {
    const s = store({ findByToken: vi.fn(async () => { throw new Error('down') }) })
    expect(await viewClaim(TOKEN, { store: s, cap: 100, now })).toEqual({ status: 'error' })
  })
})

describe('saving a Venmo username', () => {
  it('stores the username as typed, its lower-cased key and the time, in one conditional write', async () => {
    const s = store()
    expect(await submitClaim({ t: TOKEN, venmo: '@Sam-Gold' }, { store: s, cap: 100, now })).toEqual({ status: 'saved', handle: 'Sam-Gold', email: 'sam@school.edu' })
    expect(s.claim).toHaveBeenCalledTimes(1)
    expect(s.claim).toHaveBeenCalledWith(TOKEN, 'Sam-Gold', 'sam-gold', NOW.toISOString())
  })
  it('a username that cannot be a Venmo one is refused before anything is looked up', async () => {
    const s = store()
    expect(await submitClaim({ t: TOKEN, venmo: 'sam' }, { store: s, cap: 100, now })).toEqual({ status: 'invalid_venmo' })
    expect(s.findByToken).not.toHaveBeenCalled()
    expect(s.claim).not.toHaveBeenCalled()
  })
  it('an unknown or malformed link stores nothing', async () => {
    const s = store({ findByToken: vi.fn(async () => null) })
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })).toEqual({ status: 'unknown' })
    expect(await submitClaim({ t: 'nope', venmo: 'samgold' }, { store: s, cap: 100, now })).toEqual({ status: 'unknown' })
    expect(await submitClaim(null, { store: s, cap: 100, now })).toEqual({ status: 'unknown' })
    expect(s.claim).not.toHaveBeenCalled()
  })
  it('an already claimed link cannot be changed', async () => {
    const s = store({ findByToken: vi.fn(async () => taken) })
    expect(await submitClaim({ t: TOKEN, venmo: 'someoneelse' }, { store: s, cap: 100, now })).toEqual({ status: 'claimed', masked: '@sa•••ld' })
    expect(s.claim).not.toHaveBeenCalled()
  })
  it('when the round is full nothing is stored', async () => {
    for (const count of [100, 101]) {
      const s = store({ countClaimed: vi.fn(async () => count) })
      expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })).toEqual({ status: 'cap_reached' })
      expect(s.claim).not.toHaveBeenCalled()
    }
    const last = store({ countClaimed: vi.fn(async () => 99) })
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: last, cap: 100, now })).toMatchObject({ status: 'saved' })
  })
  it('a cap of 0 closes the round', async () => {
    const s = store({ countClaimed: vi.fn(async () => 0) })
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 0, now })).toEqual({ status: 'cap_reached' })
  })
  it('one dollar per Venmo: a username another person used is refused', async () => {
    const s = store({ claim: vi.fn(async () => 'duplicate_venmo' as const) })
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })).toEqual({ status: 'duplicate_venmo' })
  })
  it('a double tap or a second tab: the write that lost shows what the first one saved', async () => {
    const findByToken = vi.fn<ClaimStore['findByToken']>().mockResolvedValueOnce(open).mockResolvedValueOnce(taken)
    const s = store({ findByToken, claim: vi.fn(async () => 'none' as const) })
    expect(await submitClaim({ t: TOKEN, venmo: 'otherhandle' }, { store: s, cap: 100, now })).toEqual({ status: 'claimed', masked: '@sa•••ld' })
  })
  it('a database failure is an error', async () => {
    const s = store({ claim: vi.fn(async () => { throw new Error('down') }) })
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })).toEqual({ status: 'error' })
  })
  it('a claim that succeeds puts the welcome dollar in the rewards ledger, once', async () => {
    const s = store()
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })).toMatchObject({ status: 'saved' })
    expect(s.recordWelcomeReward).toHaveBeenCalledTimes(1)
    expect(s.recordWelcomeReward).toHaveBeenCalledWith(TOKEN, NOW.toISOString())
  })
  it('nothing goes in the ledger when nothing was claimed', async () => {
    const outcomes = [store({ claim: vi.fn(async () => 'duplicate_venmo' as const) }), store({ findByToken: vi.fn(async () => taken) }), store({ countClaimed: vi.fn(async () => 100) }), store({ findByToken: vi.fn(async () => null) })]
    for (const s of outcomes) {
      await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })
      expect(s.recordWelcomeReward).not.toHaveBeenCalled()
    }
    const bad = store()
    await submitClaim({ t: TOKEN, venmo: 'no' }, { store: bad, cap: 100, now })
    expect(bad.recordWelcomeReward).not.toHaveBeenCalled()
  })
  it('a ledger write that fails does not undo the claim', async () => {
    const s = store({ recordWelcomeReward: vi.fn(async () => { throw new Error('down') }) })
    expect(await submitClaim({ t: TOKEN, venmo: 'samgold' }, { store: s, cap: 100, now })).toEqual({ status: 'saved', handle: 'samgold', email: 'sam@school.edu' })
  })
})

describe('the words on the claim page', () => {
  it('are the ones asked for', () => {
    expect(CLAIM_COPY.heading).toBe('Claim your free dollar')
    expect(CLAIM_COPY.fieldNote).toBe("We'll send $1 to this Venmo on Friday. Double-check the spelling.")
    expect(CLAIM_COPY.unknown).toBe("That link doesn't work. Open the newest welcome email and tap the button again.")
    expect(CLAIM_COPY.claimedHeading).toBe("You're all set.")
    expect(CLAIM_COPY.claimedNote).toBe('Wrong username? Reply to your welcome email.')
    expect(CLAIM_COPY.duplicate).toBe('That Venmo username has already been used for a free dollar.')
    expect(CLAIM_COPY.capReached).toBe("All the free dollars for this round have been claimed. You're still on the list.")
    expect(CLAIM_COPY.saved('Sam-Gold')).toBe('Saved. Your dollar goes to @Sam-Gold on Friday.')
  })
  it('keep to the site\'s wording', () => {
    const all = Object.values(CLAIM_COPY).map((v) => (typeof v === 'function' ? v('samgold') : v))
    for (const text of all) {
      expect(text).not.toMatch(/\b(bets?|betting|cash|winnings|sportsbooks?)\b/i)
      expect(text).not.toContain('—')
    }
  })
})
