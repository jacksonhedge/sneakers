import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeRoundUpCents, roundUpsFor, accruedCents, thresholdReached, transferableCents,
  type RoundUpRule, type Txn,
} from './engine.js'

const rule: RoundUpRule = { roundToCents: 100, multiplier: 1, thresholdCents: 500, weeklyCapCents: 2000 }

test('computeRoundUpCents rounds up to the nearest unit', () => {
  assert.equal(computeRoundUpCents(420, 100, 1), 80) // $4.20 -> $0.80
  assert.equal(computeRoundUpCents(399, 100, 1), 1)  // $3.99 -> $0.01
})

test('computeRoundUpCents returns 0 on an exact multiple', () => {
  assert.equal(computeRoundUpCents(500, 100, 1), 0)
})

test('computeRoundUpCents applies the multiplier', () => {
  assert.equal(computeRoundUpCents(420, 100, 5), 400) // 80 * 5
})

test('roundUpsFor maps each txn to its round-up', () => {
  const txns: Txn[] = [
    { id: 'a', merchant: 'Coffee', amountCents: 420, date: '2026-06-20' },
    { id: 'b', merchant: 'Rideshare', amountCents: 1899, date: '2026-06-20' },
    { id: 'c', merchant: 'Even', amountCents: 500, date: '2026-06-20' },
  ]
  assert.deepEqual(roundUpsFor(txns, rule), [
    { txnId: 'a', roundUpCents: 80 },
    { txnId: 'b', roundUpCents: 1 },
    { txnId: 'c', roundUpCents: 0 },
  ])
})

test('accruedCents sums round-ups', () => {
  assert.equal(accruedCents([{ txnId: 'a', roundUpCents: 80 }, { txnId: 'b', roundUpCents: 1 }]), 81)
})

test('thresholdReached is false below threshold, true at/above', () => {
  assert.equal(thresholdReached(499, rule), false)
  assert.equal(thresholdReached(500, rule), true)
  assert.equal(thresholdReached(900, rule), true)
})

test('transferableCents transfers the accrued amount when under the weekly cap', () => {
  assert.equal(transferableCents(1500, rule, 0), 1500)
})

test('transferableCents clamps to remaining weekly cap', () => {
  assert.equal(transferableCents(1500, rule, 1000), 1000) // cap 2000, 1000 used
})

test('transferableCents never goes negative', () => {
  assert.equal(transferableCents(1500, rule, 2000), 0)
})
