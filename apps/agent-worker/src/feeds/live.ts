/**
 * Live market feeds for the dry-run agent loop.
 *
 * LivePolymarketFeed  — fetches active short-interval BTC up/down windows
 *                       from Polymarket's public Gamma API (no auth required).
 * LiveSpotFeed        — fetches BTC spot price from the Coinbase public API
 *                       and caches it for a few seconds.
 *
 * SAFETY: these feeds only READ from public APIs. They do NOT place orders,
 * touch real funds, or require any venue credentials.
 */

import type { Venue } from '@sneakers/core'
import type { WindowSeed } from '@sneakers/core/db/agent-repo'
import type { MarketFeed, SpotFeed } from './types.js'

// ── Constants ────────────────────────────────────────────────────────────────

const GAMMA_BASE = 'https://gamma-api.polymarket.com'
const CLOB_BASE = 'https://clob.polymarket.com'
const COINBASE_SPOT_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot'

/** Window lookahead: only fetch windows closing within this many ms */
const LOOKAHEAD_MS = 20 * 60 * 1000 // 20 min

/** Spot price cache TTL */
const SPOT_CACHE_TTL_MS = 5_000 // 5 seconds

// ── Gamma API types ──────────────────────────────────────────────────────────

interface GammaMarket {
  id: string
  question: string
  slug: string
  active?: boolean
  closed?: boolean
  archived?: boolean
  outcomePrices?: string
  clobTokenIds?: string
  startDate?: string
  endDate?: string
  groupItemTitle?: string
  description?: string
}

interface GammaEvent {
  id: string
  title: string
  slug: string
  active?: boolean
  closed?: boolean
  tags?: Array<{ slug: string; label: string }>
  markets?: GammaMarket[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`)
  return res.json() as Promise<T>
}

function parseJsonField<T>(s: string | undefined): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

/**
 * Is this market question a short-interval BTC up/down window?
 * Polymarket crypto short-interval questions look like:
 *   "Will Bitcoin be above $X at 3:05 PM?"
 *   "Bitcoin up or down in next 5 minutes?"
 */
function isBtcShortWindow(market: GammaMarket, event: GammaEvent): boolean {
  const q = (market.question ?? '').toLowerCase()
  const title = (event.title ?? '').toLowerCase()
  const slug = (event.slug ?? '').toLowerCase()

  const hasBtc =
    q.includes('bitcoin') ||
    q.includes('btc') ||
    title.includes('bitcoin') ||
    title.includes('btc') ||
    slug.includes('bitcoin') ||
    slug.includes('btc')

  if (!hasBtc) return false

  // Must be a binary up/down or above/below market (not a "price reaches" long-horizon one)
  const hasUpDown =
    q.includes('up or down') ||
    q.includes('above') ||
    q.includes('higher') ||
    q.includes('lower') ||
    q.includes('increase') ||
    q.includes('decrease') ||
    q.includes('pump') ||
    q.includes('drop')

  return hasUpDown
}

/** Best bid from CLOB orderbook — returns null if unavailable */
async function fetchYesMidPrice(tokenId: string): Promise<number | null> {
  try {
    const ob = await fetchJson<{ bids?: Array<{ price: string }>; asks?: Array<{ price: string }> }>(
      `${CLOB_BASE}/book?token_id=${tokenId}`,
    )
    const bids = (ob.bids ?? []).map(l => parseFloat(l.price)).filter(x => !Number.isNaN(x))
    const asks = (ob.asks ?? []).map(l => parseFloat(l.price)).filter(x => !Number.isNaN(x))
    if (bids.length === 0 && asks.length === 0) return null
    const bid = bids.length ? Math.max(...bids) : null
    const ask = asks.length ? Math.min(...asks) : null
    if (bid !== null && ask !== null) return (bid + ask) / 2
    return bid ?? ask ?? null
  } catch {
    return null
  }
}

// ── LivePolymarketFeed ───────────────────────────────────────────────────────

/**
 * Normalises a matched GammaMarket into a WindowSeed.
 * Returns null if we cannot extract the required fields.
 */
function toWindowSeed(market: GammaMarket, nowMs: number): WindowSeed | null {
  if (!market.endDate) return null

  const closesAt = Date.parse(market.endDate)
  if (Number.isNaN(closesAt)) return null

  // Only include windows closing within LOOKAHEAD_MS
  if (closesAt - nowMs > LOOKAHEAD_MS) return null
  // Skip already-closed windows
  if (closesAt <= nowMs) return null

  // opensAt: use startDate if present and in the past, otherwise use now
  const rawOpen = market.startDate ? Date.parse(market.startDate) : NaN
  const opensAt = !Number.isNaN(rawOpen) && rawOpen <= nowMs ? rawOpen : nowMs

  // intervalSec: estimate from window duration (round to nearest minute)
  const durationSec = Math.round((closesAt - opensAt) / 1000 / 60) * 60
  const intervalSec = Math.max(60, durationSec)

  return {
    venue: 'polymarket' as Venue,
    asset: 'BTC',
    intervalSec,
    externalId: market.id,
    opensAt,
    closesAt,
    referenceOracle: 'polymarket:btc-usd',
  }
}

export class LivePolymarketFeed implements MarketFeed {
  readonly venue: Venue = 'polymarket'

  /** Cache: externalId → YES-token mid price */
  private priceCache: Map<string, { price: number; fetchedAt: number }> = new Map()

  /** Cache: discovered seeds (refreshed each discoverWindows call) */
  private seedTokenMap: Map<string, string> = new Map() // externalId → YES tokenId

  async discoverWindows(nowMs: number): Promise<WindowSeed[]> {
    const events = await this.fetchBtcCryptoEvents()
    const seeds: WindowSeed[] = []

    for (const event of events) {
      // Live short-interval BTC up/down windows are recurring events whose
      // slug looks like "btc-updown-5m-<ts>" / "btc-updown-15m-<ts>". The
      // question text is unreliable; the slug is the stable identifier.
      if (!(event.slug ?? '').toLowerCase().startsWith('btc-updown-')) continue
      for (const market of event.markets ?? []) {
        if (market.closed || market.archived) continue

        const seed = toWindowSeed(market, nowMs)
        if (!seed) continue

        // Extract YES token id (first token in the clobTokenIds array)
        const tokenIds = parseJsonField<string[]>(market.clobTokenIds) ?? []
        if (tokenIds[0]) {
          this.seedTokenMap.set(market.id, tokenIds[0])
        }

        seeds.push(seed)
      }
    }

    return seeds
  }

  async latestYesPrice(externalId: string): Promise<number | null> {
    const cached = this.priceCache.get(externalId)
    if (cached && Date.now() - cached.fetchedAt < SPOT_CACHE_TTL_MS) {
      return cached.price
    }

    const tokenId = this.seedTokenMap.get(externalId)
    if (!tokenId) return null

    const price = await fetchYesMidPrice(tokenId)
    if (price !== null) {
      this.priceCache.set(externalId, { price, fetchedAt: Date.now() })
    }
    return price
  }

  private async fetchBtcCryptoEvents(): Promise<GammaEvent[]> {
    // The live short-interval windows only surface on the soonest-closing
    // page, so order by endDate ascending and pull a large page. (Proven
    // query from markets-proxy.py; tag_slug=crypto + the btc-updown- slug
    // filter in discoverWindows is what catches the recurring 5/15-min windows.)
    const url = `${GAMMA_BASE}/events?closed=false&limit=500&order=endDate&ascending=true&tag_slug=crypto`
    try {
      return await fetchJson<GammaEvent[]>(url)
    } catch (err) {
      console.warn(`[DRY-RUN] LivePolymarketFeed: fetch failed — ${(err as Error).message}`)
      return []
    }
  }
}

// ── SpotHistorySource ────────────────────────────────────────────────────────

/**
 * Faithful spot-history oracle for the dry-run settle loop.
 *
 * Each tick, the caller should call `.record(spot, Date.now())` before
 * running the AgentLoop ticks.  `refPriceAt(targetMs)` returns the
 * recorded sample whose timestamp is closest to `targetMs`, so a
 * window's openRef and settleRef reflect actual price at those moments
 * instead of always being the current live price (the old bug).
 *
 * If no samples have been recorded yet, returns the latest spot from
 * the SpotFeed directly.
 */
export class SpotHistorySource {
  private samples: Array<{ ms: number; spot: number }> = []
  private fallbackFeed: LiveSpotFeed

  constructor(fallbackFeed: LiveSpotFeed) {
    this.fallbackFeed = fallbackFeed
  }

  /** Record a spot sample at the given timestamp (call once per tick). */
  record(spot: number, ms: number): void {
    this.samples.push({ ms, spot })
    // Keep at most 2000 samples (~33 min at 1s intervals)
    if (this.samples.length > 2000) {
      this.samples.splice(0, this.samples.length - 2000)
    }
  }

  /**
   * Return the sample whose timestamp is closest to targetMs.
   * If no samples, falls back to the live spot feed's current value.
   * For targetMs in the future (or equal to now) the latest sample is returned.
   */
  async refPriceAt(targetMs: number): Promise<number> {
    if (this.samples.length === 0) {
      return this.fallbackFeed.spot()
    }
    // Find the sample with minimum absolute time difference
    let best = this.samples[0]
    let bestDiff = Math.abs(this.samples[0].ms - targetMs)
    for (let i = 1; i < this.samples.length; i++) {
      const diff = Math.abs(this.samples[i].ms - targetMs)
      if (diff < bestDiff) {
        bestDiff = diff
        best = this.samples[i]
      }
    }
    return best.spot
  }
}

// ── LiveSpotFeed ─────────────────────────────────────────────────────────────

/**
 * Fetches the live BTC/USD spot price from Coinbase's public API.
 * Caches the result for SPOT_CACHE_TTL_MS to avoid hammering the endpoint.
 *
 * Falls back to the last known price if the fetch fails.
 */
export class LiveSpotFeed implements SpotFeed {
  private cachedSpot: number = 0
  private cachedAt: number = 0
  private lastFetchPromise: Promise<void> | null = null

  constructor(initialSpot?: number) {
    if (initialSpot !== undefined) {
      this.cachedSpot = initialSpot
      this.cachedAt = Date.now()
    }
  }

  spot(): number {
    // Kick off a background refresh if cache is stale (non-blocking)
    if (Date.now() - this.cachedAt > SPOT_CACHE_TTL_MS && this.lastFetchPromise === null) {
      this.lastFetchPromise = this.refresh().finally(() => {
        this.lastFetchPromise = null
      })
    }
    return this.cachedSpot
  }

  /** Blocking prefetch — call once at startup to seed the cache */
  async prefetch(): Promise<void> {
    await this.refresh()
  }

  /** Approximate recent vol per second (hardcoded floor — not estimated live) */
  recentVolPerSec(): number {
    // BTC moves ~$10-$30/min at rest → ~$0.17-$0.50/sec
    // We return a moderate baseline; the AgentLoop's RollingVol accumulates spot readings
    return 0.5
  }

  private async refresh(): Promise<void> {
    try {
      const data = await fetchJson<{ data: { amount: string } }>(COINBASE_SPOT_URL)
      const price = parseFloat(data.data.amount)
      if (!Number.isNaN(price) && price > 0) {
        this.cachedSpot = price
        this.cachedAt = Date.now()
      }
    } catch (err) {
      console.warn(`[DRY-RUN] LiveSpotFeed: Coinbase fetch failed — ${(err as Error).message}`)
      // Try Hyperliquid mark price as fallback
      try {
        await this.refreshFromHyperliquid()
      } catch {
        // Keep last known value
      }
    }
  }

  private async refreshFromHyperliquid(): Promise<void> {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const [meta, ctxs] = (await res.json()) as [{ universe: Array<{ name: string }> }, Array<{ markPx: string }>]
    const btcIdx = meta.universe.findIndex(u => u.name === 'BTC')
    if (btcIdx < 0) throw new Error('BTC not found in HL universe')
    const price = parseFloat(ctxs[btcIdx]?.markPx ?? '')
    if (Number.isNaN(price) || price <= 0) throw new Error('invalid price')
    this.cachedSpot = price
    this.cachedAt = Date.now()
  }
}
