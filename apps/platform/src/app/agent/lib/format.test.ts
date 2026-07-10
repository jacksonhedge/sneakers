import { describe, it, expect } from 'vitest'
import { formatMoney, formatMoneyWhole, formatSigned, formatPerf } from './format'

describe('format', () => {
  it('formats cents as dollars', () => {
    expect(formatMoney(124762)).toBe('$1,247.62')
    expect(formatMoney(0)).toBe('$0.00')
  })
  it('formats whole-dollar for the tab bar', () => {
    expect(formatMoneyWhole(124762)).toBe('$1,248')
  })
  it('formats signed money', () => {
    expect(formatSigned(3814)).toBe('+$38.14')
    expect(formatSigned(-1248)).toBe('−$12.48')
  })
  it('formats perf or em-dash', () => {
    expect(formatPerf(14.6)).toBe('+14.6%')
    expect(formatPerf(null)).toBe('—')
  })
  it('formatMoney and formatMoneyWhole handle negatives with U+2212', () => {
    expect(formatMoney(-1248)).toBe('−$12.48')
    expect(formatMoneyWhole(-124762)).toBe('−$1,248')
  })
  it('formatPerf uses U+2212 for negative perf', () => {
    expect(formatPerf(-3.2)).toBe('−3.2%')
  })
})
