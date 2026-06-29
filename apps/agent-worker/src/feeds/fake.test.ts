import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeMarketFeed, InMemoryStore } from './fake'

describe('fakes', () => {
  test('FakeMarketFeed returns seeded windows + prices', async () => {
    const f = new FakeMarketFeed('polymarket', [
      { seed: { venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w1',
                opensAt: 0, closesAt: 300000, referenceOracle: 'x' }, yesPrice: 0.88 },
    ])
    const ws = await f.discoverWindows(0)
    assert.equal(ws.length, 1)
    assert.equal(await f.latestYesPrice('w1'), 0.88)
  })
  test('InMemoryStore upsert is idempotent', async () => {
    const s = new InMemoryStore()
    const seed = { venue: 'polymarket' as const, asset: 'BTC' as const, intervalSec: 300,
      externalId: 'w1', opensAt: 0, closesAt: 300000, referenceOracle: 'x' }
    const a = await s.upsertWindow(seed); const b = await s.upsertWindow(seed)
    assert.equal(a.id, b.id)
  })
})
