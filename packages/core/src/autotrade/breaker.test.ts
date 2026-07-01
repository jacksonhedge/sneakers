import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkConsecutiveFailures } from './breaker.js'

test('no executions — not tripped', () => {
  const result = checkConsecutiveFailures({ recentStatuses: [], maxConsecutiveFailures: 3 })
  assert.deepEqual(result, { tripped: false })
})

test('fewer consecutive failures than max — not tripped', () => {
  const result = checkConsecutiveFailures({
    recentStatuses: ['error', 'error', 'filled'],
    maxConsecutiveFailures: 3,
  })
  assert.deepEqual(result, { tripped: false })
})

test('exactly max consecutive failures (most-recent-first) — tripped', () => {
  const result = checkConsecutiveFailures({
    recentStatuses: ['error', 'rejected', 'error', 'filled'],
    maxConsecutiveFailures: 3,
  })
  assert.equal(result.tripped, true)
  if (!result.tripped) throw new Error('unreachable')
  assert.equal(result.reason, 'consecutive_failures')
  assert.equal(result.consecutiveFailures, 3)
})

test('most-recent execution is a success — resets streak, not tripped', () => {
  const result = checkConsecutiveFailures({
    recentStatuses: ['filled', 'error', 'error', 'error'],
    maxConsecutiveFailures: 3,
  })
  assert.deepEqual(result, { tripped: false })
})

test('cancelled resets the streak like a success', () => {
  const result = checkConsecutiveFailures({
    recentStatuses: ['error', 'error', 'cancelled', 'error', 'error', 'error'],
    maxConsecutiveFailures: 3,
  })
  assert.deepEqual(result, { tripped: false })
})

test('more than max consecutive failures — tripped, count reflects actual streak', () => {
  const result = checkConsecutiveFailures({
    recentStatuses: ['error', 'error', 'error', 'error', 'error'],
    maxConsecutiveFailures: 3,
  })
  assert.equal(result.tripped, true)
  if (!result.tripped) throw new Error('unreachable')
  assert.equal(result.consecutiveFailures, 5)
})
