import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedTransactions } from './seed.js'

test('seedTransactions is deterministic across calls', () => {
  assert.deepEqual(seedTransactions(10), seedTransactions(10))
})

test('seedTransactions returns the requested count and clamps to available', () => {
  assert.equal(seedTransactions(3).length, 3)
  assert.ok(seedTransactions(999).length >= 8)
})

test('seedTransactions produces non-round amounts so round-ups are non-zero', () => {
  const anyNonRound = seedTransactions(10).some((t) => t.amountCents % 100 !== 0)
  assert.equal(anyNonRound, true)
})

test('seedTransactions has stable ids', () => {
  assert.deepEqual(seedTransactions(2).map((t) => t.id), ['seed-1', 'seed-2'])
})
