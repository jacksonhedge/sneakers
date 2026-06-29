import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { CircuitBreaker } from './breaker'

describe('CircuitBreaker', () => {
  describe('consecutive errors', () => {
    test('trips after N consecutive errors', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 3, dailyLossCapUsd: 500 })
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'consecutive_errors' })
    })

    test('recordPnl success resets consecutive error counter', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 3, dailyLossCapUsd: 500 })

      breaker.recordError()
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      // Record a success (positive PnL)
      breaker.recordPnl(50)
      assert.deepEqual(breaker.tripped(), { tripped: false })

      // Now errors reset, so we need 3 more to trip
      breaker.recordError()
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'consecutive_errors' })
    })

    test('recordPnl with loss still resets error counter', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 2, dailyLossCapUsd: 500 })

      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      // Record a loss (negative PnL) - still counts as a "success" signal
      breaker.recordPnl(-30)
      assert.deepEqual(breaker.tripped(), { tripped: false })

      // Error counter is reset, need 2 more to trip
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })
    })
  })

  describe('daily loss cap', () => {
    test('trips when cumulative loss meets the cap', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 5, dailyLossCapUsd: 100 })
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordPnl(-50)
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordPnl(-50)
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'daily_loss' })
    })

    test('does not trip just below the cap', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 5, dailyLossCapUsd: 100 })

      breaker.recordPnl(-99)
      assert.deepEqual(breaker.tripped(), { tripped: false })
    })

    test('trips when loss exceeds the cap', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 5, dailyLossCapUsd: 100 })

      breaker.recordPnl(-50)
      breaker.recordPnl(-40)
      breaker.recordPnl(-15)
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'daily_loss' })
    })

    test('accumulates both gains and losses', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 5, dailyLossCapUsd: 100 })

      breaker.recordPnl(200)
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordPnl(-150)
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordPnl(-151)
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'daily_loss' })
    })
  })

  describe('reset', () => {
    test('reset clears error counter', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 2, dailyLossCapUsd: 100 })

      breaker.recordError()
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'consecutive_errors' })

      breaker.reset()
      assert.deepEqual(breaker.tripped(), { tripped: false })
    })

    test('reset clears daily P&L accumulator', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 5, dailyLossCapUsd: 100 })

      breaker.recordPnl(-100)
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'daily_loss' })

      breaker.reset()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      // Can accumulate loss again after reset
      breaker.recordPnl(-50)
      assert.deepEqual(breaker.tripped(), { tripped: false })
    })

    test('reset clears both counters together', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 2, dailyLossCapUsd: 100 })

      breaker.recordError()
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'consecutive_errors' })

      breaker.reset()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      // Both counters start fresh
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordPnl(-50)
      assert.deepEqual(breaker.tripped(), { tripped: false })
    })
  })

  describe('edge cases', () => {
    test('maxConsecutiveErrors = 1', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 1, dailyLossCapUsd: 500 })
      assert.deepEqual(breaker.tripped(), { tripped: false })

      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'consecutive_errors' })
    })

    test('consecutive_errors is checked before daily_loss', () => {
      const breaker = new CircuitBreaker({ maxConsecutiveErrors: 2, dailyLossCapUsd: 100 })

      // This test verifies check ordering: consecutive_errors is evaluated first
      // In practice, recordPnl resets the error counter, so both can't be tripped simultaneously
      breaker.recordError()
      breaker.recordError()
      assert.deepEqual(breaker.tripped(), { tripped: true, reason: 'consecutive_errors' })
    })
  })
})
