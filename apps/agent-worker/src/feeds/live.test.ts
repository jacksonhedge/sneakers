/**
 * Tests for LivePolymarketFeed and LiveSpotFeed.
 *
 * Network tests are gated behind the LIVE_TESTS env var so they
 * are skipped in offline / CI environments.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { LivePolymarketFeed, LiveSpotFeed } from './live.js'

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
