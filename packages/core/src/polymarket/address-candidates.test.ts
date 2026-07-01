import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAddressCandidates } from './address-candidates.js'

test('neither address present — empty list', () => {
  assert.deepEqual(buildAddressCandidates({}), [])
})

test('only walletAddress — single candidate', () => {
  assert.deepEqual(buildAddressCandidates({ walletAddress: '0xAAA' }), ['0xAAA'])
})

test('only funderAddress — single candidate', () => {
  assert.deepEqual(buildAddressCandidates({ funderAddress: '0xBBB' }), ['0xBBB'])
})

test('both present and different — walletAddress tried first', () => {
  assert.deepEqual(
    buildAddressCandidates({ walletAddress: '0xAAA', funderAddress: '0xBBB' }),
    ['0xAAA', '0xBBB'],
  )
})

test('both present and identical (case-insensitive) — deduped to one candidate', () => {
  assert.deepEqual(
    buildAddressCandidates({ walletAddress: '0xAAA', funderAddress: '0xaaa' }),
    ['0xAAA'],
  )
})
