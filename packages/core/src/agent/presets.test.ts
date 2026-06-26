import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS, thresholdsFor, type RiskPreset } from './presets'

const ORDER: RiskPreset[] = ['bunker', 'cautious', 'balanced', 'aggressive', 'max']

describe('PRESETS ladder', () => {
  test('spec-fixed edge + act-window values', () => {
    assert.equal(PRESETS.bunker.minEdgeBps, 1000)
    assert.equal(PRESETS.max.minEdgeBps, 200)
    assert.equal(PRESETS.bunker.actWindowSec, 2)
    assert.equal(PRESETS.max.actWindowSec, 20)
  })
  test('minEdgeBps decreases monotonically as risk rises', () => {
    for (let i = 1; i < ORDER.length; i++) {
      assert.ok(PRESETS[ORDER[i]].minEdgeBps < PRESETS[ORDER[i - 1]].minEdgeBps)
    }
  })
  test('actWindow, size, daily cap, hourly cap increase monotonically', () => {
    for (let i = 1; i < ORDER.length; i++) {
      const a = PRESETS[ORDER[i - 1]], b = PRESETS[ORDER[i]]
      assert.ok(b.actWindowSec > a.actWindowSec)
      assert.ok(b.maxSizeUsdc > a.maxSizeUsdc)
      assert.ok(b.perDayCapUsdc > a.perDayCapUsdc)
      assert.ok(b.maxWindowsPerHour > a.maxWindowsPerHour)
    }
  })
})

describe('thresholdsFor', () => {
  test('returns the matching preset', () => {
    assert.deepEqual(thresholdsFor('balanced'), PRESETS.balanced)
  })
})
