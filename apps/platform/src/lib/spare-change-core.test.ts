import { describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_LINK_HOSTS,
  addDays,
  allowedDestination,
  checkBearerSecret,
  decideDailyReward,
  decideGo,
  expectedPayoutCents,
  handleGo,
  ingestIssue,
  intSetting,
  markRewardsPaid,
  newLinkToken,
  parseIssue,
  parseLinkToken,
  parseSettle,
  rejectWager,
  REWARD_DEFAULTS,
  rewardConfig,
  secretsMatch,
  settleIssue,
  siteMinAge,
  submitSlip,
  ticketResultFromLegs,
  verifyWager,
  wonPayoutCents,
  type GoStore,
  type IngestStore,
  type IssueLeg,
  type IssueTicket,
  type Member,
  type MemberEvent,
  type PayoutStore,
  type RewardForPayout,
  type SettleStore,
  type StoredTicket,
  type TicketRef,
  type Wager,
  type WagerStore,
} from './spare-change-core'

const NOW = new Date('2026-11-21T15:00:00.000Z')
const now = () => NOW
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ------------------------------------------------------------------------------------------------ sites and destinations
describe('how old you must be for a site', () => {
  it('sportsbooks are 21; ProphetX and the prediction markets are 18', () => {
    for (const site of ['DraftKings', 'FanDuel', 'Fanatics']) expect(siteMinAge(site), site).toBe(21)
    for (const site of ['ProphetX', 'Kalshi', 'Polymarket']) expect(siteMinAge(site), site).toBe(18)
  })
  it('spelling and case do not matter; a site nobody listed is 21', () => {
    expect(siteMinAge('prophetx')).toBe(18)
    expect(siteMinAge(' Draft Kings ')).toBe(21)
    for (const site of ['', 'BetMGM', 'Fanatics Sportsbook', 'Some New Exchange', 'kalshi2']) expect(siteMinAge(site), site).toBe(21)
  })
})

describe('where a tracked link may send someone', () => {
  it('the listed sites and their subdomains, over https', () => {
    for (const host of ALLOWED_LINK_HOSTS) {
      expect(allowedDestination(`https://${host}/`), host).not.toBeNull()
      expect(allowedDestination(`https://www.${host}/x?y=1`), host).not.toBeNull()
    }
    expect(allowedDestination('https://sportsbook.draftkings.com/')?.hostname).toBe('sportsbook.draftkings.com')
    expect(allowedDestination('https://www.prophetx.co/?action=addtobetslip&line_ids=a,b')?.toString()).toBe('https://www.prophetx.co/?action=addtobetslip&line_ids=a,b')
  })
  it('nothing else', () => {
    for (const link of [
      null,
      undefined,
      '',
      'nope',
      'http://kalshi.com/',
      'https://evil.example/',
      'https://kalshi.com.evil.example/',
      'https://evilkalshi.com/',
      'https://kalshi.com@evil.example/',
      'https://user:pass@kalshi.com/',
      'https://kalshi.com:8443/',
      'javascript:alert(1)',
      '//kalshi.com/',
      'https://sneakersterminal.com/',
    ]) {
      expect(allowedDestination(link), String(link)).toBeNull()
    }
  })
})

// ------------------------------------------------------------------------------------------------ tokens and the secret
describe('a link token', () => {
  it('is 192 random bits as 32 URL-safe characters, different every time', () => {
    const tokens = Array.from({ length: 200 }, () => newLinkToken())
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/)
      expect(encodeURIComponent(t)).toBe(t)
      expect(parseLinkToken(t)).toBe(t)
    }
    expect(new Set(tokens).size).toBe(200)
  })
  it('a backfilled token (64 hex characters) is accepted; junk and a placeholder nobody filled are not', () => {
    expect(parseLinkToken('a1'.repeat(32))).toBe('a1'.repeat(32))
    for (const bad of [undefined, null, 42, '', 'short', 'a'.repeat(21), 'a'.repeat(129), '{{link_token}}', `${'a'.repeat(31)}!`, `${'a'.repeat(31)} `, ['a'.repeat(32)]]) expect(parseLinkToken(bad), String(bad)).toBeNull()
  })
})

describe('the ingest secret', () => {
  const SECRET = 's3cret-'.repeat(5)
  it('matches only itself', () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true)
    for (const given of ['', SECRET.slice(0, -1), `${SECRET}x`, SECRET.toUpperCase(), ` ${SECRET}`, 'x'.repeat(SECRET.length)]) expect(secretsMatch(given, SECRET), given).toBe(false)
    expect(secretsMatch('', '')).toBe(false)
  })
  it('is compared as two fixed-length digests, so secrets of very different lengths are handled the same way', () => {
    // timingSafeEqual throws on inputs of different lengths; hashing both sides first is what makes any pair comparable in constant time.
    expect(() => secretsMatch('a', 'b'.repeat(10_000))).not.toThrow()
    expect(secretsMatch('a', 'b'.repeat(10_000))).toBe(false)
    expect(secretsMatch('b'.repeat(10_000), 'b'.repeat(10_000))).toBe(true)
  })
  it('the route is off without a secret, and 401 without the right bearer token', () => {
    expect(checkBearerSecret(`Bearer ${SECRET}`, undefined)).toBe('disabled')
    expect(checkBearerSecret(`Bearer ${SECRET}`, '')).toBe('disabled')
    expect(checkBearerSecret(`Bearer ${SECRET}`, '   ')).toBe('disabled')
    expect(checkBearerSecret('Bearer short', 'short')).toBe('disabled')
    for (const header of [null, undefined, '', SECRET, `Basic ${SECRET}`, 'Bearer', 'Bearer ', `Bearer ${SECRET}x`, `Bearer ${SECRET} extra`, `Bearer wrong-${SECRET}`]) expect(checkBearerSecret(header, SECRET), String(header)).toBe('unauthorized')
    expect(checkBearerSecret(`Bearer ${SECRET}`, SECRET)).toBe('ok')
    expect(checkBearerSecret(`bearer  ${SECRET}`, ` ${SECRET} `)).toBe('ok')
  })
})

describe('settings from the environment', () => {
  it('a whole number in range, or the default', () => {
    expect(intSetting('18', 21, 18, 120)).toBe(18)
    for (const raw of [undefined, '', 'abc', '17', '121', '21.5', '-21', '1e2']) expect(intSetting(raw, 21, 18, 120), String(raw)).toBe(21)
  })
  it('the reward settings default to 21, 5 days and 5 friends', () => {
    expect(rewardConfig({})).toEqual({ rewardMinAge: 21, referralCentsPerFriend: 500, referralDaysPerFriend: 0, referralMaxFriends: 5 })
    expect(rewardConfig({ SPARE_CHANGE_REWARD_MIN_AGE: '18', SPARE_CHANGE_REFERRAL_DAYS_PER_FRIEND: '3', SPARE_CHANGE_REFERRAL_MAX_FRIENDS: '2' })).toEqual({ rewardMinAge: 18, referralCentsPerFriend: 500, referralDaysPerFriend: 3, referralMaxFriends: 2 })
    expect(rewardConfig({ SPARE_CHANGE_REWARD_MIN_AGE: '12' }).rewardMinAge).toBe(21)
  })
})

// ------------------------------------------------------------------------------------------------ ingest: validation
const leg = (decimal: number, over: Record<string, unknown> = {}) => ({ id: 'X1', site: 'ProphetX', sport: 'Tennis', league: 'ATP', event: 'A at B', start_et: '2026-11-20T14:30:00-05:00', market: 'moneyline', selection: 'A to win', price_text: '33%', decimal, line_id: 'line-a', ...over })
// $1.00 x (2 x 3 x 2.5 - 1) = $14.00
const ticketJson = (over: Record<string, unknown> = {}) => ({
  n: 2,
  site: 'ProphetX',
  name: 'The Five-Spot',
  estimated: true,
  buy_in: 1.0,
  winnings: 14.0,
  headline: 14,
  one_in: 15,
  fee: 0.09,
  link: 'https://www.prophetx.co/?action=addtobetslip&line_ids=a,b,c',
  legs: [leg(2, { line_id: 'a' }), leg(3, { line_id: 'b', selection: 'C to win', event: 'C at D' }), leg(2.5, { line_id: 'c', selection: 'E +1.5', event: 'E at F' })],
  ...over,
})
const issueJson = (over: Record<string, unknown> = {}) => ({
  newsletter: 'Spare Change Millionaire',
  issue_date: '2026-11-20',
  issue_no: 1,
  built_at_et: '2026-11-19T21:47:10-05:00',
  from_name: 'Spare Change Millionaire',
  subject: '🚗 $0.65 → $45,000 long shot',
  preheader: 'About a 1 in 131,235 shot.',
  tickets: [ticketJson()],
  ...over,
})
const detailOf = (body: unknown): string => {
  const r = parseIssue(body)
  if (r.ok) throw new Error('expected the issue to be refused')
  expect(r.error).toBe('invalid_issue')
  return r.detail
}

describe('checking an issue before it is stored', () => {
  it('turns the pipeline\'s dollars into whole cents and maps the site to its minimum age', () => {
    const r = parseIssue(issueJson())
    if (!r.ok) throw new Error(r.detail)
    expect(r.issue).toMatchObject({ issueDate: '2026-11-20', issueNo: 1, subject: '🚗 $0.65 → $45,000 long shot', fromName: 'Spare Change Millionaire', builtAt: '2026-11-20T02:47:10.000Z', warnings: [] })
    expect(r.issue.tickets[0]).toMatchObject({ position: 2, site: 'ProphetX', name: 'The Five-Spot', buyInCents: 100, estPayoutCents: 1400, headlineCents: 1400, oneIn: 15, fairOneIn: null, feeCents: 9, minAge: 18, estimated: true })
    expect(r.issue.tickets[0].legs[0]).toEqual({ n: 1, sport: 'Tennis', league: 'ATP', event: 'A at B', startsAt: '2026-11-20T19:30:00.000Z', market: 'moneyline', pick: 'A to win', priceText: '33%', priceDecimal: 2, sourceRef: 'a' })
    expect(r.issue.tickets[0].legs.map((l) => l.n)).toEqual([1, 2, 3])
  })
  it('a sportsbook ticket is 21+, and 65 cents is 65 cents', () => {
    const r = parseIssue(issueJson({ tickets: [ticketJson({ n: 1, site: 'DraftKings', buy_in: 0.65, winnings: 9.1, headline: 9, link: 'https://sportsbook.draftkings.com/' })] }))
    if (!r.ok) throw new Error(r.detail)
    expect(r.issue.tickets[0]).toMatchObject({ position: 1, minAge: 21, buyInCents: 65, estPayoutCents: 910, headlineCents: 900 })
  })
  it('takes the site\'s own id for a leg from whichever field the collector kept', () => {
    const bare = { ...leg(2), line_id: undefined }
    const refs = [{ ...bare, ticker: 'KX-1' }, { ...bare, slug: 'aec-atp' }, { ...bare, game_key: 'espn:401' }, bare].map((l) => {
      const r = parseIssue(issueJson({ tickets: [ticketJson({ winnings: 1.0, headline: 1, legs: [l] })] }))
      if (!r.ok) throw new Error(r.detail)
      return r.issue.tickets[0].legs[0].sourceRef
    })
    expect(refs).toEqual(['KX-1', 'aec-atp', 'espn:401', 'X1'])
  })
  it('refuses money that is not a whole number of cents, and says which', () => {
    expect(detailOf(issueJson({ tickets: [ticketJson({ buy_in: 0.655 })] }))).toBe('tickets[0].buy_in: 0.655 is not a whole number of cents')
    expect(detailOf(issueJson({ tickets: [ticketJson({ winnings: 14.001 })] }))).toBe('tickets[0].winnings: 14.001 is not a whole number of cents')
    expect(detailOf(issueJson({ tickets: [ticketJson({ fee: 0.0949 })] }))).toBe('tickets[0].fee: 0.0949 is not a whole number of cents')
    expect(detailOf(issueJson({ tickets: [ticketJson({ buy_in_cents: 65.5 })] }))).toBe('tickets[0].buy_in_cents: 65.5 is not a whole number of cents')
    expect(detailOf(issueJson({ tickets: [ticketJson({ buy_in: '1.00' })] }))).toBe('tickets[0].buy_in: "1.00" is not a number')
    expect(detailOf(issueJson({ tickets: [ticketJson({ buy_in: undefined })] }))).toBe('tickets[0].buy_in: missing')
    expect(detailOf(issueJson({ tickets: [ticketJson({ buy_in: 0 })] }))).toMatch(/buy_in: must be more than zero/)
    expect(detailOf(issueJson({ tickets: [ticketJson({ buy_in: -1, winnings: -14, headline: -14 })] }))).toMatch(/buy_in: must be more than zero/)
  })
  it('accepts cents given as cents', () => {
    const r = parseIssue(issueJson({ tickets: [ticketJson({ buy_in: undefined, winnings: undefined, headline: undefined, fee: undefined, buy_in_cents: 100, est_payout_cents: 1400, headline_cents: 1400, fee_cents: 9 })] }))
    if (!r.ok) throw new Error(r.detail)
    expect(r.issue.tickets[0]).toMatchObject({ buyInCents: 100, estPayoutCents: 1400, headlineCents: 1400, feeCents: 9 })
  })
  it('a leg price must be more than 1', () => {
    for (const decimal of [1, 1.00004, 0.5, 0, -2, NaN, '2.0', null]) {
      expect(detailOf(issueJson({ tickets: [ticketJson({ legs: [leg(decimal as number)] })] })), String(decimal)).toMatch(/^tickets\[0\]\.legs\[0\]\.decimal: .* must be a number greater than 1$/)
    }
  })
  it('the estimate must match buy-in x (product of leg decimals - 1) within one cent', () => {
    expect(expectedPayoutCents(100, [2, 3, 2.5])).toBe(1400)
    for (const winnings of [13.99, 14.0, 14.01]) expect(parseIssue(issueJson({ tickets: [ticketJson({ winnings, headline: 13 })] })).ok, String(winnings)).toBe(true)
    const detail = detailOf(issueJson({ tickets: [ticketJson({ winnings: 14.02, headline: 14 })] }))
    expect(detail).toBe('tickets[0] (position 2): estimated winnings of 1402 cents do not match buy-in 100 cents x (product of the 3 leg decimals - 1) = 1400.00 cents (off by 2.00; allowed 1)')
    expect(detailOf(issueJson({ tickets: [ticketJson({ winnings: 13.98, headline: 13 })] }))).toMatch(/off by -2\.00/)
    // Paying out the stake as well (decimal odds without the "- 1") is the classic mistake: refused.
    expect(detailOf(issueJson({ tickets: [ticketJson({ winnings: 15.0, headline: 15 })] }))).toMatch(/do not match/)
  })
  it('the real shape of a long ticket passes: 65 cents on fourteen legs', () => {
    const decimals = [2.2, 1.9091, 2.05, 2.75, 1.9091, 1.9091, 2.35, 1.8, 1.9091, 1.9091, 2.6, 2.1, 1.9091, 2.9]
    const winnings = Math.round(expectedPayoutCents(65, decimals)) / 100
    const r = parseIssue(issueJson({ tickets: [ticketJson({ n: 1, site: 'DraftKings', buy_in: 0.65, winnings, headline: Math.floor(winnings / 1000) * 1000, legs: decimals.map((d, i) => leg(d, { line_id: `l${i}` })) })] }))
    expect(r.ok).toBe(true)
  })
  it('the headline is rounded down, never up', () => {
    expect(detailOf(issueJson({ tickets: [ticketJson({ headline: 15 })] }))).toMatch(/headline: 1500 cents is more than the estimated winnings \(1400 cents\)/)
  })
  it('refuses a bad shape, naming the field', () => {
    expect(detailOf(null)).toBe('the body is not a JSON object')
    expect(detailOf([])).toBe('the body is not a JSON object')
    expect(detailOf(issueJson({ issue_date: '2026-13-01' }))).toMatch(/^issue_date: /)
    expect(detailOf(issueJson({ issue_date: '2026-02-30' }))).toMatch(/^issue_date: /)
    expect(detailOf(issueJson({ subject: ' ' }))).toBe('subject: missing')
    expect(detailOf(issueJson({ tickets: [] }))).toMatch(/^tickets: needs 1 to 4 tickets, got 0/)
    expect(detailOf(issueJson({ tickets: [1, 2, 3, 4, 5].map((n) => ticketJson({ n })) }))).toMatch(/got 5/)
    expect(detailOf(issueJson({ tickets: [ticketJson({ n: 5 })] }))).toMatch(/^tickets\[0\]\.n: 5 must be a whole number from 1 to 4/)
    expect(detailOf(issueJson({ tickets: [ticketJson({ n: 1.5 })] }))).toMatch(/^tickets\[0\]\.n: /)
    expect(detailOf(issueJson({ tickets: [ticketJson(), ticketJson()] }))).toBe('tickets: two tickets have the same position (n)')
    expect(detailOf(issueJson({ tickets: [ticketJson({ site: '' })] }))).toBe('tickets[0].site: missing')
    expect(detailOf(issueJson({ tickets: [ticketJson({ legs: [] })] }))).toMatch(/legs: needs 1 to 40 legs, got 0/)
    expect(detailOf(issueJson({ tickets: [ticketJson({ legs: [leg(2, { selection: '' })] })] }))).toBe('tickets[0].legs[0].selection: missing')
    expect(detailOf(issueJson({ tickets: [ticketJson({ legs: [leg(2, { start_et: 'tomorrow' })] })] }))).toMatch(/start_et: "tomorrow" is not a date and time/)
    expect(detailOf(issueJson({ tickets: [ticketJson({ link: 'http://www.prophetx.co/' })] }))).toBe('tickets[0].link: must be an https link')
    expect(detailOf(issueJson({ tickets: [ticketJson({ one_in: 1.5 })] }))).toMatch(/^tickets\[0\]\.one_in: /)
    expect(detailOf(issueJson({ tickets: [ticketJson({ estimated: 'yes' })] }))).toBe('tickets[0].estimated: must be true or false')
  })
  it('a link to a site that is not on the allow-list is stored, with a warning that its button will not redirect', () => {
    const r = parseIssue(issueJson({ tickets: [ticketJson({ link: 'https://example.com/slip' })] }))
    if (!r.ok) throw new Error(r.detail)
    expect(r.issue.tickets[0].link).toBe('https://example.com/slip')
    expect(r.issue.warnings).toHaveLength(1)
    expect(r.issue.warnings[0]).toMatch(/not on the allow-list/)
  })
  it('tickets come out in position order', () => {
    const r = parseIssue(issueJson({ tickets: [ticketJson({ n: 3 }), ticketJson({ n: 1 })] }))
    if (!r.ok) throw new Error(r.detail)
    expect(r.issue.tickets.map((t) => t.position)).toEqual([1, 3])
  })
})

// ------------------------------------------------------------------------------------------------ ingest: storing, and posting again
/** An in-memory sc_issues / sc_tickets / sc_legs, with a wager count per ticket. */
function ingestDb() {
  const state = { issues: new Map<string, unknown>(), tickets: [] as Array<{ id: string; issueDate: string; ticket: IssueTicket; legs: IssueLeg[]; wagers: number }>, next: 1 }
  const store: IngestStore = {
    ticketsForIssue: vi.fn<IngestStore['ticketsForIssue']>(async (issueDate) => state.tickets.filter((t) => t.issueDate === issueDate).map((t): StoredTicket => ({ id: t.id, position: t.ticket.position, site: t.ticket.site, legs: t.legs.map((l) => ({ n: l.n, event: l.event, pick: l.pick, sourceRef: l.sourceRef })), wagers: t.wagers }))),
    upsertIssue: vi.fn<IngestStore['upsertIssue']>(async (issue, source) => void state.issues.set(issue.issueDate, source)),
    upsertTicket: vi.fn<IngestStore['upsertTicket']>(async (issueDate, ticket) => {
      const was = state.tickets.find((t) => t.issueDate === issueDate && t.ticket.position === ticket.position)
      if (was) {
        was.ticket = ticket
        return was.id
      }
      const id = uuid(state.next++)
      state.tickets.push({ id, issueDate, ticket, legs: [], wagers: 0 })
      return id
    }),
    replaceLegs: vi.fn<IngestStore['replaceLegs']>(async (ticketId, legs) => void (state.tickets.find((t) => t.id === ticketId)!.legs = legs)),
    deleteTicket: vi.fn<IngestStore['deleteTicket']>(async (ticketId) => {
      const t = state.tickets.find((x) => x.id === ticketId)!
      if (t.wagers > 0) throw new Error('23503: a ticket with wagers cannot be deleted')
      state.tickets = state.tickets.filter((x) => x.id !== ticketId)
    }),
  }
  return { state, store }
}
const parsed = (body: unknown) => {
  const r = parseIssue(body)
  if (!r.ok) throw new Error(r.detail)
  return r.issue
}
const four = () => issueJson({ tickets: [1, 2, 3, 4].map((n) => ticketJson({ n, name: `Ticket ${n}` })) })

describe('storing an issue', () => {
  it('a first post creates the issue, its tickets and their legs, and hands back each ticket id', async () => {
    const { state, store } = ingestDb()
    const body = four()
    const result = await ingestIssue(parsed(body), body, store)
    expect(result).toEqual({
      ok: true,
      issue_date: '2026-11-20',
      tickets: [1, 2, 3, 4].map((n) => ({ position: n, id: uuid(n), site: 'ProphetX', min_age: 18, action: 'created' })),
      refused: [],
      warnings: [],
    })
    expect(state.issues.get('2026-11-20')).toBe(body)
    expect(state.tickets.map((t) => t.legs.length)).toEqual([3, 3, 3, 3])
  })
  it('posting it again with no wagers replaces the tickets and legs, and every ticket keeps its id', async () => {
    const { state, store } = ingestDb()
    await ingestIssue(parsed(four()), four(), store)
    // The morning rebuild: ticket 2 is a different site with different picks, ticket 4 has one leg fewer.
    const rebuilt = issueJson({
      tickets: [
        ticketJson({ n: 1, name: 'Ticket 1' }),
        ticketJson({ n: 2, site: 'Kalshi', name: 'The Reach', link: 'https://kalshi.com/', legs: [leg(3, { ticker: 'KX-1', line_id: undefined, selection: 'Z to win' }), leg(5, { ticker: 'KX-2', line_id: undefined })] }),
        ticketJson({ n: 3, name: 'Ticket 3' }),
        ticketJson({ n: 4, name: 'Ticket 4', winnings: 5.0, headline: 5, legs: [leg(2, { line_id: 'a' }), leg(3, { line_id: 'b' })] }),
      ],
    })
    const result = await ingestIssue(parsed(rebuilt), rebuilt, store)
    expect(result.refused).toEqual([])
    expect(result.tickets.map((t) => [t.position, t.id, t.action])).toEqual([1, 2, 3, 4].map((n) => [n, uuid(n), 'replaced']))
    expect(result.tickets[1]).toMatchObject({ site: 'Kalshi', min_age: 18 })
    expect(state.tickets[1].ticket.name).toBe('The Reach')
    expect(state.tickets[1].legs.map((l) => l.sourceRef)).toEqual(['KX-1', 'KX-2'])
    expect(state.tickets[3].legs).toHaveLength(2)
    expect(store.deleteTicket).not.toHaveBeenCalled()
  })
  it('a ticket that is no longer in the issue is deleted when nobody has a wager on it', async () => {
    const { state, store } = ingestDb()
    await ingestIssue(parsed(four()), four(), store)
    const three = issueJson({ tickets: [1, 2, 3].map((n) => ticketJson({ n })) })
    const result = await ingestIssue(parsed(three), three, store)
    expect(result.tickets.find((t) => t.position === 4)).toMatchObject({ id: uuid(4), action: 'deleted' })
    expect(state.tickets.map((t) => t.ticket.position)).toEqual([1, 2, 3])
  })
  it('with wagers on a ticket: the same picks are updated in place (name, amounts, prices, link)', async () => {
    const { state, store } = ingestDb()
    await ingestIssue(parsed(four()), four(), store)
    state.tickets[0].wagers = 3
    // Prices moved and the link became an affiliate link; the picks are the same picks.
    const moved = issueJson({
      tickets: [
        ticketJson({ n: 1, name: 'The Renamed', buy_in: 1.0, winnings: 15.5, headline: 15, link: 'https://www.prophetx.co/?aff=1', legs: [leg(2.2, { line_id: 'a', price_text: '45%' }), leg(3, { line_id: 'b', selection: 'C to win', event: 'C at D' }), leg(2.5, { line_id: 'c', selection: 'E +1.5', event: 'E at F' })] }),
        ...[2, 3, 4].map((n) => ticketJson({ n, name: `Ticket ${n}` })),
      ],
    })
    const result = await ingestIssue(parsed(moved), moved, store)
    expect(result.refused).toEqual([])
    expect(result.tickets[0]).toMatchObject({ position: 1, id: uuid(1), action: 'updated_in_place' })
    expect(state.tickets[0].ticket).toMatchObject({ name: 'The Renamed', estPayoutCents: 1550, link: 'https://www.prophetx.co/?aff=1' })
    expect(state.tickets[0].legs[0]).toMatchObject({ priceDecimal: 2.2, priceText: '45%' })
  })
  it('with wagers on a ticket: it is never turned into a different ticket, and the refusal says so', async () => {
    const { state, store } = ingestDb()
    await ingestIssue(parsed(four()), four(), store)
    state.tickets[0].wagers = 2
    state.tickets[1].wagers = 1
    state.tickets[2].wagers = 4
    const before = JSON.stringify(state.tickets.slice(0, 3))
    const changed = issueJson({
      tickets: [
        ticketJson({ n: 1, site: 'Kalshi', link: 'https://kalshi.com/' }), // another site
        ticketJson({ n: 2, legs: [leg(2, { line_id: 'a' }), leg(3, { line_id: 'b', selection: 'C to win', event: 'C at D' }), leg(2.5, { line_id: 'OTHER', selection: 'G to win', event: 'G at H' })] }), // another pick
        ticketJson({ n: 3, winnings: 5.0, headline: 5, legs: [leg(2, { line_id: 'a' }), leg(3, { line_id: 'b', selection: 'C to win', event: 'C at D' })] }), // a leg fewer
        ticketJson({ n: 4, name: 'Free to change', site: 'Polymarket', link: 'https://polymarket.us/' }),
      ],
    })
    const result = await ingestIssue(parsed(changed), changed, store)
    expect(result.refused).toEqual([
      { position: 1, ticket_id: uuid(1), refused: 'repoint', reason: 'has_wagers', wagers: 2, detail: 'site changes from ProphetX to Kalshi; the stored ticket was left as it is' },
      { position: 2, ticket_id: uuid(2), refused: 'repoint', reason: 'has_wagers', wagers: 1, detail: 'leg 3 is a different pick; the stored ticket was left as it is' },
      { position: 3, ticket_id: uuid(3), refused: 'repoint', reason: 'has_wagers', wagers: 4, detail: 'legs change from 3 to 2; the stored ticket was left as it is' },
    ])
    expect(JSON.stringify(state.tickets.slice(0, 3))).toBe(before)
    // The ticket nobody has a wager on is still free to change.
    expect(result.tickets).toEqual([{ position: 4, id: uuid(4), site: 'Polymarket', min_age: 18, action: 'replaced' }])
  })
  it('with wagers on a ticket: it is never deleted', async () => {
    const { state, store } = ingestDb()
    await ingestIssue(parsed(four()), four(), store)
    state.tickets[3].wagers = 1
    const three = issueJson({ tickets: [1, 2, 3].map((n) => ticketJson({ n })) })
    const result = await ingestIssue(parsed(three), three, store)
    expect(result.refused).toEqual([{ position: 4, ticket_id: uuid(4), refused: 'delete', reason: 'has_wagers', wagers: 1, detail: 'this position is not in the new issue; the stored ticket was kept' }])
    expect(store.deleteTicket).not.toHaveBeenCalled()
    expect(state.tickets).toHaveLength(4)
  })
})

// ------------------------------------------------------------------------------------------------ the tracked link
const member = (over: Partial<Member> = {}): Member => ({ id: uuid(100), age: 22, status: 'waitlist', tester: false, dailyRewardCents: 100, rewardDays: 30, extraRewardDays: 0, startedOn: null, referredByMemberId: null, venmoHandle: 'samgold', ...over })
const ticket = (over: Partial<TicketRef> = {}): TicketRef => ({ id: uuid(1), issueDate: '2026-11-20', position: 1, site: 'DraftKings', minAge: 21, link: 'https://sportsbook.draftkings.com/', ...over })
const TOKEN = 'k'.repeat(32)

describe('deciding where a tap goes', () => {
  it('a member old enough for the ticket is sent to the ticket\'s own link', () => {
    expect(decideGo({ ticket: ticket(), hasToken: true, member: member() })).toEqual({ action: 'redirect', url: 'https://sportsbook.draftkings.com/', tap: 'member' })
  })
  it('no token at all is an anonymous tap, and still goes', () => {
    expect(decideGo({ ticket: ticket(), hasToken: false, member: null })).toEqual({ action: 'redirect', url: 'https://sportsbook.draftkings.com/', tap: 'anonymous' })
  })
  it('an unknown ticket, an unknown token and a removed member are refused', () => {
    expect(decideGo({ ticket: null, hasToken: true, member: member() })).toMatchObject({ action: 'refuse', reason: 'unknown_ticket', status: 404 })
    expect(decideGo({ ticket: ticket(), hasToken: true, member: null })).toMatchObject({ action: 'refuse', reason: 'unknown_token', status: 404 })
    expect(decideGo({ ticket: ticket(), hasToken: true, member: member({ status: 'removed' }) })).toMatchObject({ action: 'refuse', reason: 'member_removed', status: 403 })
  })
  it('someone under the ticket\'s minimum age is told so, and not sent on', () => {
    expect(decideGo({ ticket: ticket(), hasToken: true, member: member({ age: 20 }) })).toEqual({ action: 'refuse', reason: 'under_age', status: 403, message: 'This ticket is 21+.' })
    expect(decideGo({ ticket: ticket({ minAge: 18, link: 'https://kalshi.com/' }), hasToken: true, member: member({ age: 20 }) })).toMatchObject({ action: 'redirect' })
    expect(decideGo({ ticket: ticket({ minAge: 21 }), hasToken: true, member: member({ age: 21 }) })).toMatchObject({ action: 'redirect' })
  })
  it('a paused member can still open a ticket', () => {
    expect(decideGo({ ticket: ticket(), hasToken: true, member: member({ status: 'paused' }) })).toMatchObject({ action: 'redirect' })
  })
  it('a link to a host that is not on the allow-list is refused for everyone', () => {
    for (const link of ['https://evil.example/', 'http://kalshi.com/', null]) {
      expect(decideGo({ ticket: ticket({ link }), hasToken: true, member: member() }), String(link)).toMatchObject({ action: 'refuse', reason: 'destination_not_allowed', status: 403 })
      expect(decideGo({ ticket: ticket({ link }), hasToken: false, member: null }), String(link)).toMatchObject({ action: 'refuse', reason: 'destination_not_allowed' })
    }
  })
})

/** An in-memory sc_wagers for taps, with the events written. */
function goDb(i: { ticket?: TicketRef | null; member?: Member | null } = {}) {
  const wagers = new Map<string, { status: Wager['status']; tappedAt: string | null; tapCount: number }>()
  const events: MemberEvent[] = []
  const store = {
    ticketById: vi.fn<GoStore['ticketById']>(async () => (i.ticket === undefined ? ticket() : i.ticket)),
    memberByLinkToken: vi.fn<GoStore['memberByLinkToken']>(async () => (i.member === undefined ? member() : i.member)),
    recordTap: vi.fn<GoStore['recordTap']>(async (memberId, ticketId, at) => {
      const key = `${memberId}:${ticketId}`
      const was = wagers.get(key)
      wagers.set(key, was ? { ...was, tappedAt: was.tappedAt ?? at, tapCount: was.tapCount + 1 } : { status: 'tapped', tappedAt: at, tapCount: 1 })
    }),
    logEvent: vi.fn<GoStore['logEvent']>(async (e) => void events.push(e)),
  }
  return { store, wagers, events }
}

describe('a tap on a tracked link', () => {
  const go = (db: ReturnType<typeof goDb>, over: Partial<{ ticketId: unknown; token: string | null; ipCountry: string | null }> = {}) => handleGo({ ticketId: uuid(1), token: TOKEN, ipCountry: 'US', ...over }, { store: db.store, now })

  it('the first tap makes the wager row, writes an event and redirects; the token is never in the destination', async () => {
    const db = goDb({ ticket: ticket({ link: 'https://www.prophetx.co/?action=addtobetslip&line_ids=a,b', minAge: 18 }) })
    const decision = await go(db)
    expect(decision).toEqual({ action: 'redirect', url: 'https://www.prophetx.co/?action=addtobetslip&line_ids=a,b', tap: 'member' })
    expect(JSON.stringify(decision)).not.toContain(TOKEN)
    expect(db.store.memberByLinkToken).toHaveBeenCalledWith(TOKEN)
    expect(db.wagers.get(`${uuid(100)}:${uuid(1)}`)).toEqual({ status: 'tapped', tappedAt: NOW.toISOString(), tapCount: 1 })
    expect(db.events).toEqual([{ memberId: uuid(100), type: 'tap', ticketId: uuid(1), ipCountry: 'US' }])
    expect(JSON.stringify(db.events)).not.toContain(TOKEN)
  })
  it('a repeat tap only counts: the first tap time and a status past "tapped" stay as they are', async () => {
    const db = goDb()
    db.wagers.set(`${uuid(100)}:${uuid(1)}`, { status: 'verified', tappedAt: '2026-11-20T16:00:00.000Z', tapCount: 2 })
    expect(await go(db)).toMatchObject({ action: 'redirect' })
    expect(await go(db)).toMatchObject({ action: 'redirect' })
    expect(db.wagers.get(`${uuid(100)}:${uuid(1)}`)).toEqual({ status: 'verified', tappedAt: '2026-11-20T16:00:00.000Z', tapCount: 4 })
    expect(db.events.map((e) => e.type)).toEqual(['tap', 'tap'])
  })
  it('an anonymous tap writes an event with no member, makes no wager row and redirects', async () => {
    const db = goDb()
    expect(await go(db, { token: null })).toEqual({ action: 'redirect', url: 'https://sportsbook.draftkings.com/', tap: 'anonymous' })
    expect(db.store.memberByLinkToken).not.toHaveBeenCalled()
    expect(db.store.recordTap).not.toHaveBeenCalled()
    expect(db.events).toEqual([{ memberId: null, type: 'tap', ticketId: uuid(1), ipCountry: 'US', meta: { anonymous: true } }])
  })
  it('an unknown token is refused with nothing recorded; a malformed one (or an unfilled placeholder) never reaches the database', async () => {
    const unknown = goDb({ member: null })
    expect(await go(unknown)).toMatchObject({ action: 'refuse', reason: 'unknown_token', status: 404 })
    expect(unknown.store.recordTap).not.toHaveBeenCalled()
    expect(unknown.events).toEqual([])
    for (const token of ['', 'short', '{{link_token}}', `${'a'.repeat(31)}'`]) {
      const db = goDb()
      expect(await go(db, { token }), token).toMatchObject({ action: 'refuse', reason: 'unknown_token' })
      expect(db.store.memberByLinkToken).not.toHaveBeenCalled()
    }
  })
  it('a removed member is refused: no wager row, and the refusal is in the audit trail', async () => {
    const db = goDb({ member: member({ status: 'removed' }) })
    expect(await go(db)).toMatchObject({ action: 'refuse', reason: 'member_removed' })
    expect(db.store.recordTap).not.toHaveBeenCalled()
    expect(db.events).toEqual([{ memberId: uuid(100), type: 'tap_refused', ticketId: uuid(1), ipCountry: 'US', meta: { reason: 'member_removed' } }])
  })
  it('a 20-year-old tapping a 21+ ticket gets the page, not the sportsbook', async () => {
    const db = goDb({ member: member({ age: 20 }) })
    expect(await go(db)).toEqual({ action: 'refuse', reason: 'under_age', status: 403, message: 'This ticket is 21+.' })
    expect(db.store.recordTap).not.toHaveBeenCalled()
    expect(db.events[0]).toMatchObject({ type: 'tap_refused', meta: { reason: 'under_age' } })
  })
  it('a ticket whose link is not on the allow-list is refused, token or not', async () => {
    const db = goDb({ ticket: ticket({ link: 'https://evil.example/phish' }) })
    expect(await go(db)).toMatchObject({ action: 'refuse', reason: 'destination_not_allowed' })
    expect(await go(db, { token: null })).toMatchObject({ action: 'refuse', reason: 'destination_not_allowed' })
    expect(db.store.recordTap).not.toHaveBeenCalled()
  })
  it('a ticket id that is not an id never reaches the database; an unknown one is refused', async () => {
    for (const ticketId of ['', 'abc', "1' or '1'='1", `${uuid(1)}x`, 42, null]) {
      const db = goDb()
      expect(await go(db, { ticketId }), String(ticketId)).toMatchObject({ action: 'refuse', reason: 'unknown_ticket', status: 404 })
      expect(db.store.ticketById).not.toHaveBeenCalled()
      expect(db.store.memberByLinkToken).not.toHaveBeenCalled()
    }
    const gone = goDb({ ticket: null })
    expect(await go(gone)).toMatchObject({ action: 'refuse', reason: 'unknown_ticket' })
    expect(gone.events).toEqual([])
  })
  it('if the tap cannot be recorded the member is still sent to their ticket', async () => {
    const db = goDb()
    db.store.recordTap.mockRejectedValueOnce(new Error('down'))
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await go(db)).toMatchObject({ action: 'redirect', tap: 'member' })
    quiet.mockRestore()
  })
  it('if the lookups cannot be made it throws (the route answers 503)', async () => {
    const db = goDb()
    db.store.ticketById.mockRejectedValueOnce(new Error('down'))
    await expect(go(db)).rejects.toThrow('down')
  })
})

// ------------------------------------------------------------------------------------------------ THE reward rule
describe('the reward rule', () => {
  const day = '2026-11-25'
  const rule = (m: Partial<Member> = {}, t: Partial<TicketRef> = {}, over: { rewardMinAge?: number; alreadyRewarded?: boolean } = {}) =>
    decideDailyReward({ member: member({ startedOn: '2026-11-20', ...m }), ticket: ticket({ issueDate: day, minAge: 18, ...t }), rewardMinAge: over.rewardMinAge ?? 21, alreadyRewarded: over.alreadyRewarded ?? false })

  it('a member in good standing, old enough, inside their window, not yet rewarded that day: their daily amount', () => {
    expect(rule()).toEqual({ grant: true, amountCents: 100, issueDate: day, windowStart: '2026-11-20', windowEnd: '2026-12-19', startsWindow: false })
    expect(rule({ status: 'active' })).toMatchObject({ grant: true })
  })
  it('a tester earns their own amount by the same rule', () => {
    expect(rule({ tester: true, dailyRewardCents: 500 })).toMatchObject({ grant: true, amountCents: 500 })
  })
  it('paused and removed members earn nothing', () => {
    expect(rule({ status: 'paused' })).toMatchObject({ grant: false, code: 'member_paused' })
    expect(rule({ status: 'removed' })).toMatchObject({ grant: false, code: 'member_removed' })
  })
  it('under the ticket\'s age: a 20-year-old with a slip for a 21+ ticket earns nothing, even if rewards were 18+', () => {
    expect(rule({ age: 20 }, { minAge: 21 }, { rewardMinAge: 18 })).toEqual({ grant: false, code: 'under_ticket_min_age', detail: 'the ticket is 21+ and the member signed up as 20' })
  })
  it('under the reward minimum age: a 20-year-old with a slip for an 18+ ticket earns nothing while rewards are 21+', () => {
    expect(rule({ age: 20 }, { minAge: 18 })).toEqual({ grant: false, code: 'under_reward_min_age', detail: 'rewards are 21+ and the member signed up as 20' })
    expect(rule({ age: 20 }, { minAge: 18 }, { rewardMinAge: 18 })).toMatchObject({ grant: true })
    expect(rule({ age: 21 }, { minAge: 21 })).toMatchObject({ grant: true })
  })
  it('the window is started_on through started_on + reward_days + extra_reward_days - 1, both ends included', () => {
    const edges = (m: Partial<Member>, date: string) => decideDailyReward({ member: member({ startedOn: '2026-11-20', ...m }), ticket: ticket({ issueDate: date, minAge: 18 }), rewardMinAge: 21, alreadyRewarded: false })
    expect(edges({}, '2026-11-19')).toEqual({ grant: false, code: 'before_reward_window', detail: 'the reward window starts 2026-11-20' })
    expect(edges({}, '2026-11-20')).toMatchObject({ grant: true })
    expect(edges({}, '2026-12-19')).toMatchObject({ grant: true, windowEnd: '2026-12-19' })
    expect(edges({}, '2026-12-20')).toEqual({ grant: false, code: 'after_reward_window', detail: 'the reward window ended 2026-12-19' })
    // Ten extra days from two friends push the last day out by ten.
    expect(edges({ extraRewardDays: 10 }, '2026-12-29')).toMatchObject({ grant: true, windowEnd: '2026-12-29' })
    expect(edges({ extraRewardDays: 10 }, '2026-12-30')).toMatchObject({ grant: false, code: 'after_reward_window' })
    expect(edges({ rewardDays: 1 }, '2026-11-20')).toMatchObject({ grant: true, windowEnd: '2026-11-20' })
    expect(edges({ rewardDays: 1 }, '2026-11-21')).toMatchObject({ grant: false, code: 'after_reward_window' })
  })
  it('a member with no started_on starts on this ticket\'s date', () => {
    expect(rule({ startedOn: null })).toEqual({ grant: true, amountCents: 100, issueDate: day, windowStart: day, windowEnd: addDays(day, 29), startsWindow: true })
  })
  it('a day already rewarded is not rewarded again', () => {
    expect(rule({}, {}, { alreadyRewarded: true })).toEqual({ grant: false, code: 'already_rewarded_for_day', detail: `a daily reward for ${day} is already in the ledger` })
  })
  it('no reward days, or a reward of zero, earns nothing', () => {
    expect(rule({ rewardDays: 0 })).toMatchObject({ grant: false, code: 'no_reward_days' })
    // Days from referrals alone are still days.
    expect(rule({ rewardDays: 0, extraRewardDays: 6 })).toMatchObject({ grant: true, windowEnd: '2026-11-25' })
    expect(rule({ rewardDays: 0, extraRewardDays: 5 })).toMatchObject({ grant: false, code: 'after_reward_window' })
    expect(rule({ dailyRewardCents: 0 })).toMatchObject({ grant: false, code: 'no_reward_amount' })
  })
  it('standing is checked before age, age before the window, the window before the duplicate', () => {
    expect(rule({ status: 'removed', age: 18 }, { issueDate: '2027-06-01' }, { alreadyRewarded: true })).toMatchObject({ code: 'member_removed' })
    expect(rule({ age: 18 }, { issueDate: '2027-06-01' }, { alreadyRewarded: true })).toMatchObject({ code: 'under_reward_min_age' })
    expect(rule({}, { issueDate: '2027-06-01' }, { alreadyRewarded: true })).toMatchObject({ code: 'after_reward_window' })
  })
  it('dates add across months and years', () => {
    expect(addDays('2026-11-20', 29)).toBe('2026-12-19')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

// ------------------------------------------------------------------------------------------------ slips, verification, referrals
/** An in-memory newsletter_waitlist / sc_tickets / sc_wagers / sc_rewards / sc_referral_credits that keeps the same unique rules. */
function wagerDb(seed: { members?: Member[]; tickets?: TicketRef[] } = {}) {
  const members = new Map((seed.members ?? [member()]).map((m) => [m.id, { ...m }]))
  const emails = new Map<string, string>()
  const tickets = new Map((seed.tickets ?? [ticket({ minAge: 18, site: 'Kalshi' })]).map((t) => [t.id, t]))
  const wagers = new Map<string, Wager & { slipRef?: string; slipBetId?: string | null; stakeCents?: number | null; verifiedBy?: string; rejectedReason?: string | null }>()
  const rewards: Array<{ id: string; memberId: string; issueDate: string; amountCents: number; wagerId: string }> = []
  const credits = new Map<string, { referrerId: string; qualifiedAt: string | null; daysGranted: number; centsGranted: number; wagerId: string | null }>()
  const referralRewards: Array<{ id: string; memberId: string; wagerId: string; amountCents: number }> = []
  const events: MemberEvent[] = []
  let next = 500
  const store: WagerStore = {
    memberById: async (id) => (members.has(id) ? { ...members.get(id)! } : null),
    memberByEmail: async (email) => (emails.has(email) ? { ...members.get(emails.get(email)!)! } : null),
    ticketById: async (id) => tickets.get(id) ?? null,
    ticketByPosition: async (issueDate, position) => [...tickets.values()].find((t) => t.issueDate === issueDate && t.position === position) ?? null,
    wagerById: async (id) => wagers.get(id) ?? null,
    wagerFor: async (memberId, ticketId) => [...wagers.values()].find((w) => w.memberId === memberId && w.ticketId === ticketId) ?? null,
    saveSlip: async (i) => {
      const was = [...wagers.values()].find((w) => w.memberId === i.memberId && w.ticketId === i.ticketId)
      if (was?.status === 'verified') return 'already_verified'
      if (i.slipBetId && [...wagers.values()].some((w) => w.slipBetId === i.slipBetId && w.id !== was?.id)) return 'duplicate_slip'
      const id = was?.id ?? uuid(next++)
      wagers.set(id, { ...(was ?? { id, memberId: i.memberId, ticketId: i.ticketId }), status: 'submitted', slipRef: i.slipRef, slipBetId: i.slipBetId, stakeCents: i.stakeCents, rejectedReason: null })
      return { wagerId: id }
    },
    markVerified: async (wagerId, verifiedBy) => {
      const w = wagers.get(wagerId)!
      if (w.status !== 'submitted') return false
      wagers.set(wagerId, { ...w, status: 'verified', verifiedBy })
      return true
    },
    markRejected: async (wagerId, reason) => {
      const w = wagers.get(wagerId)!
      if (w.status !== 'tapped' && w.status !== 'submitted') return false
      wagers.set(wagerId, { ...w, status: 'rejected', rejectedReason: reason })
      return true
    },
    hasDailyReward: async (memberId, issueDate) => rewards.some((r) => r.memberId === memberId && r.issueDate === issueDate),
    startRewardWindow: async (memberId, issueDate) => {
      const m = members.get(memberId)!
      if (m.startedOn === null) m.startedOn = issueDate
      return m.startedOn
    },
    insertDailyReward: async (i) => {
      if (rewards.some((r) => r.memberId === i.memberId && r.issueDate === i.issueDate)) return 'duplicate'
      const id = uuid(next++)
      rewards.push({ id, memberId: i.memberId, issueDate: i.issueDate, amountCents: i.amountCents, wagerId: i.wagerId })
      return { rewardId: id }
    },
    referralCredit: async (friendId) => credits.get(friendId) ?? null,
    creditedFriends: async (referrerId) => [...credits.values()].filter((c) => c.referrerId === referrerId && c.qualifiedAt && (c.centsGranted > 0 || c.daysGranted > 0)).length,
    qualifyReferral: async (i) => {
      if (credits.get(i.friendId)?.qualifiedAt) return false
      credits.set(i.friendId, { referrerId: i.referrerId, qualifiedAt: i.nowIso, daysGranted: i.daysGranted, centsGranted: i.centsGranted, wagerId: i.wagerId })
      return true
    },
    insertReferralReward: async (i) => {
      if (referralRewards.some((r) => r.wagerId === i.wagerId)) return 'duplicate'
      const id = uuid(next++)
      referralRewards.push({ id, memberId: i.referrerId, wagerId: i.wagerId, amountCents: i.amountCents })
      return { rewardId: id }
    },
    referralDaysGranted: async (referrerId) => [...credits.values()].filter((c) => c.referrerId === referrerId && c.qualifiedAt).reduce((sum, c) => sum + c.daysGranted, 0),
    raiseExtraRewardDays: async (referrerId, days) => {
      const m = members.get(referrerId)!
      if (m.extraRewardDays < days) m.extraRewardDays = days
    },
    logEvent: async (e) => void events.push(e),
  }
  return { store, members, emails, tickets, wagers, rewards, referralRewards, credits, events }
}
const BY = 'admin@example.com'
const deps = (db: ReturnType<typeof wagerDb>, config = REWARD_DEFAULTS) => ({ store: db.store, config, by: BY, now })
const slip = (over: Record<string, unknown> = {}) => ({ member_id: uuid(100), ticket_id: uuid(1), slip_ref: 'gmail:18c2f', ...over })

describe('recording a slip', () => {
  it('makes the wager "submitted", with the slip, its bet id and the stake', async () => {
    const db = wagerDb()
    const result = await submitSlip(slip({ slip_bet_id: 'DK-991', stake_cents: 65 }), deps(db))
    expect(result).toEqual({ ok: true, wager_id: uuid(500), member_id: uuid(100), ticket_id: uuid(1), status: 'submitted' })
    expect(db.wagers.get(uuid(500))).toMatchObject({ status: 'submitted', slipRef: 'gmail:18c2f', slipBetId: 'DK-991', stakeCents: 65 })
    expect(db.events).toEqual([{ memberId: uuid(100), type: 'slip_submitted', ticketId: uuid(1), meta: { wager_id: uuid(500), by: BY } }])
  })
  it('finds the member by email and the ticket by date and position', async () => {
    const db = wagerDb()
    db.emails.set('sam@school.edu', uuid(100))
    expect(await submitSlip({ email: ' Sam@School.edu ', issue_date: '2026-11-20', position: 1, slip_ref: 'x' }, deps(db))).toMatchObject({ ok: true, member_id: uuid(100), ticket_id: uuid(1) })
  })
  it('a tapped wager becomes submitted; a rejected one can be submitted again', async () => {
    const db = wagerDb()
    db.wagers.set(uuid(7), { id: uuid(7), memberId: uuid(100), ticketId: uuid(1), status: 'tapped' })
    expect(await submitSlip(slip(), deps(db))).toMatchObject({ ok: true, wager_id: uuid(7) })
    await rejectWager({ wager_id: uuid(7), reason: 'blurry' }, deps(db))
    expect(db.wagers.get(uuid(7))).toMatchObject({ status: 'rejected', rejectedReason: 'blurry' })
    expect(await submitSlip(slip({ slip_ref: 'second-try' }), deps(db))).toMatchObject({ ok: true, wager_id: uuid(7) })
    expect(db.wagers.get(uuid(7))).toMatchObject({ status: 'submitted', slipRef: 'second-try', rejectedReason: null })
  })
  it('the same slip cannot be used twice', async () => {
    const other = member({ id: uuid(101) })
    const db = wagerDb({ members: [member(), other] })
    await submitSlip(slip({ slip_bet_id: 'DK-991' }), deps(db))
    expect(await submitSlip(slip({ member_id: uuid(101), slip_bet_id: 'DK-991' }), deps(db))).toMatchObject({ ok: false, error: 'duplicate_slip' })
    expect(db.wagers.size).toBe(1)
  })
  it('refuses what it cannot place', async () => {
    const db = wagerDb()
    expect(await submitSlip(slip({ slip_ref: ' ' }), deps(db))).toMatchObject({ ok: false, error: 'invalid_slip_ref' })
    expect(await submitSlip(slip({ member_id: uuid(999) }), deps(db))).toEqual({ ok: false, error: 'unknown_member' })
    expect(await submitSlip(slip({ ticket_id: uuid(999) }), deps(db))).toEqual({ ok: false, error: 'unknown_ticket' })
    expect(await submitSlip(slip({ member_id: 'not-an-id' }), deps(db))).toEqual({ ok: false, error: 'unknown_member' })
    for (const stake_cents of [0, -5, 0.65, '65', 1e12]) expect(await submitSlip(slip({ stake_cents }), deps(db)), String(stake_cents)).toMatchObject({ ok: false, error: 'invalid_stake' })
    expect(db.wagers.size).toBe(0)
  })
  it('a verified wager is not reopened by another slip', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    await verifyWager(slip(), deps(db))
    expect(await submitSlip(slip({ slip_ref: 'again' }), deps(db))).toEqual({ ok: false, error: 'already_verified' })
  })
})

describe('rejecting a slip', () => {
  it('needs a reason, and marks the wager rejected', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    expect(await rejectWager(slip(), deps(db))).toMatchObject({ ok: false, error: 'invalid_reason' })
    expect(await rejectWager(slip({ reason: 'not this ticket' }), deps(db))).toEqual({ ok: true, wager_id: uuid(500), status: 'rejected' })
    expect(db.rewards).toEqual([])
    // Rejecting again changes nothing and is not an error.
    expect(await rejectWager(slip({ reason: 'still not' }), deps(db))).toMatchObject({ ok: true })
    expect(db.wagers.get(uuid(500))?.rejectedReason).toBe('not this ticket')
  })
  it('a verified wager cannot be rejected, and an unknown one is unknown', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    await verifyWager(slip(), deps(db))
    expect(await rejectWager(slip({ reason: 'changed my mind' }), deps(db))).toMatchObject({ ok: false, error: 'already_verified' })
    expect(db.rewards).toHaveLength(1)
    expect(await rejectWager({ wager_id: uuid(999), reason: 'x' }, deps(db))).toEqual({ ok: false, error: 'unknown_wager' })
  })
})

describe('verifying a slip', () => {
  it('grants the day\'s reward, starts the member\'s window and says exactly what it did', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    const result = await verifyWager(slip(), deps(db))
    expect(result).toEqual({
      ok: true,
      wager_id: uuid(500),
      status: 'verified',
      already_verified: false,
      granted: [{ kind: 'daily', reward_id: uuid(501), member_id: uuid(100), issue_date: '2026-11-20', amount_cents: 100 }],
      withheld: [{ what: 'referral', code: 'no_referrer', detail: 'nobody referred this member' }],
    })
    expect(db.wagers.get(uuid(500))).toMatchObject({ status: 'verified', verifiedBy: BY })
    expect(db.members.get(uuid(100))?.startedOn).toBe('2026-11-20')
    expect(db.rewards).toEqual([{ id: uuid(501), memberId: uuid(100), issueDate: '2026-11-20', amountCents: 100, wagerId: uuid(500) }])
  })
  it('verifying twice grants nothing new', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    await verifyWager(slip(), deps(db))
    const again = await verifyWager({ wager_id: uuid(500) }, deps(db))
    expect(again).toMatchObject({ ok: true, already_verified: true, granted: [] })
    expect(again.ok && again.withheld[0]).toMatchObject({ what: 'daily', code: 'already_rewarded_for_day' })
    expect(db.rewards).toHaveLength(1)
    expect(db.events.filter((e) => e.type === 'wager_verified')).toHaveLength(1)
  })
  it('a second ticket on the same day is verified but earns no second reward', async () => {
    const two = ticket({ id: uuid(2), position: 2, minAge: 18, site: 'Polymarket' })
    const db = wagerDb({ tickets: [ticket({ minAge: 18 }), two] })
    await submitSlip(slip(), deps(db))
    await submitSlip(slip({ ticket_id: uuid(2) }), deps(db))
    await verifyWager(slip(), deps(db))
    const second = await verifyWager(slip({ ticket_id: uuid(2) }), deps(db))
    expect(second).toMatchObject({ ok: true, already_verified: false, granted: [] })
    expect(second.ok && second.withheld[0]).toMatchObject({ code: 'already_rewarded_for_day' })
    expect(db.rewards).toHaveLength(1)
  })
  it('the next day earns the next reward, inside the window started by the first', async () => {
    const tomorrow = ticket({ id: uuid(2), issueDate: '2026-11-21', minAge: 18 })
    const db = wagerDb({ tickets: [ticket({ minAge: 18 }), tomorrow] })
    await submitSlip(slip(), deps(db))
    await verifyWager(slip(), deps(db))
    await submitSlip(slip({ ticket_id: uuid(2) }), deps(db))
    expect(await verifyWager(slip({ ticket_id: uuid(2) }), deps(db))).toMatchObject({ granted: [{ kind: 'daily', issue_date: '2026-11-21', amount_cents: 100 }] })
    expect(db.members.get(uuid(100))?.startedOn).toBe('2026-11-20')
  })
  it('a tester gets their own amount', async () => {
    const db = wagerDb({ members: [member({ tester: true, dailyRewardCents: 500 })] })
    await submitSlip(slip(), deps(db))
    expect(await verifyWager(slip(), deps(db))).toMatchObject({ granted: [{ kind: 'daily', amount_cents: 500 }] })
  })
  it('whatever is withheld comes with a reason code, and the wager is still verified', async () => {
    const cases: Array<[Partial<Member>, Partial<TicketRef>, string]> = [
      [{ status: 'paused' }, {}, 'member_paused'],
      [{ status: 'removed' }, {}, 'member_removed'],
      [{ age: 20 }, { minAge: 21 }, 'under_ticket_min_age'],
      [{ age: 20 }, { minAge: 18 }, 'under_reward_min_age'],
      [{ startedOn: '2026-10-01' }, {}, 'after_reward_window'],
      [{ startedOn: '2026-11-21' }, {}, 'before_reward_window'],
    ]
    for (const [m, t, code] of cases) {
      const db = wagerDb({ members: [member(m)], tickets: [ticket({ minAge: 18, ...t })] })
      await submitSlip(slip(), deps(db))
      const result = await verifyWager(slip(), deps(db))
      expect(result, code).toMatchObject({ ok: true, status: 'verified', granted: [] })
      expect(result.ok && result.withheld[0], code).toMatchObject({ what: 'daily', code })
      expect(db.rewards, code).toEqual([])
      expect(db.wagers.get(uuid(500))?.status, code).toBe('verified')
    }
  })
  it('someone who earns nothing does not have their window started', async () => {
    const db = wagerDb({ members: [member({ age: 19 })] })
    await submitSlip(slip(), deps(db))
    await verifyWager(slip(), deps(db))
    expect(db.members.get(uuid(100))?.startedOn).toBeNull()
  })
  it('rewards can be opened to 18+ with the setting, but never below the ticket\'s own age', async () => {
    const db = wagerDb({ members: [member({ age: 19 })], tickets: [ticket({ minAge: 18 }), ticket({ id: uuid(2), issueDate: '2026-11-21', minAge: 21 })] })
    const open = { ...REWARD_DEFAULTS, rewardMinAge: 18 }
    await submitSlip(slip(), deps(db))
    expect(await verifyWager(slip(), deps(db, open))).toMatchObject({ granted: [{ kind: 'daily' }] })
    await submitSlip(slip({ ticket_id: uuid(2) }), deps(db))
    const sportsbook = await verifyWager(slip({ ticket_id: uuid(2) }), deps(db, open))
    expect(sportsbook.ok && sportsbook.withheld[0]).toMatchObject({ code: 'under_ticket_min_age' })
  })
  it('if another request started the window on a different day, the rule is decided against what is stored', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    // The window was started for 2026-11-21 between this request's read and its write: 2026-11-20 is now before it.
    db.store.startRewardWindow = async () => '2026-11-21'
    const result = await verifyWager(slip(), deps(db))
    expect(result.ok && result.withheld[0]).toMatchObject({ what: 'daily', code: 'before_reward_window' })
    expect(db.rewards).toEqual([])
  })
  it('if the ledger already has the day when the insert lands, nothing is granted', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    db.store.insertDailyReward = async () => 'duplicate'
    const result = await verifyWager(slip(), deps(db))
    expect(result).toMatchObject({ ok: true, granted: [] })
    expect(result.ok && result.withheld[0]).toMatchObject({ code: 'already_rewarded_for_day' })
  })
  it('a run that stopped after marking the wager verified is finished by running it again', async () => {
    const db = wagerDb()
    await submitSlip(slip(), deps(db))
    const insert = db.store.insertDailyReward
    db.store.insertDailyReward = async () => {
      throw new Error('down')
    }
    await expect(verifyWager(slip(), deps(db))).rejects.toThrow('down')
    expect(db.wagers.get(uuid(500))?.status).toBe('verified')
    db.store.insertDailyReward = insert
    expect(await verifyWager(slip(), deps(db))).toMatchObject({ already_verified: true, granted: [{ kind: 'daily', amount_cents: 100 }] })
    expect(db.rewards).toHaveLength(1)
  })
  it('only a wager with a slip can be verified', async () => {
    const db = wagerDb()
    db.wagers.set(uuid(7), { id: uuid(7), memberId: uuid(100), ticketId: uuid(1), status: 'tapped' })
    expect(await verifyWager({ wager_id: uuid(7) }, deps(db))).toMatchObject({ ok: false, error: 'not_submitted' })
    db.wagers.set(uuid(7), { id: uuid(7), memberId: uuid(100), ticketId: uuid(1), status: 'rejected' })
    expect(await verifyWager({ wager_id: uuid(7) }, deps(db))).toMatchObject({ ok: false, error: 'not_submitted' })
    expect(await verifyWager({ wager_id: uuid(999) }, deps(db))).toEqual({ ok: false, error: 'unknown_wager' })
    expect(await verifyWager({}, deps(db))).toEqual({ ok: false, error: 'unknown_wager' })
    expect(db.rewards).toEqual([])
  })
})

describe('referrals: a friend\'s first verified wager pays the referrer $5', () => {
  const REFERRER = uuid(200)
  const friend = (n: number, over: Partial<Member> = {}) => member({ id: uuid(300 + n), referredByMemberId: REFERRER, venmoHandle: `friend${n}`, ...over })
  const setup = (friends: Member[], tickets: TicketRef[] = [ticket({ minAge: 18 })], referrer: Partial<Member> = {}) =>
    wagerDb({ members: [member({ id: REFERRER, startedOn: '2026-11-20', ...referrer }), ...friends], tickets })
  const verifyFor = async (db: ReturnType<typeof wagerDb>, memberId: string, ticketId = uuid(1), config = REWARD_DEFAULTS) => {
    await submitSlip(slip({ member_id: memberId, ticket_id: ticketId }), deps(db, config))
    const result = await verifyWager(slip({ member_id: memberId, ticket_id: ticketId }), deps(db, config))
    if (!result.ok) throw new Error(result.error)
    return result
  }
  const cashFor = (db: ReturnType<typeof wagerDb>) => db.referralRewards.filter((r) => r.memberId === REFERRER).reduce((s, r) => s + r.amountCents, 0)

  it('qualifies the friend and puts $5 in the referrer\'s ledger, tied to the friend\'s wager; no extra days by default', async () => {
    const db = setup([friend(1)])
    const result = await verifyFor(db, uuid(301))
    expect(result.granted).toEqual([
      { kind: 'daily', reward_id: expect.any(String), member_id: uuid(301), issue_date: '2026-11-20', amount_cents: 100 },
      { kind: 'referral_cash', reward_id: expect.any(String), referrer_id: REFERRER, friend_id: uuid(301), amount_cents: 500 },
    ])
    expect(db.referralRewards).toEqual([{ id: expect.any(String), memberId: REFERRER, wagerId: result.wager_id, amountCents: 500 }])
    expect(db.credits.get(uuid(301))).toEqual({ referrerId: REFERRER, qualifiedAt: NOW.toISOString(), daysGranted: 0, centsGranted: 500, wagerId: result.wager_id })
    expect(db.members.get(REFERRER)?.extraRewardDays).toBe(0)
    expect(db.events.find((e) => e.type === 'referral_qualified')).toMatchObject({ memberId: REFERRER, meta: { friend_id: uuid(301), cents: 500, days: 0 } })
  })
  it('only the FIRST verified wager counts: the friend\'s second one pays nothing more', async () => {
    const db = setup([friend(1)], [ticket({ minAge: 18 }), ticket({ id: uuid(2), issueDate: '2026-11-21', minAge: 18 })])
    await verifyFor(db, uuid(301))
    const second = await verifyFor(db, uuid(301), uuid(2))
    expect(second.granted.map((g) => g.kind)).toEqual(['daily'])
    expect(second.withheld).toEqual([{ what: 'referral', code: 'already_qualified', detail: 'this friend already counted for their referrer' }])
    expect(cashFor(db)).toBe(500)
  })
  it('verifying the same wager twice pays nothing more either', async () => {
    const db = setup([friend(1)])
    await verifyFor(db, uuid(301))
    const again = await verifyWager(slip({ member_id: uuid(301) }), deps(db))
    expect(again).toMatchObject({ ok: true, granted: [] })
    expect(cashFor(db)).toBe(500)
    expect(db.credits.size).toBe(1)
  })
  it('a run that stopped after qualifying but before paying is finished by the next run', async () => {
    const db = setup([friend(1)])
    const insert = db.store.insertReferralReward
    db.store.insertReferralReward = async () => {
      throw new Error('network')
    }
    await expect(verifyFor(db, uuid(301))).rejects.toThrow('network')
    expect(cashFor(db)).toBe(0)
    db.store.insertReferralReward = insert
    const again = await verifyWager(slip({ member_id: uuid(301) }), deps(db))
    expect(again.ok && again.granted).toContainEqual({ kind: 'referral_cash', reward_id: expect.any(String), referrer_id: REFERRER, friend_id: uuid(301), amount_cents: 500 })
    expect(cashFor(db)).toBe(500)
  })
  it('five friends pay, $25 at most: the sixth and seventh pay nothing, ever', async () => {
    const friends = [1, 2, 3, 4, 5, 6, 7].map((n) => friend(n))
    const db = setup(friends)
    const paid: number[] = []
    for (const f of friends) {
      const result = await verifyFor(db, f.id)
      const cash = result.granted.find((g) => g.kind === 'referral_cash')
      paid.push(cash && cash.kind === 'referral_cash' ? cash.amount_cents : 0)
      if (!cash) expect(result.withheld).toContainEqual({ what: 'referral', code: 'referrer_cap_reached', detail: 'the referrer already has 5 friends counted' })
    }
    expect(paid).toEqual([500, 500, 500, 500, 500, 0, 0])
    expect(cashFor(db)).toBe(2500)
    expect([...db.credits.values()].every((c) => c.qualifiedAt)).toBe(true)
  })
  it('the friend counts for the referrer even when the friend earns no reward themselves', async () => {
    const db = setup([friend(1, { age: 19 })])
    const result = await verifyFor(db, uuid(301))
    expect(result.granted).toEqual([{ kind: 'referral_cash', reward_id: expect.any(String), referrer_id: REFERRER, friend_id: uuid(301), amount_cents: 500 }])
    expect(result.withheld).toEqual([{ what: 'daily', code: 'under_reward_min_age', detail: expect.any(String) }])
  })
  it('a referrer under the reward minimum age, paused or removed earns nothing, and the friend is used up', async () => {
    for (const referrer of [{ age: 19 }, { status: 'paused' as const }, { status: 'removed' as const }]) {
      const db = setup([friend(1)], undefined, referrer)
      const result = await verifyFor(db, uuid(301))
      expect(result.withheld).toContainEqual({ what: 'referral', code: 'referrer_not_eligible', detail: expect.any(String) })
      expect(cashFor(db)).toBe(0)
      expect(db.credits.get(uuid(301))).toMatchObject({ centsGranted: 0, daysGranted: 0 })
    }
  })
  it('no $5 when the friend has the referrer\'s Venmo username (one person, two signups) or the friend is paused or removed', async () => {
    const same = setup([friend(1, { venmoHandle: '@SamGold' })], undefined, { venmoHandle: 'samgold' })
    expect((await verifyFor(same, uuid(301))).withheld).toContainEqual({ what: 'referral', code: 'referrer_not_eligible', detail: 'the friend and the referrer have the same Venmo username' })
    expect(cashFor(same)).toBe(0)
    const differs = setup([friend(1, { venmoHandle: 'jamie' })], undefined, { venmoHandle: 'samgold' })
    await verifyFor(differs, uuid(301))
    expect(cashFor(differs)).toBe(500)
    const out = setup([friend(1, { status: 'paused' })])
    await submitSlip(slip({ member_id: uuid(301) }), deps(out))
    const r = await verifyWager(slip({ member_id: uuid(301) }), deps(out))
    expect(r.ok && r.withheld).toContainEqual({ what: 'referral', code: 'referrer_not_eligible', detail: 'the friend is paused' })
    expect(cashFor(out)).toBe(0)
  })
  it('the settings change the amount, the cap, and can add days on top', async () => {
    const friends = [1, 2, 3].map((n) => friend(n))
    const db = setup(friends)
    const config = { ...REWARD_DEFAULTS, referralCentsPerFriend: 300, referralDaysPerFriend: 3, referralMaxFriends: 2 }
    for (const f of friends) await verifyFor(db, f.id, uuid(1), config)
    expect(cashFor(db)).toBe(600)
    expect(db.members.get(REFERRER)?.extraRewardDays).toBe(6)
    expect([...db.credits.values()].map((c) => c.daysGranted)).toEqual([3, 3, 0])
  })
  it('extra days set by hand are never lowered', async () => {
    const db = setup([friend(1)])
    db.members.get(REFERRER)!.extraRewardDays = 40
    await verifyFor(db, uuid(301), uuid(1), { ...REWARD_DEFAULTS, referralDaysPerFriend: 5 })
    expect(db.members.get(REFERRER)?.extraRewardDays).toBe(40)
  })
  it('nobody refers themselves', async () => {
    const db = wagerDb({ members: [member({ referredByMemberId: uuid(100) })] })
    await submitSlip(slip(), deps(db))
    const result = await verifyWager(slip(), deps(db))
    expect(result.ok && result.withheld).toContainEqual({ what: 'referral', code: 'self_referral', detail: 'a member cannot refer themselves' })
    expect(db.credits.size).toBe(0)
  })
})

// ------------------------------------------------------------------------------------------------ payouts
function payoutDb(rows: RewardForPayout[]) {
  const state = new Map(rows.map((r) => [r.id, { ...r, batch: null as string | null, paidTo: null as string | null }]))
  const events: MemberEvent[] = []
  const store: PayoutStore = {
    rewardsByIds: vi.fn<PayoutStore['rewardsByIds']>(async (ids) => ids.flatMap((id) => (state.has(id) ? [{ ...state.get(id)! }] : []))),
    markPaid: vi.fn<PayoutStore['markPaid']>(async (id, i) => {
      const r = state.get(id)!
      if (r.paidAt) return false
      state.set(id, { ...r, paidAt: i.paidAt, batch: i.batch, paidTo: i.paidTo })
      return true
    }),
    logEvent: async (e) => void events.push(e),
  }
  return { store, state, events }
}
const reward = (n: number, over: Partial<RewardForPayout> = {}): RewardForPayout => ({ id: uuid(n), memberId: uuid(100), amountCents: 100, paidAt: null, venmoHandle: 'samgold', ...over })

describe('marking rewards paid', () => {
  const pay = (db: ReturnType<typeof payoutDb>, body: unknown) => markRewardsPaid(body, { store: db.store, by: BY, now })

  it('sets paid_at, the batch label and the Venmo username it went to', async () => {
    const db = payoutDb([reward(1), reward(2, { amountCents: 500, memberId: uuid(101), venmoHandle: 'Tester-One' })])
    expect(await pay(db, { reward_ids: [uuid(1), uuid(2)], batch: '2026-11-27 Friday' })).toEqual({
      ok: true,
      batch: '2026-11-27 Friday',
      paid_at: NOW.toISOString(),
      paid: [
        { reward_id: uuid(1), member_id: uuid(100), amount_cents: 100, paid_to: 'samgold' },
        { reward_id: uuid(2), member_id: uuid(101), amount_cents: 500, paid_to: 'Tester-One' },
      ],
      refused: [],
      total_paid_cents: 600,
    })
    expect(db.state.get(uuid(1))).toMatchObject({ paidAt: NOW.toISOString(), batch: '2026-11-27 Friday', paidTo: 'samgold' })
    expect(db.events).toEqual([{ memberId: null, type: 'rewards_paid', meta: { batch: '2026-11-27 Friday', by: BY, count: 2, total_cents: 600 } }])
  })
  it('refuses a reward that is already paid, a member with no Venmo username and an id it does not know, and marks the rest', async () => {
    const db = payoutDb([reward(1), reward(2, { paidAt: '2026-11-20T17:00:00.000Z' }), reward(3, { venmoHandle: null })])
    const result = await pay(db, { reward_ids: [uuid(1), uuid(2), uuid(3), uuid(4)], batch: 'fri-2' })
    expect(result).toMatchObject({
      ok: true,
      paid: [{ reward_id: uuid(1) }],
      refused: [
        { reward_id: uuid(2), reason: 'already_paid' },
        { reward_id: uuid(3), reason: 'no_venmo_handle' },
        { reward_id: uuid(4), reason: 'unknown_reward' },
      ],
      total_paid_cents: 100,
    })
    expect(db.store.markPaid).toHaveBeenCalledTimes(1)
    expect(db.state.get(uuid(2))?.paidAt).toBe('2026-11-20T17:00:00.000Z')
    expect(db.state.get(uuid(3))?.paidAt).toBeNull()
  })
  it('marking the same batch twice pays nothing twice', async () => {
    const db = payoutDb([reward(1)])
    await pay(db, { reward_ids: [uuid(1)], batch: 'fri-1' })
    const again = await pay(db, { reward_ids: [uuid(1)], batch: 'fri-1-again' })
    expect(again).toMatchObject({ ok: true, paid: [], refused: [{ reward_id: uuid(1), reason: 'already_paid' }], total_paid_cents: 0 })
    expect(db.state.get(uuid(1))?.batch).toBe('fri-1')
    expect(db.events).toHaveLength(1)
  })
  it('a reward paid by someone else between the read and the write is refused, not counted', async () => {
    const db = payoutDb([reward(1)])
    vi.mocked(db.store.markPaid).mockResolvedValueOnce(false)
    expect(await pay(db, { reward_ids: [uuid(1)], batch: 'fri-1' })).toMatchObject({ paid: [], refused: [{ reward_id: uuid(1), reason: 'already_paid' }], total_paid_cents: 0 })
  })
  it('needs a batch label and a list of different reward ids', async () => {
    const db = payoutDb([reward(1)])
    for (const batch of [undefined, '', ' ', 'x'.repeat(61), 'drop; table', 7]) expect(await pay(db, { reward_ids: [uuid(1)], batch }), String(batch)).toMatchObject({ ok: false, error: 'invalid_batch' })
    for (const reward_ids of [undefined, [], 'all', [uuid(1), uuid(1)], [uuid(1), 'nope'], Array.from({ length: 501 }, (_, i) => uuid(i + 1))]) expect(await pay(db, { reward_ids, batch: 'fri-1' }), String(reward_ids).slice(0, 40)).toMatchObject({ ok: false, error: 'invalid_reward_ids' })
    expect(await pay(db, null)).toMatchObject({ ok: false, error: 'invalid_batch' })
    expect(db.store.markPaid).not.toHaveBeenCalled()
  })
})

// ------------------------------------------------------------------------------------------------ settle
describe('reading graded results', () => {
  const body = (tickets: unknown[], over: Record<string, unknown> = {}) => ({ issue_date: '2026-11-20', tickets, ...over })
  const legs = (...results: string[]) => results.map((result, i) => ({ n: i + 1, result }))

  it('a ticket\'s result follows from its legs', () => {
    expect(ticketResultFromLegs(['hit', 'hit'])).toBe('won')
    expect(ticketResultFromLegs(['hit', 'miss', 'pending'])).toBe('lost')
    expect(ticketResultFromLegs(['hit', 'pending'])).toBe('pending')
    expect(ticketResultFromLegs(['hit', 'ungraded'])).toBe('pending')
    expect(ticketResultFromLegs(['hit', 'void'])).toBe('won')
    expect(ticketResultFromLegs(['void', 'void'])).toBe('void')
  })
  it('maps the pipeline\'s words: push is a void leg; Hit, Miss and Pending are won, lost and pending', () => {
    const r = parseSettle(body([
      { position: 1, result: 'Miss', legs: legs('hit', 'miss', 'pending') },
      { position: 2, result: 'Pending', legs: legs('hit', 'ungraded') },
      { position: 3, result: 'Hit', legs: legs('hit', 'push') },
      { position: 4, legs: legs('void', 'push') },
    ]))
    expect(r).toEqual({
      ok: true,
      issueDate: '2026-11-20',
      tickets: [
        { position: 1, result: 'lost', legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'miss' }, { n: 3, result: 'pending' }] },
        { position: 2, result: 'pending', legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'ungraded' }] },
        { position: 3, result: 'won', legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'void' }] },
        { position: 4, result: 'void', legs: [{ n: 1, result: 'void' }, { n: 2, result: 'void' }] },
      ],
    })
  })
  it('a ticket is never marked won (or lost) against its own legs', () => {
    const won = parseSettle(body([{ position: 1, result: 'won', legs: legs('hit', 'pending') }]))
    expect(won).toEqual({ ok: false, error: 'invalid_settle', detail: "tickets[0] (position 1): result 'won' does not follow from its legs, which make it 'pending'" })
    expect(parseSettle(body([{ position: 1, result: 'won', legs: legs('hit', 'miss') }]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 1, result: 'lost', legs: legs('hit', 'hit') }]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 1, result: 'pending', legs: legs('hit', 'hit') }]))).toMatchObject({ ok: false })
  })
  it('refuses a bad shape', () => {
    expect(parseSettle(null)).toMatchObject({ ok: false, error: 'invalid_settle' })
    expect(parseSettle(body([{ position: 1, legs: legs('hit') }], { issue_date: 'yesterday' }))).toMatchObject({ ok: false })
    expect(parseSettle(body([]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 5, legs: legs('hit') }]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 1, legs: [] }]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 1, legs: legs('won') }]))).toMatchObject({ ok: false, detail: 'tickets[0].legs[0].result: "won" is not a leg result' })
    expect(parseSettle(body([{ position: 1, result: 'cashed', legs: legs('hit') }]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 1, legs: [{ n: 1, result: 'hit' }, { n: 1, result: 'hit' }] }]))).toMatchObject({ ok: false })
    expect(parseSettle(body([{ position: 1, legs: legs('hit') }, { position: 1, legs: legs('hit') }]))).toMatchObject({ ok: false })
  })
})

describe('what a won wager paid', () => {
  it('is the stake times (product of the legs that hit - 1), in whole cents', () => {
    expect(wonPayoutCents(100, [{ priceDecimal: 2, result: 'hit' }, { priceDecimal: 3, result: 'hit' }, { priceDecimal: 2.5, result: 'hit' }])).toBe(1400)
    expect(wonPayoutCents(65, [{ priceDecimal: 2.2, result: 'hit' }, { priceDecimal: 1.9091, result: 'hit' }])).toBe(208)
  })
  it('a void leg drops out; no stake, no figure', () => {
    expect(wonPayoutCents(100, [{ priceDecimal: 2, result: 'hit' }, { priceDecimal: 3, result: 'void' }])).toBe(100)
    expect(wonPayoutCents(null, [{ priceDecimal: 2, result: 'hit' }])).toBeNull()
  })
})

function settleDb() {
  const tickets = [
    { id: uuid(1), position: 1, legs: [{ n: 1, priceDecimal: 2 }, { n: 2, priceDecimal: 3 }, { n: 3, priceDecimal: 2.5 }] },
    { id: uuid(2), position: 2, legs: [{ n: 1, priceDecimal: 2 }, { n: 2, priceDecimal: 4 }] },
  ]
  const legResults = new Map<string, string>()
  const ticketResults = new Map<string, { result: string; settledAt: string | null }>()
  const wagers = new Map<string, { ticketId: string; stakeCents: number | null; result: string; payoutCents: number | null }>([
    [uuid(11), { ticketId: uuid(1), stakeCents: 100, result: 'pending', payoutCents: null }],
    [uuid(12), { ticketId: uuid(1), stakeCents: 65, result: 'pending', payoutCents: null }],
    [uuid(13), { ticketId: uuid(1), stakeCents: null, result: 'pending', payoutCents: null }],
    [uuid(14), { ticketId: uuid(1), stakeCents: 100, result: 'pending', payoutCents: null }],
    [uuid(21), { ticketId: uuid(2), stakeCents: 100, result: 'pending', payoutCents: null }],
  ])
  const store: SettleStore = {
    ticketsWithLegs: vi.fn<SettleStore['ticketsWithLegs']>(async (issueDate) => (issueDate === '2026-11-20' ? tickets : [])),
    setLegResults: vi.fn<SettleStore['setLegResults']>(async (ticketId, legs) => void legs.forEach((l) => legResults.set(`${ticketId}:${l.n}`, l.result))),
    setTicketResult: vi.fn<SettleStore['setTicketResult']>(async (ticketId, result, settledAt) => void ticketResults.set(ticketId, { result, settledAt })),
    wagersForTicket: vi.fn<SettleStore['wagersForTicket']>(async (ticketId) => [...wagers].filter(([, w]) => w.ticketId === ticketId).map(([id, w]) => ({ id, stakeCents: w.stakeCents }))),
    setWagerResults: vi.fn<SettleStore['setWagerResults']>(async (ids, result, payoutCents) => void ids.forEach((id) => wagers.set(id, { ...wagers.get(id)!, result, payoutCents }))),
  }
  return { store, legResults, ticketResults, wagers }
}
const settled = (body: unknown) => {
  const r = parseSettle(body)
  if (!r.ok) throw new Error(r.detail)
  return r
}

describe('writing graded results', () => {
  const graded = {
    issue_date: '2026-11-20',
    tickets: [
      { position: 1, result: 'Hit', legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'hit' }, { n: 3, result: 'hit' }] },
      { position: 2, result: 'Miss', legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'miss' }] },
    ],
  }
  it('sets each leg, each ticket and every wager on it; a won wager with a stake gets its payout', async () => {
    const db = settleDb()
    expect(await settleIssue(settled(graded), { store: db.store, now })).toEqual({
      ok: true,
      issue_date: '2026-11-20',
      tickets: [
        { position: 1, ticket_id: uuid(1), result: 'won', legs_updated: 3, wagers_updated: 4, wagers_with_payout: 3 },
        { position: 2, ticket_id: uuid(2), result: 'lost', legs_updated: 2, wagers_updated: 1, wagers_with_payout: 0 },
      ],
    })
    expect(Object.fromEntries(db.legResults)).toEqual({ [`${uuid(1)}:1`]: 'hit', [`${uuid(1)}:2`]: 'hit', [`${uuid(1)}:3`]: 'hit', [`${uuid(2)}:1`]: 'hit', [`${uuid(2)}:2`]: 'miss' })
    expect(db.ticketResults.get(uuid(1))).toEqual({ result: 'won', settledAt: NOW.toISOString() })
    expect(db.ticketResults.get(uuid(2))).toEqual({ result: 'lost', settledAt: NOW.toISOString() })
    expect(db.wagers.get(uuid(11))).toMatchObject({ result: 'won', payoutCents: 1400 })
    expect(db.wagers.get(uuid(12))).toMatchObject({ result: 'won', payoutCents: 910 })
    expect(db.wagers.get(uuid(13))).toMatchObject({ result: 'won', payoutCents: null })
    expect(db.wagers.get(uuid(14))).toMatchObject({ result: 'won', payoutCents: 1400 })
    expect(db.wagers.get(uuid(21))).toMatchObject({ result: 'lost', payoutCents: null })
  })
  it('a ticket still pending is not settled, and can be posted again later', async () => {
    const db = settleDb()
    const early = { issue_date: '2026-11-20', tickets: [{ position: 1, result: 'Pending', legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'pending' }, { n: 3, result: 'ungraded' }] }] }
    await settleIssue(settled(early), { store: db.store, now })
    expect(db.ticketResults.get(uuid(1))).toEqual({ result: 'pending', settledAt: null })
    expect(db.wagers.get(uuid(11))).toMatchObject({ result: 'pending', payoutCents: null })
    await settleIssue(settled({ issue_date: '2026-11-20', tickets: [graded.tickets[0]] }), { store: db.store, now })
    expect(db.ticketResults.get(uuid(1))?.result).toBe('won')
    expect(db.wagers.get(uuid(11))).toMatchObject({ result: 'won', payoutCents: 1400 })
  })
  it('a push pays the ticket at the remaining legs', async () => {
    const db = settleDb()
    await settleIssue(settled({ issue_date: '2026-11-20', tickets: [{ position: 1, legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'push' }, { n: 3, result: 'hit' }] }] }), { store: db.store, now })
    expect(db.legResults.get(`${uuid(1)}:2`)).toBe('void')
    expect(db.wagers.get(uuid(11))).toMatchObject({ result: 'won', payoutCents: 400 })
  })
  it('a correction from won to lost clears the payout', async () => {
    const db = settleDb()
    await settleIssue(settled({ issue_date: '2026-11-20', tickets: [graded.tickets[0]] }), { store: db.store, now })
    await settleIssue(settled({ issue_date: '2026-11-20', tickets: [{ position: 1, legs: [{ n: 1, result: 'hit' }, { n: 2, result: 'miss' }, { n: 3, result: 'hit' }] }] }), { store: db.store, now })
    expect(db.wagers.get(uuid(11))).toMatchObject({ result: 'lost', payoutCents: null })
  })
  it('changes nothing unless every ticket and leg in the body exists', async () => {
    const db = settleDb()
    expect(await settleIssue(settled({ ...graded, issue_date: '2026-11-19' }), { store: db.store, now })).toMatchObject({ ok: false, error: 'unknown_issue' })
    expect(await settleIssue(settled({ issue_date: '2026-11-20', tickets: [graded.tickets[0], { position: 3, legs: [{ n: 1, result: 'hit' }] }] }), { store: db.store, now })).toMatchObject({ ok: false, error: 'unknown_ticket' })
    expect(await settleIssue(settled({ issue_date: '2026-11-20', tickets: [{ position: 2, legs: [{ n: 1, result: 'hit' }, { n: 9, result: 'hit' }] }] }), { store: db.store, now })).toMatchObject({ ok: false, error: 'unknown_leg', detail: 'position 2 has no leg 9' })
    expect(await settleIssue(settled({ issue_date: '2026-11-20', tickets: [{ position: 2, legs: [{ n: 1, result: 'hit' }] }] }), { store: db.store, now })).toMatchObject({ ok: false, error: 'unknown_leg' })
    expect(db.store.setLegResults).not.toHaveBeenCalled()
    expect(db.store.setTicketResult).not.toHaveBeenCalled()
    expect(db.store.setWagerResults).not.toHaveBeenCalled()
  })
})
