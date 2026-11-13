import { describe, expect, it } from 'vitest'
import { parseRefParam, rankPosition, referralLink, referralShareText } from './waitlist-referral'

describe('the waitlist referral link', () => {
  it('is the launching-soon page with the person\'s code', () => {
    expect(referralLink('https://sneakersterminal.com', 'K7M3QX')).toBe('https://sneakersterminal.com/launching-soon?ref=K7M3QX')
    expect(referralLink('https://sneakersterminal.com/', 'K7M3QX')).toBe('https://sneakersterminal.com/launching-soon?ref=K7M3QX')
  })
  it('the share text names the product, says what it is, and ends with the link', () => {
    const text = referralShareText('https://sneakersterminal.com/launching-soon?ref=K7M3QX')
    expect(text).toContain('Sneakers')
    expect(text).toContain('fun way to split payments with friends')
    expect(text.endsWith('https://sneakersterminal.com/launching-soon?ref=K7M3QX')).toBe(true)
    expect(text).not.toMatch(/\b(bet|cash|winnings|sportsbook|jackpot)\b/i)
  })
})

describe('reading ?ref= from the address', () => {
  it('accepts a six-character code in either case, with stray spaces', () => {
    expect(parseRefParam('k7m3qx')).toBe('K7M3QX')
    expect(parseRefParam(' K7M3QX ')).toBe('K7M3QX')
  })
  it('refuses anything that is not a code (so nothing odd reaches the database)', () => {
    for (const bad of [undefined, null, '', 'K7M3Q', 'K7M3QXX', 'K7M3Q0', 'K7M3QI', "K7M3Q';", '../etc', ['K7M3QX']]) {
      expect(parseRefParam(bad as never), String(bad)).toBeNull()
    }
  })
})

describe('where you stand on the list', () => {
  it('is first when nobody has more referrals and nobody with the same came earlier', () => {
    expect(rankPosition({ withMoreReferrals: 0, withSameReferralsEarlier: 0 })).toBe(1)
  })
  it('counts everyone with more referrals, then everyone with the same who joined earlier', () => {
    expect(rankPosition({ withMoreReferrals: 3, withSameReferralsEarlier: 9 })).toBe(13)
  })
})
