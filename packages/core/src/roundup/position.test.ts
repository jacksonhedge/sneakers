import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePositionPnlCents } from './position.js'

test('computePositionPnlCents is zero when price is unchanged', () => {
  assert.equal(computePositionPnlCents(0.5, 0.5, 1000), 0)
})

test('computePositionPnlCents is positive when price rises', () => {
  // entry 0.50 -> current 0.60, size 1000c: pnl = ((0.60-0.50)/0.50)*1000 = 200
  assert.equal(computePositionPnlCents(0.5, 0.6, 1000), 200)
})

test('computePositionPnlCents is negative when price falls', () => {
  // entry 0.50 -> current 0.40, size 1000c: pnl = ((0.40-0.50)/0.50)*1000 = -200
  assert.equal(computePositionPnlCents(0.5, 0.4, 1000), -200)
})

test('computePositionPnlCents rounds to the nearest cent', () => {
  // entry 0.30 -> current 0.31, size 500c: ((0.01)/0.30)*500 = 16.666... -> 17
  assert.equal(computePositionPnlCents(0.3, 0.31, 500), 17)
})

test('computePositionPnlCents handles a price of exactly 1.0 (resolved YES)', () => {
  // entry 0.20 -> current 1.0, size 1000c: ((0.80)/0.20)*1000 = 4000
  assert.equal(computePositionPnlCents(0.2, 1.0, 1000), 4000)
})
