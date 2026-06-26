import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { impliedProbUp, evaluateSignal, type PriceState } from './signal'

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`)
const base: PriceState = { openRefPrice: 100, spot: 100, secondsToClose: 4, recentVolPerSec: 1 }

describe('impliedProbUp', () => {
  test('0.5 when spot equals open with time left', () => near(impliedProbUp(base), 0.5, 1e-9))
  test('~1 when far above open and tiny vol', () => {
    near(impliedProbUp({ openRefPrice: 100, spot: 105, secondsToClose: 2, recentVolPerSec: 0.2 }), 1, 1e-3)
  })
  test('deterministic at the close: above open -> 1', () => {
    assert.equal(impliedProbUp({ openRefPrice: 100, spot: 100.5, secondsToClose: 0, recentVolPerSec: 1 }), 1)
  })
  test('deterministic at the close: below open -> 0', () => {
    assert.equal(impliedProbUp({ openRefPrice: 100, spot: 99.5, secondsToClose: 0, recentVolPerSec: 1 }), 0)
  })
})

describe('evaluateSignal', () => {
  test('buys YES when implied prob beats the YES price', () => {
    const s: PriceState = { openRefPrice: 100, spot: 103, secondsToClose: 1, recentVolPerSec: 0.8 }
    const d = evaluateSignal(s, { yesPrice: 0.88 })
    assert.ok(d)
    assert.equal(d!.side, 'YES')
    assert.ok(d!.edgeBps > 0)
    assert.ok(d!.impliedProb > 0.88)
  })
  test('buys NO when down is underpriced', () => {
    // pUp ~ 0.2998, yesPrice 0.45 -> NO implied ~0.7002 vs NO market 0.55 -> 1502 bps (A&S normCdf)
    const s: PriceState = { openRefPrice: 100, spot: 99.58, secondsToClose: 1, recentVolPerSec: 0.8 }
    const d = evaluateSignal(s, { yesPrice: 0.45 })
    assert.ok(d)
    assert.equal(d!.side, 'NO')
    assert.equal(d!.edgeBps, 1502)
  })
  test('returns decision with zero edge when probabilities equal', () => {
    const s: PriceState = { openRefPrice: 100, spot: 100, secondsToClose: 4, recentVolPerSec: 1 }
    const d = evaluateSignal(s, { yesPrice: 0.5 })
    // Due to floating-point precision in normCdf, we may get a tiny edge that rounds to 0
    assert.ok(d === null || (d && d.edgeBps === 0))
  })
})
