import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkCooldown } from './cooldown.js'

test('no prior trade — ok', () => {
  const result = checkCooldown({ lastTradeAtMs: null, cooldownSeconds: 60, nowMs: 1_000_000 })
  assert.deepEqual(result, { ok: true })
})

test('cooldown fully elapsed — ok', () => {
  const result = checkCooldown({
    lastTradeAtMs: 1_000_000,
    cooldownSeconds: 60,
    nowMs: 1_000_000 + 61_000,
  })
  assert.deepEqual(result, { ok: true })
})

test('still within cooldown — blocked with retryAfterMs', () => {
  const result = checkCooldown({
    lastTradeAtMs: 1_000_000,
    cooldownSeconds: 60,
    nowMs: 1_000_000 + 20_000,
  })
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('unreachable')
  assert.equal(result.reason, 'cooldown')
  assert.equal(result.retryAfterMs, 40_000)
})

test('exact boundary (elapsed === cooldown) — ok', () => {
  const result = checkCooldown({
    lastTradeAtMs: 1_000_000,
    cooldownSeconds: 60,
    nowMs: 1_000_000 + 60_000,
  })
  assert.deepEqual(result, { ok: true })
})
