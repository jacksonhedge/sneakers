import { afterEach, describe, expect, it, vi } from 'vitest'
import { ipLimiter, requestIp } from './ip-limit'

afterEach(() => vi.useRealTimers())

describe('the per-address limit', () => {
  it('allows `max` hits a minute per address, then refuses until the minute passes', () => {
    vi.useFakeTimers()
    const allowed = ipLimiter(5)
    for (let i = 0; i < 5; i++) expect(allowed('1.1.1.1')).toBe(true)
    expect(allowed('1.1.1.1')).toBe(false)
    expect(allowed('2.2.2.2')).toBe(true)
    vi.advanceTimersByTime(60_001)
    expect(allowed('1.1.1.1')).toBe(true)
  })
  it('reads the first forwarded address', () => {
    expect(requestIp(new Headers({ 'x-forwarded-for': ' 1.1.1.1 , 10.0.0.1' }))).toBe('1.1.1.1')
    expect(requestIp(new Headers())).toBe('unknown')
  })
})
