import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { secondsToClose, windowStatus, type MarketWindow } from './window'

const w: MarketWindow = {
  venue: 'polymarket', asset: 'BTC', intervalSec: 300,
  opensAt: 1_000_000, closesAt: 1_300_000, referenceOracle: 'chainlink:BTC-USD',
  openRefPrice: null, settleRefPrice: null,
}

describe('secondsToClose', () => {
  test('floors remaining seconds', () => {
    assert.equal(secondsToClose(w, 1_299_400), 0) // 600ms left -> 0
    assert.equal(secondsToClose(w, 1_295_000), 5)
  })
  test('never negative', () => {
    assert.equal(secondsToClose(w, 1_400_000), 0)
  })
})

describe('windowStatus', () => {
  test('upcoming before open', () => assert.equal(windowStatus(w, 999_999), 'upcoming'))
  test('live during window', () => assert.equal(windowStatus(w, 1_150_000), 'live'))
  test('settled at/after close', () => {
    assert.equal(windowStatus(w, 1_300_000), 'settled')
    assert.equal(windowStatus(w, 1_400_000), 'settled')
  })
})
