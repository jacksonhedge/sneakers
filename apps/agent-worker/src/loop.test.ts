import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentLoop } from './loop'
import { FakeMarketFeed, FakeSpotFeed, FakeRefSource, InMemoryStore } from './feeds/fake'

describe('AgentLoop', () => {
  test('clear last-second edge -> dry-run trade recorded and settles won', async () => {
    const opensAt = 0, closesAt = 300_000
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false,
      simDepositUsdc: 2000, simLiquidityUsdc: 500 })
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w1',
      opensAt, closesAt, referenceOracle: 'x' }, yesPrice: 0.85 }])
    // spot 103 vs open 100 with low vol → implied ~1.0, YES underpriced at 0.85 → edge
    const spot = new FakeSpotFeed(103, 0.8)
    const ref = new FakeRefSource({ [opensAt]: 100, [closesAt]: 101 }) // ends up
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })

    t = 0;        await loop.discoverTick()   // window opens, openRef=100
    t = 299_000;  await loop.priceTick()      // 1s to close → trade
    t = 301_000;  await loop.settleTick()     // settle up

    const trades = await store.allTrades()
    assert.equal(trades.length, 1)
    assert.equal(trades[0].side, 'YES')
    assert.equal(trades[0].status, 'won')
    assert.ok(trades[0].pnlUsdc > 0)
  })

  test('no edge -> no trade', async () => {
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false, simDepositUsdc: 2000, simLiquidityUsdc: 500 })
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w2',
      opensAt: 0, closesAt: 300_000, referenceOracle: 'x' }, yesPrice: 0.50 }])
    const spot = new FakeSpotFeed(100, 1), ref = new FakeRefSource({ 0: 100, 300_000: 100 })
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })
    t = 0; await loop.discoverTick(); t = 299_000; await loop.priceTick(); t = 301_000; await loop.settleTick()
    assert.equal((await store.allTrades()).length, 0)
  })
})
