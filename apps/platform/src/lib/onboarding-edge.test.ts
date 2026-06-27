import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  composeEdgeBlock,
  mergeEdgeBlock,
  parseEdgeBlock,
  edgePreview,
  isRiskBandId,
  isStrategyStyleId,
} from './onboarding-edge'

const OPEN_MARKER = /<!-- sneakers:edge risk=/g

function blockCount(s: string): number {
  return (s.match(OPEN_MARKER) ?? []).length
}

describe('id guards', () => {
  test('accept known ids', () => {
    assert.ok(isRiskBandId('longshots'))
    assert.ok(isStrategyStyleId('value'))
  })
  test('reject unknown / wrong-type values', () => {
    assert.equal(isRiskBandId('bogus'), false)
    assert.equal(isRiskBandId(''), false)
    assert.equal(isRiskBandId(undefined), false)
    assert.equal(isRiskBandId(42), false)
    assert.equal(isStrategyStyleId('arb'), false) // close but not the real id ('arbitrage')
  })
})

describe('composeEdgeBlock', () => {
  test('is wrapped in both markers and carries the ids', () => {
    const block = composeEdgeBlock('longshots', 'value')
    assert.match(block, /^<!-- sneakers:edge risk=longshots style=value -->/)
    assert.match(block, /<!-- \/sneakers:edge -->$/)
  })
  test('includes the human-readable labels', () => {
    const block = composeEdgeBlock('favorites', 'arbitrage')
    assert.match(block, /Favorites/)
    assert.match(block, /Arbitrage/)
  })
})

describe('parseEdgeBlock', () => {
  test('round-trips with composeEdgeBlock', () => {
    assert.deepEqual(parseEdgeBlock(composeEdgeBlock('longshots', 'value')), {
      risk: 'longshots',
      style: 'value',
    })
  })
  test('finds a block embedded in surrounding user text', () => {
    const memory = `my own notes\n\n${composeEdgeBlock('balanced', 'momentum')}\n\nmore notes`
    assert.deepEqual(parseEdgeBlock(memory), { risk: 'balanced', style: 'momentum' })
  })
  test('returns null when there is no block', () => {
    assert.equal(parseEdgeBlock(''), null)
    assert.equal(parseEdgeBlock('just some freeform strategy notes'), null)
  })
  test('returns null when the marker carries an invalid id', () => {
    const bad = '<!-- sneakers:edge risk=bogus style=value -->\nx\n<!-- /sneakers:edge -->'
    assert.equal(parseEdgeBlock(bad), null)
  })
})

describe('mergeEdgeBlock — the data-safety guarantees', () => {
  test('empty memory → returns just the block', () => {
    const merged = mergeEdgeBlock('', 'longshots', 'value')
    assert.equal(merged, composeEdgeBlock('longshots', 'value'))
    assert.equal(blockCount(merged), 1)
  })

  test('whitespace-only memory → returns just the block', () => {
    const merged = mergeEdgeBlock('   \n\n  ', 'mixed', 'contrarian')
    assert.equal(merged, composeEdgeBlock('mixed', 'contrarian'))
    assert.equal(blockCount(merged), 1)
  })

  test('existing user text, no prior block → prepends, preserves user text', () => {
    const userText = 'I only trade NBA player props. Fade primetime overs.'
    const merged = mergeEdgeBlock(userText, 'longshots', 'value')
    assert.equal(blockCount(merged), 1)
    assert.ok(merged.includes(userText), 'user text must survive')
    assert.ok(
      merged.indexOf('<!-- sneakers:edge') < merged.indexOf(userText),
      'block should be prepended above the user text',
    )
  })

  test('prior block present → replaced in place, NOT duplicated', () => {
    const first = mergeEdgeBlock('', 'favorites', 'arbitrage')
    const second = mergeEdgeBlock(first, 'longshots', 'value')
    assert.equal(blockCount(second), 1, 'must never stack two edge blocks')
    assert.deepEqual(parseEdgeBlock(second), { risk: 'longshots', style: 'value' })
    assert.ok(!second.includes('risk=favorites'), 'old picks must be gone')
  })

  test('block sandwiched between user text → replaced in place, both sides preserved', () => {
    const before = 'TOP: my hand-written edge'
    const after = 'BOTTOM: insight snippet about MLB totals'
    const original = `${before}\n\n${composeEdgeBlock('balanced', 'momentum')}\n\n${after}`
    const merged = mergeEdgeBlock(original, 'mixed', 'contrarian')
    assert.equal(blockCount(merged), 1)
    assert.ok(merged.includes(before), 'text above the block must survive')
    assert.ok(merged.includes(after), 'text below the block must survive')
    assert.deepEqual(parseEdgeBlock(merged), { risk: 'mixed', style: 'contrarian' })
  })

  test('re-merging the same picks is idempotent', () => {
    const once = mergeEdgeBlock('notes', 'longshots', 'value')
    const twice = mergeEdgeBlock(once, 'longshots', 'value')
    assert.equal(once, twice)
    assert.equal(blockCount(twice), 1)
  })
})

describe('edgePreview', () => {
  test('produces a non-empty sentence naming the picks', () => {
    const preview = edgePreview('longshots', 'value')
    assert.ok(preview.length > 0)
    assert.match(preview, /10–35¢/)
    assert.match(preview, /value plays/)
  })
})
