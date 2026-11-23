import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DAILY,
  hashKey,
  keyFromHeaders,
  newApiKey,
  parseLimit,
  perKeyMinuteLimiter,
  picksResponse,
  requestedDate,
  type PicksLegRow,
  type PicksTicketRow,
} from './spare-change-api'

describe('newApiKey', () => {
  it('makes an scm_ key, a short prefix and the hash of the whole key', () => {
    const k = newApiKey()
    expect(k.key).toMatch(/^scm_[A-Za-z0-9_-]{43}$/)
    expect(k.prefix).toBe(k.key.slice(0, 10))
    expect(k.hash).toBe(hashKey(k.key))
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('never repeats', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newApiKey().key))
    expect(keys.size).toBe(200)
  })
})

describe('keyFromHeaders', () => {
  const key = newApiKey().key
  it('reads a bearer token or X-API-Key', () => {
    expect(keyFromHeaders(new Headers({ authorization: `Bearer ${key}` }))).toEqual({ ok: true, key })
    expect(keyFromHeaders(new Headers({ 'x-api-key': key }))).toEqual({ ok: true, key })
  })
  it('says missing or malformed', () => {
    expect(keyFromHeaders(new Headers())).toEqual({ ok: false, error: 'missing' })
    expect(keyFromHeaders(new Headers({ authorization: 'Bearer nope' }))).toEqual({ ok: false, error: 'malformed' })
    expect(keyFromHeaders(new Headers({ 'x-api-key': `${key}x` }))).toEqual({ ok: false, error: 'malformed' })
  })
})

describe('parseLimit', () => {
  it('uses the default when blank and refuses out-of-range or junk', () => {
    expect(parseLimit('', DEFAULT_DAILY, 100_000)).toBe(DEFAULT_DAILY)
    expect(parseLimit('5,000', 1, 100_000)).toBe(5000)
    expect(parseLimit('0', 1, 100)).toBeNull()
    expect(parseLimit('101', 1, 100)).toBeNull()
    expect(parseLimit('1.5', 1, 100)).toBeNull()
  })
})

describe('perKeyMinuteLimiter', () => {
  it('allows max per minute per key, then frees up', () => {
    const may = perKeyMinuteLimiter()
    expect(may('a', 2, 0)).toBe(true)
    expect(may('a', 2, 1)).toBe(true)
    expect(may('a', 2, 2)).toBe(false)
    expect(may('b', 2, 2)).toBe(true)
    expect(may('a', 2, 60_001)).toBe(true)
  })
})

describe('requestedDate', () => {
  const today = '2026-11-23'
  it('defaults to latest', () => {
    expect(requestedDate(null, today)).toEqual({ ok: true, date: null })
    expect(requestedDate('latest', today)).toEqual({ ok: true, date: null })
  })
  it('allows today and the past, never tomorrow', () => {
    expect(requestedDate('2026-11-23', today)).toEqual({ ok: true, date: '2026-11-23' })
    expect(requestedDate('2026-11-01', today)).toEqual({ ok: true, date: '2026-11-01' })
    expect(requestedDate('2026-11-24', today)).toEqual({ ok: false, error: 'not_published' })
  })
  it('refuses non-dates', () => {
    expect(requestedDate('2026-02-30', today)).toEqual({ ok: false, error: 'bad_date' })
    expect(requestedDate('11/23/2026', today)).toEqual({ ok: false, error: 'bad_date' })
  })
})

describe('picksResponse', () => {
  const ticket = (id: string, position: number, link: string | null): PicksTicketRow => ({
    id, position, site: 'ProphetX', name: `T${position}`, buy_in_cents: 100, est_payout_cents: 15000, headline_cents: 15000,
    one_in: 150, min_age: 18, link, estimated: true, result: 'pending',
  })
  const leg = (ticket_id: string, n: number): PicksLegRow => ({
    ticket_id, n, sport: 'NBA', league: 'NBA', event: 'A @ B', starts_at: null, market: 'Moneyline', pick: 'A', price_text: '+150',
    price_decimal: '2.5000', result: 'pending',
  })

  it('orders tickets and legs, turns numeric strings into numbers, and keeps the partner code on the slip link', () => {
    const link = 'https://www.prophetx.co/?action=addtobetslip&line_ids=1,2&partner_id=SNEAKERS'
    const r = picksResponse({ issue_date: '2026-11-23', issue_no: 4, subject: 'Today' }, [ticket('b', 2, null), ticket('a', 1, link)], [leg('a', 2), leg('a', 1)])
    expect(r.tickets.map((t) => t.position)).toEqual([1, 2])
    expect(r.tickets[0].legs.map((l) => l.n)).toEqual([1, 2])
    expect(r.tickets[0].legs[0].price_decimal).toBe(2.5)
    expect(r.tickets[0].slip_link).toContain('partner_id=SNEAKERS')
    expect(r.tickets[1].slip_link).toBeNull()
    expect(r.attribution).toBeTruthy()
    expect(r.responsible_gaming).toContain('1-800-GAMBLER')
  })

  it('drops a slip link to a site not on the allow-list', () => {
    const r = picksResponse({ issue_date: '2026-11-23', issue_no: null, subject: 'x' }, [ticket('a', 1, 'https://evil.example/?x=1')], [])
    expect(r.tickets[0].slip_link).toBeNull()
  })
})
