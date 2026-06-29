import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { RollingVol } from './vol'

describe('RollingVol', () => {
  test('flat prices -> ~0 vol (floored positive)', () => {
    const v = new RollingVol(60)
    for (let t = 0; t < 10; t++) v.push(100, t * 1000)
    assert.ok(v.perSec() >= 0)
    assert.ok(v.perSec() < 1e-6 + 1e-9)
  })
  test('steady +1/sec moves -> perSec near 1', () => {
    const v = new RollingVol(60)
    for (let t = 0; t < 30; t++) v.push(100 + t, t * 1000)
    assert.ok(Math.abs(v.perSec() - 1) < 0.2)
  })
})
