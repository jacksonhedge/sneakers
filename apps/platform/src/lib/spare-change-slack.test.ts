import { describe, expect, it, vi } from 'vitest'
import { clickSlackText, notifyParlayClick, notifyReferralEarned, postSlack, referralSlackText, shortName, signupSlackText, webhookFor, webhookOk } from './spare-change-slack'

const sub = { name: 'Sam  Lee', state: 'NJ', age: 22, referredByMemberId: null, referredByName: null }

describe('the Slack signup message', () => {
  it('shows first name and last initial, state, age and the count, never more', () => {
    expect(shortName('Sam Lee')).toBe('Sam L.')
    expect(shortName('Cher')).toBe('Cher')
    expect(shortName('  ')).toBe('Someone')
    expect(signupSlackText(sub, { referrerName: null, total: 1234 })).toBe(':moneybag: New Spare Change subscriber: *Sam L.* (NJ, 22) · 1,234 subscribers')
  })
  it('names the referrer from a link, or the typed name to match by hand', () => {
    expect(signupSlackText({ ...sub, referredByMemberId: 'm1' }, { referrerName: 'Jamie Fox', total: null })).toContain('referred by *Jamie F.* (link)')
    expect(signupSlackText({ ...sub, referredByName: 'my cousin' }, { referrerName: null, total: null })).toContain('says my cousin told them')
  })
  it('escapes Slack markup in anything typed', () => {
    expect(signupSlackText({ ...sub, name: '<!channel> x', referredByName: 'a & <b>' }, { referrerName: null, total: null })).not.toMatch(/<!channel>|<b>/)
  })
})

describe('the Slack referral message', () => {
  it('names the referrer and the friend by first name and initial, the amount, and the count', () => {
    expect(referralSlackText({ referrerName: 'Jamie Fox', friendName: 'Sam Lee', amountCents: 500, counted: 2, max: 5 })).toBe(
      ':handshake: Referral earned: *Jamie F.* gets $5. Their friend *Sam L.* had a first slip verified (2 of 5 friends)',
    )
  })
  it('still makes sense without the names or the count, and shows cents when there are some', () => {
    expect(referralSlackText({ referrerName: null, friendName: null, amountCents: 250, counted: null, max: 5 })).toBe(
      ':handshake: Referral earned: a referrer gets $2.50. Their friend had a first slip verified',
    )
  })
  it('escapes Slack markup in names', () => {
    expect(referralSlackText({ referrerName: '<!channel> a', friendName: 'b & <c>', amountCents: 500, counted: 1, max: 5 })).not.toMatch(/<!channel>|<c>/)
  })
  it('sends nothing when the webhook is not set', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    await notifyReferralEarned({ referrerId: 'r', friendId: 'f', amountCents: 500 }, 5, {}, fetchImpl)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('which channel each message goes to', () => {
  const env = {
    SPARE_CHANGE_SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B1/subs',
    SPARE_CHANGE_SLACK_REFERRALS_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B2/refs',
    SPARE_CHANGE_SLACK_CLICKS_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B3/clicks',
  }
  it('subscribers, referrals and parlay clicks each use their own webhook', () => {
    expect(webhookFor('subscribers', env)).toBe(env.SPARE_CHANGE_SLACK_WEBHOOK_URL)
    expect(webhookFor('referrals', env)).toBe(env.SPARE_CHANGE_SLACK_REFERRALS_WEBHOOK_URL)
    expect(webhookFor('clicks', env)).toBe(env.SPARE_CHANGE_SLACK_CLICKS_WEBHOOK_URL)
  })
  it('referrals fall back to the subscribers webhook; clicks never do (too many for that channel)', () => {
    const only = { SPARE_CHANGE_SLACK_WEBHOOK_URL: env.SPARE_CHANGE_SLACK_WEBHOOK_URL }
    expect(webhookFor('referrals', only)).toBe(env.SPARE_CHANGE_SLACK_WEBHOOK_URL)
    expect(webhookFor('clicks', only)).toBeNull()
    expect(webhookFor('subscribers', { SPARE_CHANGE_SLACK_WEBHOOK_URL: 'https://evil.example/x' })).toBeNull()
  })
})

describe('the Slack parlay click message', () => {
  const ticket = { name: 'The Lucky Seven', site: 'ProphetX', buyInCents: 100, headlineCents: 90000, issueDate: '2026-11-24' }
  it('says who opened which ticket, its buy-in and headline, and the site', () => {
    expect(clickSlackText({ memberName: 'Sam Lee', ticket })).toBe(':dart: Parlay click: *Sam L.* opened The Lucky Seven ($1 → $900) on ProphetX · issue of Nov 24')
  })
  it('an anonymous tap is "Someone", and a missing ticket still reads', () => {
    expect(clickSlackText({ memberName: null, ticket })).toContain(':dart: Parlay click: Someone opened The Lucky Seven')
    expect(clickSlackText({ memberName: null, ticket: null })).toBe(':dart: Parlay click: Someone opened a ticket')
  })
  it('escapes Slack markup in the ticket name', () => {
    expect(clickSlackText({ memberName: '<!here>', ticket: { ...ticket, name: '<b>x</b>' } })).not.toMatch(/<!here>|<b>/)
  })
  it('sends nothing without the clicks webhook, and never looks anything up for a malformed id', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    await notifyParlayClick({ ticketId: 'not-a-uuid', token: null }, { SPARE_CHANGE_SLACK_CLICKS_WEBHOOK_URL: 'https://hooks.slack.com/services/T/B3/c' }, fetchImpl)
    await notifyParlayClick({ ticketId: '6f1d3c2a-8b7e-4f6a-9c1d-2e3f4a5b6c7d', token: null }, {}, fetchImpl)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('posting', () => {
  it('only posts to a Slack Incoming Webhook', () => {
    expect(webhookOk('https://hooks.slack.com/services/T0/B0/xyz')).toBe(true)
    expect(webhookOk('http://hooks.slack.com/services/T0/B0/xyz')).toBe(false)
    expect(webhookOk('https://evil.example/services/x')).toBe(false)
    expect(webhookOk(undefined)).toBe(false)
  })
  it('a failed post returns false and never throws', async () => {
    const down = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await postSlack('https://hooks.slack.com/services/a', 'hi', down)).toBe(false)
    const ok = vi.fn(async () => new Response('ok')) as unknown as typeof fetch
    expect(await postSlack('https://hooks.slack.com/services/a', 'hi', ok)).toBe(true)
  })
})
