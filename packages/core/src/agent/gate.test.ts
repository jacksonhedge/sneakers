import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGate, COOLDOWN_MS, type BotState } from './gate'
import type { SignalDecision } from './signal'

const decision: SignalDecision = { side: 'YES', impliedProb: 0.97, marketProb: 0.88, edgeBps: 900 }
const bot = (over: Partial<BotState> = {}): BotState => ({
  preset: 'balanced', paused: false, killed: false,
  spentTodayUsdc: 0, windowsThisHour: 0, lastTradeAtMs: null, ...over,
})
const ctx = (over: Partial<{ secondsToClose: number; nowMs: number }> = {}) => ({
  secondsToClose: 3, nowMs: 1_000_000, ...over,
})

describe('evaluateGate skips', () => {
  test('killed', () => assert.deepEqual(evaluateGate(bot({ killed: true }), decision, ctx()), { action: 'skip', reason: 'killed' }))
  test('paused', () => assert.deepEqual(evaluateGate(bot({ paused: true }), decision, ctx()), { action: 'skip', reason: 'paused' }))
  test('outside act window (balanced = 7s, ctx 9s)', () =>
    assert.deepEqual(evaluateGate(bot(), decision, ctx({ secondsToClose: 9 })), { action: 'skip', reason: 'outside_act_window' }))
  test('edge below preset min (balanced = 500)', () =>
    assert.deepEqual(evaluateGate(bot(), { ...decision, edgeBps: 400 }, ctx()), { action: 'skip', reason: 'edge_below_min' }))
  test('hourly cap reached (balanced = 8)', () =>
    assert.deepEqual(evaluateGate(bot({ windowsThisHour: 8 }), decision, ctx()), { action: 'skip', reason: 'hourly_cap' }))
  test('cooldown not elapsed', () =>
    assert.deepEqual(
      evaluateGate(bot({ lastTradeAtMs: 1_000_000 - (COOLDOWN_MS - 1) }), decision, ctx()),
      { action: 'skip', reason: 'cooldown' },
    ))
  test('daily cap exhausted (balanced = 150)', () =>
    assert.deepEqual(evaluateGate(bot({ spentTodayUsdc: 150 }), decision, ctx()), { action: 'skip', reason: 'daily_cap' }))
})

describe('evaluateGate trades', () => {
  test('happy path uses full preset size (balanced maxSize 40)', () =>
    assert.deepEqual(evaluateGate(bot(), decision, ctx()), { action: 'trade', sizeUsdc: 40 }))
  test('size clamped to remaining daily room', () =>
    assert.deepEqual(evaluateGate(bot({ spentTodayUsdc: 130 }), decision, ctx()), { action: 'trade', sizeUsdc: 20 }))
  test('cooldown elapsed is fine', () =>
    assert.deepEqual(
      evaluateGate(bot({ lastTradeAtMs: 1_000_000 - COOLDOWN_MS }), decision, ctx()),
      { action: 'trade', sizeUsdc: 40 },
    ))
})
