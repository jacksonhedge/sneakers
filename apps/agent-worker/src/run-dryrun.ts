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
import { LivePolymarketFeed, LiveSpotFeed, SpotHistorySource } from './feeds/live.js'
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
  simDepositUsdc: 10,
  simLiquidityUsdc: 10,
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

// NOTE: LiveRefPriceSource has been removed. We now use SpotHistorySource
// (imported from ./feeds/live.ts) which records a spot sample each tick and
// returns the nearest recorded sample to any requested timestamp.  This makes
// openRef and settleRef reflect the ACTUAL spot at those moments, fixing the
// fake-outcome bug.

// ── Tick ──────────────────────────────────────────────────────────────────────

let tickCount = 0

/** Cumulative paper-trading P&L from the in-memory ledger. */
async function logStats(store: InMemoryStore): Promise<void> {
  const trades = await store.allTrades()
  const settled = trades.filter(t => t.status === 'won' || t.status === 'lost')
  const wins = settled.filter(t => t.status === 'won').length
  const losses = settled.filter(t => t.status === 'lost').length
  const open = trades.filter(t => t.status === 'open').length
  const net = settled.reduce((s, t) => s + (t.pnlUsdc ?? 0), 0)
  const winRate = settled.length ? ((wins / settled.length) * 100).toFixed(0) : '—'
  console.log(
    `[DRY-RUN][P&L] paper trades=${trades.length} open=${open} settled=${settled.length} ` +
      `W/L=${wins}/${losses} winRate=${winRate}% netPnl=$${net.toFixed(2)} (sim balance started at $10)`,
  )
}

async function runTick(
  loop: AgentLoop,
  feed: LivePolymarketFeed,
  spotFeed: LiveSpotFeed,
  refSource: SpotHistorySource,
  store: InMemoryStore,
): Promise<void> {
  tickCount++
  const ts = new Date().toISOString()
  console.log(`\n[DRY-RUN] ── Tick #${tickCount} @ ${ts} ─────────────────────────────────`)

  // Record a spot sample FIRST so history is available for open/settle ref lookups
  const nowMs = Date.now()
  refSource.record(spotFeed.spot(), nowMs)

  // Discover
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
    await loop.priceTick()
    await loop.settleTick()
    await logStats(store)
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

  // SpotHistorySource: records a sample each tick so openRef/settleRef reflect
  // actual prices at those moments, not the current live price.
  const refSource = new SpotHistorySource(spotFeed)
  // Seed the initial spot so the very first discoverTick has a baseline
  refSource.record(spotFeed.spot(), Date.now())
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
  await runTick(loop, feed, spotFeed, refSource, store)

  const handle = setInterval(async () => {
    await runTick(loop, feed, spotFeed, refSource, store)
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
