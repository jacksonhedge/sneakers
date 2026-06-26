import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { erf, normCdf } from './mathx'

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`)

describe('normCdf', () => {
  test('symmetric around 0.5 at x=0', () => near(normCdf(0), 0.5, 1e-9))
  test('approaches 1 for large positive x', () => near(normCdf(8), 1, 1e-6))
  test('approaches 0 for large negative x', () => near(normCdf(-8), 0, 1e-6))
  test('known value at x=1 (~0.8413)', () => near(normCdf(1), 0.8413))
  test('symmetry: normCdf(-x) == 1 - normCdf(x)', () => near(normCdf(-0.7), 1 - normCdf(0.7), 1e-9))
})

describe('erf', () => {
  test('erf(0) == 0', () => near(erf(0), 0, 1e-9))
  test('erf(1) ≈ 0.8427', () => near(erf(1), 0.8427007929, 1e-6))
  test('odd symmetry: erf(-x) == -erf(x)', () => near(erf(-1), -erf(1), 1e-9))
})
