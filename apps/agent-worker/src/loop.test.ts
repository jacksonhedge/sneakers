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

  // ── Bug #2: price-band guard ───────────────────────────────────────────────

  test('price-band guard: skips trade when entry price is below PRICE_MIN (0.05)', async () => {
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false, simDepositUsdc: 2000, simLiquidityUsdc: 500 })
    // yesPrice=0.02 → for NO side, entryPrice = 1 - 0.02 = 0.98 > PRICE_MAX → also guards
    // yesPrice=0.02 → for YES side, entryPrice = 0.02 < PRICE_MIN → should skip
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w3',
      opensAt: 0, closesAt: 300_000, referenceOracle: 'x' }, yesPrice: 0.02 }])
    // spot much higher than open → signal would say YES → but entryPrice=0.02 < 0.05
    const spot = new FakeSpotFeed(110, 0.8)
    const ref = new FakeRefSource({ 0: 100, 300_000: 111 })
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })
    t = 0; await loop.discoverTick(); t = 299_000; await loop.priceTick()
    assert.equal((await store.allTrades()).length, 0, 'degenerate price below PRICE_MIN must not trade')
  })

  test('price-band guard: skips trade when entry price is above PRICE_MAX (0.95)', async () => {
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false, simDepositUsdc: 2000, simLiquidityUsdc: 500 })
    // yesPrice=0.98 → entryPrice for YES = 0.98 > PRICE_MAX → skip
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w4',
      opensAt: 0, closesAt: 300_000, referenceOracle: 'x' }, yesPrice: 0.98 }])
    const spot = new FakeSpotFeed(110, 0.8)
    const ref = new FakeRefSource({ 0: 100, 300_000: 111 })
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })
    t = 0; await loop.discoverTick(); t = 299_000; await loop.priceTick()
    assert.equal((await store.allTrades()).length, 0, 'degenerate price above PRICE_MAX must not trade')
  })

  // ── Bug #3: budget cap ────────────────────────────────────────────────────

  test('budget cap: trade sizeUsdc does not exceed 20% of simDepositUsdc', async () => {
    const store = new InMemoryStore()
    // $10 sim budget; 'balanced' preset would size at $40 — must be capped to $2 (20%)
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false, simDepositUsdc: 10, simLiquidityUsdc: 10 })
    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w5',
      opensAt: 0, closesAt: 300_000, referenceOracle: 'x' }, yesPrice: 0.85 }])
    const spot = new FakeSpotFeed(103, 0.8)
    const ref = new FakeRefSource({ 0: 100, 300_000: 101 })
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })
    t = 0; await loop.discoverTick(); t = 299_000; await loop.priceTick()
    const trades = await store.allTrades()
    assert.equal(trades.length, 1, 'should have placed exactly 1 trade')
    // Max size = min(40, 2, 10) = 2 on a $10 budget
    assert.ok(trades[0].sizeUsdc <= 2, `sizeUsdc ${trades[0].sizeUsdc} exceeds $2 cap on $10 budget`)
    assert.ok(trades[0].sizeUsdc >= 0.50, 'sizeUsdc should meet minimum threshold')
  })

  test('budget cap: no trade when remaining budget is exhausted', async () => {
    const store = new InMemoryStore()
    await store.seedBotConfig({ id: 1, enabled: true, mode: 'dry_run', riskPreset: 'balanced',
      assets: ['BTC'], enabledVenues: ['polymarket'], paused: false, simDepositUsdc: 10, simLiquidityUsdc: 10 })
    // Pre-seed a settled trade that already spent $10 today
    await store.insertTrade({
      botConfigId: 1, windowId: 999, signalId: 999, mode: 'dry_run',
      side: 'YES', sizeUsdc: 10, entryPrice: 0.5,
      settlePrice: null, pnlUsdc: null, status: 'open',
    })

    const feed = new FakeMarketFeed('polymarket', [{ seed: {
      venue: 'polymarket', asset: 'BTC', intervalSec: 300, externalId: 'w6',
      opensAt: 0, closesAt: 300_000, referenceOracle: 'x' }, yesPrice: 0.85 }])
    const spot = new FakeSpotFeed(103, 0.8)
    const ref = new FakeRefSource({ 0: 100, 300_000: 101 })
    let t = 0
    const loop = new AgentLoop({ feeds: [feed], spot, ref, store, now: () => t })
    t = 0; await loop.discoverTick(); t = 299_000; await loop.priceTick()
    // Should have exactly 1 trade (the pre-seeded one) — the new window must be skipped
    const trades = await store.allTrades()
    assert.equal(trades.length, 1, 'no new trade when budget is exhausted')
  })
})
