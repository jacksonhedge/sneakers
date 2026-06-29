/**
 * executeDecision — safety-critical live execution path.
 *
 * Order of checks (must be maintained exactly):
 * 1. gate.action !== 'trade' → return (nothing to do)
 * 2. killEnv === true         → audit blocked/admin_kill, never touch router
 * 3. !bot.live_enabled        → audit dry_run/simulated, never touch router
 * 4. liveEligibility fails    → audit blocked/eligibility:<reason>, never touch router
 * 5. clampToCeilings fails    → audit blocked/ceiling:<reason>, never touch router
 * 6. creds === null           → audit blocked/no_creds, never touch router
 * 7. place order via router   → audit live; catch errors → audit live/error (no crash)
 */

import { liveEligibility, type LiveContext } from '@sneakers/core/src/agent/eligibility.js'
import { clampToCeilings } from '@sneakers/core/src/agent/ceilings.js'
import type { BotState, GateResult } from '@sneakers/core'
import type { OrderRouter, PolymarketCreds } from './router.js'

// ── AuditSink interface (fakeable for tests) ─────────────────────────────────

export interface AuditEntry {
  botConfigId: number
  windowId: number | null
  mode: 'dry_run' | 'live' | 'blocked'
  side: 'YES' | 'NO'
  requestedUsd: number
  sizeUsd: number | null
  blockedReason: string | null
  venueOrderId: string | null
  status: string
  filledUsd: number | null
  avgPrice: number | null
  raw: unknown
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<number>
}

// ── Args ─────────────────────────────────────────────────────────────────────

interface ExecuteArgs {
  bot: BotState
  live: LiveContext
  gate: GateResult
  order: {
    tokenId: string
    side: 'YES' | 'NO'
    entryPrice: number
    botConfigId: number
    windowId: number | null
  }
  ceil: {
    spentTodayUsd: number
    openPositions: number
    lastLiveTradeAtMs: number | null
  }
  router: OrderRouter
  audit: AuditSink
  creds: PolymarketCreds | null
  nowMs: number
  killEnv?: boolean
}

// ── Implementation ───────────────────────────────────────────────────────────

export async function executeDecision(args: ExecuteArgs): Promise<void> {
  const { bot, live, gate, order, ceil, router, audit, creds, nowMs } = args

  // Step 1: Nothing to do if gate didn't say trade
  if (gate.action !== 'trade') return

  const requestedUsd = gate.sizeUsdc
  const baseEntry = {
    botConfigId: order.botConfigId,
    windowId: order.windowId,
    side: order.side,
    requestedUsd,
  }

  // Step 2: Admin kill switch — never touch router
  if (args.killEnv === true) {
    await audit.record({
      ...baseEntry,
      mode: 'blocked',
      sizeUsd: null,
      blockedReason: 'admin_kill',
      venueOrderId: null,
      status: 'blocked',
      filledUsd: null,
      avgPrice: null,
      raw: null,
    })
    return
  }

  // Step 3: Bot not live-enabled → simulate
  const liveEnabled = (bot as unknown as Record<string, unknown>).live_enabled
  if (!liveEnabled) {
    await audit.record({
      ...baseEntry,
      mode: 'dry_run',
      sizeUsd: requestedUsd,
      blockedReason: null,
      venueOrderId: null,
      status: 'simulated',
      filledUsd: null,
      avgPrice: null,
      raw: null,
    })
    return
  }

  // Step 4: Eligibility check
  const eligResult = liveEligibility(live)
  if (!eligResult.eligible) {
    await audit.record({
      ...baseEntry,
      mode: 'blocked',
      sizeUsd: null,
      blockedReason: `eligibility:${eligResult.reason}`,
      venueOrderId: null,
      status: 'blocked',
      filledUsd: null,
      avgPrice: null,
      raw: null,
    })
    return
  }

  // Step 5: Ceiling check
  const sizeResult = clampToCeilings({
    requestedUsd,
    spentTodayUsd: ceil.spentTodayUsd,
    openPositions: ceil.openPositions,
    lastLiveTradeAtMs: ceil.lastLiveTradeAtMs,
    nowMs,
  })
  if (!sizeResult.ok) {
    await audit.record({
      ...baseEntry,
      mode: 'blocked',
      sizeUsd: null,
      blockedReason: `ceiling:${sizeResult.reason}`,
      venueOrderId: null,
      status: 'blocked',
      filledUsd: null,
      avgPrice: null,
      raw: null,
    })
    return
  }

  const sizeUsd = sizeResult.sizeUsd

  // Step 6: Credentials required
  if (creds === null) {
    await audit.record({
      ...baseEntry,
      mode: 'blocked',
      sizeUsd: null,
      blockedReason: 'no_creds',
      venueOrderId: null,
      status: 'blocked',
      filledUsd: null,
      avgPrice: null,
      raw: null,
    })
    return
  }

  // Step 7: Place the order
  const clientId = `${order.botConfigId}:${order.windowId}`

  try {
    const result = await router.placeMarketOrder(
      {
        venue: 'polymarket',
        tokenId: order.tokenId,
        side: 'BUY',
        sizeUsd,
        clientId,
      },
      creds,
    )

    await audit.record({
      ...baseEntry,
      mode: 'live',
      sizeUsd,
      blockedReason: null,
      venueOrderId: result.venueOrderId ?? null,
      status: result.status,
      filledUsd: result.filledUsd ?? null,
      avgPrice: result.avgPrice ?? null,
      raw: result.raw ?? null,
    })
  } catch (_err) {
    // Do not crash the loop — record the error in audit
    await audit.record({
      ...baseEntry,
      mode: 'live',
      sizeUsd,
      blockedReason: 'router_error',
      venueOrderId: null,
      status: 'error',
      filledUsd: null,
      avgPrice: null,
      raw: null,
    })
  }
}
