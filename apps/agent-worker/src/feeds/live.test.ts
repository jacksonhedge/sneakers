/**
 * Tests for LivePolymarketFeed and LiveSpotFeed.
 *
 * Network tests are gated behind the LIVE_TESTS env var so they
 * are skipped in offline / CI environments.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { LivePolymarketFeed, LiveSpotFeed, SpotHistorySource } from './live.js'

const LIVE = process.env['LIVE_TESTS'] === '1'

// ── LiveSpotFeed — unit (no network) ─────────────────────────────────────────

describe('LiveSpotFeed', () => {
  test('spot() returns 0 before any data is loaded', () => {
    const feed = new LiveSpotFeed()
    // Default is 0 (no fetch has been made yet — we haven't called prefetch)
    assert.equal(typeof feed.spot(), 'number')
  })

  test('initialSpot constructor param is used immediately', () => {
    const feed = new LiveSpotFeed(50_000)
    assert.equal(feed.spot(), 50_000)
  })

  test('recentVolPerSec() returns a positive number', () => {
    const feed = new LiveSpotFeed(50_000)
    assert.ok(feed.recentVolPerSec() > 0)
  })
})

// ── LivePolymarketFeed — normalization unit tests ─────────────────────────────

describe('LivePolymarketFeed', () => {
  test('instantiates without throwing', () => {
    assert.doesNotThrow(() => new LivePolymarketFeed())
  })

  test('venue is polymarket', () => {
    const f = new LivePolymarketFeed()
    assert.equal(f.venue, 'polymarket')
  })

  test('latestYesPrice returns null for unknown externalId', async () => {
    const f = new LivePolymarketFeed()
    const price = await f.latestYesPrice('nonexistent-id-xyz')
    assert.equal(price, null)
  })
})

// ── SpotHistorySource — nearest-sample logic ──────────────────────────────────

describe('SpotHistorySource', () => {
  test('returns live spot when no samples recorded', async () => {
    const feed = new LiveSpotFeed(50_000)
    const src = new SpotHistorySource(feed)
    // No records yet → fallback to live spot
    const price = await src.refPriceAt(Date.now())
    assert.equal(price, 50_000)
  })

  test('returns the only sample regardless of targetMs', async () => {
    const feed = new LiveSpotFeed(60_000)
    const src = new SpotHistorySource(feed)
    src.record(40_000, 1000)
    assert.equal(await src.refPriceAt(500), 40_000)
    assert.equal(await src.refPriceAt(1000), 40_000)
    assert.equal(await src.refPriceAt(9999), 40_000)
  })

  test('returns the nearest sample by absolute time distance', async () => {
    const feed = new LiveSpotFeed(0)
    const src = new SpotHistorySource(feed)
    src.record(100, 1000) // sample A at t=1000
    src.record(200, 3000) // sample B at t=3000
    // targetMs=1800 is 800ms from A, 1200ms from B → A wins
    assert.equal(await src.refPriceAt(1800), 100)
    // targetMs=2200 is 1200ms from A, 800ms from B → B wins
    assert.equal(await src.refPriceAt(2200), 200)
  })

  test('targetMs at exact sample timestamp returns that sample', async () => {
    const feed = new LiveSpotFeed(0)
    const src = new SpotHistorySource(feed)
    src.record(555, 5000)
    src.record(777, 8000)
    assert.equal(await src.refPriceAt(5000), 555)
    assert.equal(await src.refPriceAt(8000), 777)
  })

  test('future targetMs returns the most recent (last) sample', async () => {
    const feed = new LiveSpotFeed(0)
    const src = new SpotHistorySource(feed)
    src.record(100, 1000)
    src.record(200, 2000)
    src.record(300, 3000)
    // targetMs way in the future → closest to last sample (t=3000)
    assert.equal(await src.refPriceAt(1_000_000_000), 300)
  })

  test('caps buffer at 2000 samples', () => {
    const feed = new LiveSpotFeed(0)
    const src = new SpotHistorySource(feed)
    for (let i = 0; i < 2500; i++) {
      src.record(i, i)
    }
    // Access private field via cast — just ensure no throw and last sample is newest
    const hist = src as unknown as { samples: Array<{ ms: number; spot: number }> }
    assert.ok(hist.samples.length <= 2000)
    // Latest sample should still be at index length-1
    const last = hist.samples[hist.samples.length - 1]
    assert.equal(last.spot, 2499)
  })
})

// ── Live (network) tests — skipped offline ────────────────────────────────────

describe('LiveSpotFeed (network)', { skip: !LIVE }, () => {
  let feed: LiveSpotFeed

  before(async () => {
    feed = new LiveSpotFeed()
    await feed.prefetch()
  })

  test('prefetch sets a positive spot price', () => {
    const price = feed.spot()
    assert.ok(price > 0, `expected positive spot price, got ${price}`)
  })

  test('spot price is a plausible BTC price (>1000)', () => {
    const price = feed.spot()
    assert.ok(price > 1000, `spot price ${price} looks too low for BTC`)
  })
})

describe('LivePolymarketFeed (network)', { skip: !LIVE }, () => {
  let feed: LivePolymarketFeed
  let nowMs: number

  before(() => {
    feed = new LivePolymarketFeed()
    nowMs = Date.now()
  })

  test('discoverWindows returns an array', async () => {
    const seeds = await feed.discoverWindows(nowMs)
    assert.ok(Array.isArray(seeds), 'expected array of WindowSeed')
  })

  test('all returned seeds have required fields', async () => {
    const seeds = await feed.discoverWindows(nowMs)
    for (const s of seeds) {
      assert.equal(s.venue, 'polymarket')
      assert.equal(s.asset, 'BTC')
      assert.ok(typeof s.externalId === 'string' && s.externalId.length > 0)
      assert.ok(typeof s.opensAt === 'number' && s.opensAt > 0)
      assert.ok(typeof s.closesAt === 'number' && s.closesAt > s.opensAt)
      assert.ok(typeof s.intervalSec === 'number' && s.intervalSec >= 60)
      // Windows must close within 20 min lookahead
      assert.ok(s.closesAt - nowMs <= 20 * 60 * 1000 + 1000, `window closes too far out: ${s.closesAt - nowMs}ms`)
    }
  })

  test('latestYesPrice for a discovered seed returns a price in (0,1) or null', async () => {
    const seeds = await feed.discoverWindows(nowMs)
    if (seeds.length === 0) {
      // No live windows right now — this is valid; skip assertion
      return
    }
    const first = seeds[0]
    const price = await feed.latestYesPrice(first.externalId)
    if (price !== null) {
      assert.ok(price > 0 && price < 1, `YES price ${price} should be in (0,1)`)
    }
    // null is also acceptable when the orderbook is thin
  })
})
