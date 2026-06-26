import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { settleTrade, type Fill } from './settle'

describe('settleTrade', () => {
  test('YES wins when outcome is up: profit = size*(1-entry)/entry', () => {
    const fill: Fill = { side: 'YES', sizeUsdc: 88, entryPrice: 0.88 }
    // shares = 100, payout = 100, pnl = 12.00
    assert.deepEqual(settleTrade(fill, { outcome: 'up' }), { status: 'won', pnlUsdc: 12 })
  })
  test('YES loses when outcome is down: pnl = -size', () => {
    const fill: Fill = { side: 'YES', sizeUsdc: 88, entryPrice: 0.88 }
    assert.deepEqual(settleTrade(fill, { outcome: 'down' }), { status: 'lost', pnlUsdc: -88 })
  })
  test('NO wins when outcome is down', () => {
    const fill: Fill = { side: 'NO', sizeUsdc: 55, entryPrice: 0.55 }
    // shares = 100, payout = 100, pnl = 45.00
    assert.deepEqual(settleTrade(fill, { outcome: 'down' }), { status: 'won', pnlUsdc: 45 })
  })
  test('NO loses when outcome is up', () => {
    const fill: Fill = { side: 'NO', sizeUsdc: 55, entryPrice: 0.55 }
    assert.deepEqual(settleTrade(fill, { outcome: 'up' }), { status: 'lost', pnlUsdc: -55 })
  })
  test('pnl rounded to cents', () => {
    const fill: Fill = { side: 'YES', sizeUsdc: 10, entryPrice: 0.93 }
    // pnl = 10*(0.07/0.93) = 0.752688... -> 0.75
    assert.deepEqual(settleTrade(fill, { outcome: 'up' }), { status: 'won', pnlUsdc: 0.75 })
  })
})
