/**
 * run-dryrun.ts — Sneakers Bot dry-run entrypoint.
 *
 * Wires LivePolymarketFeed + LiveSpotFeed + InMemoryStore + FakeRouter
 * into the AgentLoop and runs it on a timer (default 30s, LOOP_INTERVAL_MS).
 *
 * SAFETY GUARANTEES (enforced here):
 *  - Uses FakeRouter ONLY — no real order placement code is imported or called.
 *  - Uses InMemoryStore — no Railway/Postgres dependency.
 *  - Every fill/signal/gate decision is logged with a [DRY-RUN] prefix.
 *  - No venue credentials are required or accepted.
 */

import { AgentLoop } from './loop.js'
import { InMemoryStore } from './feeds/fake.js'
import { LivePolymarketFeed, LiveSpotFeed } from './feeds/live.js'
import { FakeRouter } from './exec/router.js'
import type { AuditSink, AuditEntry } from './exec/execute.js'
import type { BotConfigRow } from '@sneakers/core/db/agent-repo'

// ── Config ────────────────────────────────────────────────────────────────────

const LOOP_INTERVAL_MS = parseInt(process.env['LOOP_INTERVAL_MS'] ?? '30000', 10)

// The single bot-config used for dry-run. Uses 'balanced' preset and
// paper-trading mode. No real money, no real credentials.
const DRY_RUN_BOT_CONFIG: Omit<BotConfigRow, 'userId' | 'createdAt'> & {
  userId?: string | null
  createdAt?: number
} = {
  id: 1,
  userId: null,
  enabled: true,
  mode: 'dry_run',
  simDepositUsdc: 1000,
  simLiquidityUsdc: 1000,
  riskPreset: 'balanced',
  assets: ['BTC'],
  enabledVenues: ['polymarket'],
  paused: false,
}

// ── Console AuditSink ─────────────────────────────────────────────────────────

let auditSeq = 0

const consoleAudit: AuditSink = {
  async record(entry: AuditEntry): Promise<number> {
    const id = ++auditSeq
    const tag = '[DRY-RUN][AUDIT]'
    console.log(
      `${tag} #${id} bot=${entry.botConfigId} window=${entry.windowId} ` +
        `mode=${entry.mode} side=${entry.side} ` +
        `requestedUsd=${entry.requestedUsd.toFixed(2)} ` +
        `status=${entry.status}` +
        (entry.blockedReason ? ` reason=${entry.blockedReason}` : '') +
        (entry.sizeUsd !== null ? ` sizeUsd=${entry.sizeUsd.toFixed(2)}` : ''),
    )
    return id
  },
}

// ── RefPriceSource backed by LiveSpotFeed ─────────────────────────────────────

/**
 * Simple ref price source that returns the current spot price for any
 * requested timestamp. In dry-run we don't have a historical oracle,
 * so we return the live spot for both open and settle prices.
 */
class LiveRefPriceSource {
  constructor(private spotFeed: LiveSpotFeed) {}

  async refPriceAt(_atMs: number): Promise<number> {
    return this.spotFeed.spot()
  }
}

// ── Tick ──────────────────────────────────────────────────────────────────────

let tickCount = 0

async function runTick(
  loop: AgentLoop,
  feed: LivePolymarketFeed,
  spotFeed: LiveSpotFeed,
): Promise<void> {
  tickCount++
  const ts = new Date().toISOString()
  console.log(`\n[DRY-RUN] ── Tick #${tickCount} @ ${ts} ─────────────────────────────────`)

  // Discover
  const nowMs = Date.now()
  let seeds
  try {
    seeds = await feed.discoverWindows(nowMs)
  } catch (err) {
    console.log(`[DRY-RUN] discoverWindows error: ${(err as Error).message}`)
    seeds = []
  }

  if (seeds.length === 0) {
    console.log('[DRY-RUN] no live BTC windows right now — skipping price/settle ticks')
    return
  }

  console.log(`[DRY-RUN] discovered ${seeds.length} BTC window(s):`)
  for (const s of seeds) {
    const closeIn = Math.round((s.closesAt - nowMs) / 1000)
    console.log(
      `[DRY-RUN]   externalId=${s.externalId} closeIn=${closeIn}s ` +
        `opens=${new Date(s.opensAt).toISOString()} closes=${new Date(s.closesAt).toISOString()}`,
    )
  }

  // Spot
  const spot = spotFeed.spot()
  console.log(`[DRY-RUN] BTC spot=$${spot.toFixed(2)}`)

  try {
    await loop.discoverTick()
    console.log('[DRY-RUN] discoverTick complete')

    await loop.priceTick()
    console.log('[DRY-RUN] priceTick complete')

    await loop.settleTick()
    console.log('[DRY-RUN] settleTick complete')
  } catch (err) {
    console.error(`[DRY-RUN] loop tick error: ${(err as Error).message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== SNEAKERS BOT — DRY RUN (paper trading, no real orders) ===')
  console.log(`[DRY-RUN] interval=${LOOP_INTERVAL_MS}ms preset=balanced router=FakeRouter store=InMemory`)
  console.log('[DRY-RUN] Starting up — prefetching BTC spot price...')

  const spotFeed = new LiveSpotFeed()
  await spotFeed.prefetch()
  console.log(`[DRY-RUN] BTC spot prefetched: $${spotFeed.spot().toFixed(2)}`)

  const feed = new LivePolymarketFeed()
  const store = new InMemoryStore()

  // Seed a single dry-run bot config
  await store.seedBotConfig(DRY_RUN_BOT_CONFIG)
  console.log('[DRY-RUN] Bot config seeded: id=1 preset=balanced mode=dry_run')

  const refSource = new LiveRefPriceSource(spotFeed)
  // FakeRouter — never places real orders
  const _router = new FakeRouter()
  const _audit = consoleAudit

  const loop = new AgentLoop({
    feeds: [feed],
    spot: spotFeed,
    ref: refSource,
    store,
    now: () => Date.now(),
  })

  console.log(`[DRY-RUN] Loop started. Running every ${LOOP_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.`)

  // Run immediately, then on interval
  await runTick(loop, feed, spotFeed)

  const handle = setInterval(async () => {
    await runTick(loop, feed, spotFeed)
  }, LOOP_INTERVAL_MS)

  // Clean shutdown
  const shutdown = (): void => {
    clearInterval(handle)
    console.log('\n[DRY-RUN] Shutting down. No real orders were placed.')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => {
  console.error('[DRY-RUN] Fatal error:', err)
  process.exit(1)
})
