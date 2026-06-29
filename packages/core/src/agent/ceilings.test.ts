import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { clampToCeilings, CEIL, type LiveSizeInput } from './ceilings'

const input = (over: Partial<LiveSizeInput> = {}): LiveSizeInput => ({
  requestedUsd: 50,
  spentTodayUsd: 0,
  openPositions: 0,
  lastLiveTradeAtMs: null,
  nowMs: 1_000_000,
  ...over,
})

describe('clampToCeilings blocks', () => {
  test('cooldown not elapsed', () => {
    const i = input({
      lastLiveTradeAtMs: 1_000_000 - (CEIL.cooldownMs - 1),
      nowMs: 1_000_000,
    })
    assert.deepEqual(clampToCeilings(i), { ok: false, reason: 'cooldown' })
  })

  test('max open positions reached', () => {
    const i = input({ openPositions: CEIL.maxOpenPositions })
    assert.deepEqual(clampToCeilings(i), { ok: false, reason: 'max_positions' })
  })

  test('daily ceiling exhausted', () => {
    const i = input({ spentTodayUsd: CEIL.perDayUsd })
    assert.deepEqual(clampToCeilings(i), { ok: false, reason: 'daily_ceiling' })
  })

  test('daily ceiling exhausted (slightly over)', () => {
    const i = input({ spentTodayUsd: CEIL.perDayUsd + 1 })
    assert.deepEqual(clampToCeilings(i), { ok: false, reason: 'daily_ceiling' })
  })

  test('zero size after clamping', () => {
    // Requested is negative
    const i = input({ requestedUsd: -10 })
    assert.deepEqual(clampToCeilings(i), { ok: false, reason: 'zero_size' })
  })

  test('zero size when daily remaining is zero', () => {
    const i = input({ spentTodayUsd: CEIL.perDayUsd, requestedUsd: 0 })
    assert.deepEqual(clampToCeilings(i), { ok: false, reason: 'daily_ceiling' })
  })
})

describe('clampToCeilings happy path and clamping', () => {
  test('happy path with all limits OK', () => {
    const i = input({ requestedUsd: 30 })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, 30)
  })

  test('clamped to per-trade ceiling', () => {
    const i = input({ requestedUsd: 100 })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, CEIL.perTradeUsd) // 50
  })

  test('clamped to daily remaining room', () => {
    const i = input({ spentTodayUsd: 180, requestedUsd: 100 })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, 20) // 200 - 180
  })

  test('clamped to both per-trade and daily remaining', () => {
    // Requested: 100, perTrade: 50, daily remaining: 30
    const i = input({ spentTodayUsd: 170, requestedUsd: 100 })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, 30) // min(100, 50, 30)
  })

  test('cooldown elapsed is fine', () => {
    const i = input({
      lastLiveTradeAtMs: 1_000_000 - CEIL.cooldownMs,
      nowMs: 1_000_000,
      requestedUsd: 25,
    })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, 25)
  })

  test('cooldown elapsed by more than required', () => {
    const i = input({
      lastLiveTradeAtMs: 1_000_000 - CEIL.cooldownMs - 1000,
      nowMs: 1_000_000,
      requestedUsd: 40,
    })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, 40)
  })

  test('open positions one below max is fine', () => {
    const i = input({ openPositions: CEIL.maxOpenPositions - 1, requestedUsd: 35 })
    const result = clampToCeilings(i)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.sizeUsd, 35)
  })

  test('checks in order: cooldown blocks before open positions', () => {
    const i = input({
      lastLiveTradeAtMs: 1_000_000 - (CEIL.cooldownMs - 1),
      openPositions: CEIL.maxOpenPositions,
      nowMs: 1_000_000,
    })
    const result = clampToCeilings(i)
    // Should block on cooldown (checked first)
    assert.deepEqual(result, { ok: false, reason: 'cooldown' })
  })

  test('checks in order: open positions blocks before daily ceiling', () => {
    const i = input({
      openPositions: CEIL.maxOpenPositions,
      spentTodayUsd: CEIL.perDayUsd - 10,
    })
    const result = clampToCeilings(i)
    // Should block on max_positions (checked before daily ceiling)
    assert.deepEqual(result, { ok: false, reason: 'max_positions' })
  })

  test('checks in order: daily ceiling blocks before zero size', () => {
    const i = input({
      spentTodayUsd: CEIL.perDayUsd,
      requestedUsd: 10,
    })
    const result = clampToCeilings(i)
    // Should block on daily_ceiling (checked before zero size check)
    assert.deepEqual(result, { ok: false, reason: 'daily_ceiling' })
  })
})
