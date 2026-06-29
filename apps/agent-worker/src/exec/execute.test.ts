import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { executeDecision, type AuditEntry, type AuditSink } from './execute.js'
import { FakeRouter } from './router.js'
import type { GateResult, BotState } from '@sneakers/core'
import type { LiveContext } from '@sneakers/core/src/agent/eligibility.js'
import type { PolymarketCreds } from './router.js'

/** In-memory AuditSink for tests */
class FakeAudit implements AuditSink {
  entries: AuditEntry[] = []
  async record(entry: AuditEntry): Promise<number> {
    this.entries.push(entry)
    return this.entries.length
  }
}

/** A FakeRouter that always throws */
class ThrowingRouter extends FakeRouter {
  async placeMarketOrder(): Promise<never> {
    throw new Error('network timeout')
  }
}

// ── Shared fixtures ──────────────────────────────────────────────────────────

const NOW_MS = 1_700_000_000_000

function makeLive(overrides: Partial<LiveContext> = {}): LiveContext {
  return {
    botCreatedAtMs: NOW_MS - 8 * 24 * 60 * 60 * 1000, // 8 days old (passes proof_period)
    settledDryRunTrades: 50,
    consentVersionAccepted: 'v1',
    currentConsentVersion: 'v1',
    venueConnected: true,
    nowMs: NOW_MS,
    ...overrides,
  }
}

function makeBot(overrides: Record<string, unknown> = {}): BotState {
  return {
    preset: 'balanced',
    paused: false,
    killed: false,
    spentTodayUsdc: 0,
    windowsThisHour: 0,
    lastTradeAtMs: null,
    live_enabled: true,
    ...overrides,
  } as unknown as BotState
}

const TRADE_GATE: GateResult = { action: 'trade', sizeUsdc: 30 }
const SKIP_GATE: GateResult = { action: 'skip', reason: 'edge_below_min' }

const CREDS: PolymarketCreds = { apiKey: 'k', secret: 's', passphrase: 'p' }

const ORDER = {
  tokenId: 'token-abc',
  side: 'YES' as const,
  entryPrice: 0.45,
  botConfigId: 7,
  windowId: 42,
}

const CEIL = {
  spentTodayUsd: 0,
  openPositions: 0,
  lastLiveTradeAtMs: null,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('executeDecision', () => {
  test('gate.action !== trade → nothing happens', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: SKIP_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    assert.equal(audit.entries.length, 0, 'no audit entry')
    assert.equal(router.calls.length, 0, 'no router call')
  })

  test('killEnv=true → audit blocked/admin_kill, router untouched', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
      killEnv: true,
    })

    assert.equal(router.calls.length, 0, 'router never called')
    assert.equal(audit.entries.length, 1)
    assert.equal(audit.entries[0].mode, 'blocked')
    assert.equal(audit.entries[0].blockedReason, 'admin_kill')
    assert.equal(audit.entries[0].venueOrderId, null)
    assert.equal(audit.entries[0].sizeUsd, null)
    assert.equal(audit.entries[0].status, 'blocked')
  })

  test('live_enabled false → audit dry_run, router untouched', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot({ live_enabled: false }),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    assert.equal(router.calls.length, 0)
    assert.equal(audit.entries.length, 1)
    assert.equal(audit.entries[0].mode, 'dry_run')
    assert.equal(audit.entries[0].status, 'simulated')
    assert.equal(audit.entries[0].venueOrderId, null)
    // sizeUsd should be gate.sizeUsdc
    assert.equal(audit.entries[0].sizeUsd, 30)
  })

  test('live_enabled missing → treats as dry_run', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot({ live_enabled: undefined }),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    assert.equal(router.calls.length, 0)
    assert.equal(audit.entries[0].mode, 'dry_run')
  })

  test('ineligible (proof_period) → audit blocked, router untouched', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive({ botCreatedAtMs: NOW_MS - 2 * 24 * 60 * 60 * 1000 }), // only 2 days old
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    assert.equal(router.calls.length, 0)
    assert.equal(audit.entries.length, 1)
    assert.equal(audit.entries[0].mode, 'blocked')
    assert.equal(audit.entries[0].blockedReason, 'eligibility:proof_period')
    assert.equal(audit.entries[0].status, 'blocked')
  })

  test('ceiling blocked (cooldown) → audit blocked, router untouched', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: {
        spentTodayUsd: 0,
        openPositions: 0,
        lastLiveTradeAtMs: NOW_MS - 1000, // only 1 second ago (cooldown = 5 min)
      },
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    assert.equal(router.calls.length, 0)
    assert.equal(audit.entries.length, 1)
    assert.equal(audit.entries[0].mode, 'blocked')
    assert.equal(audit.entries[0].blockedReason, 'ceiling:cooldown')
    assert.equal(audit.entries[0].status, 'blocked')
  })

  test('creds null → audit blocked/no_creds, router untouched', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: null,
      nowMs: NOW_MS,
    })

    assert.equal(router.calls.length, 0)
    assert.equal(audit.entries.length, 1)
    assert.equal(audit.entries[0].mode, 'blocked')
    assert.equal(audit.entries[0].blockedReason, 'no_creds')
    assert.equal(audit.entries[0].status, 'blocked')
  })

  test('eligible + ok → exactly ONE router.placeMarketOrder with clamped size + clientId, audit live with fill', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    // Exactly one router call
    assert.equal(router.calls.length, 1)
    const call = router.calls[0]

    // clientId = botConfigId:windowId
    assert.equal(call.clientId, '7:42')
    assert.equal(call.tokenId, ORDER.tokenId)
    assert.equal(call.side, 'BUY')
    assert.equal(call.venue, 'polymarket')

    // sizeUsd clamped by ceilings (gate wants 30, CEIL.perTradeUsd = 50 → 30 passes)
    assert.equal(call.sizeUsd, 30)

    // Audit live entry
    assert.equal(audit.entries.length, 1)
    const entry = audit.entries[0]
    assert.equal(entry.mode, 'live')
    assert.equal(entry.status, 'filled')
    assert.equal(entry.venueOrderId, 'fake-7:42')
    assert.equal(entry.filledUsd, 30)
    assert.equal(entry.avgPrice, 0.5)
    assert.equal(entry.sizeUsd, 30)
    assert.equal(entry.botConfigId, ORDER.botConfigId)
    assert.equal(entry.windowId, ORDER.windowId)
    assert.equal(entry.side, ORDER.side)
  })

  test('eligible + ok, same botConfigId:windowId called twice → second call does not double-submit', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    const args = {
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    }

    await executeDecision(args)
    await executeDecision(args) // same call again

    // FakeRouter is idempotent on clientId, so only 1 call recorded
    assert.equal(router.calls.length, 1, 'router call deduplicated by FakeRouter')
    // Two audit entries (one per executeDecision call)
    assert.equal(audit.entries.length, 2)
    assert.equal(audit.entries[1].mode, 'live')
  })

  test('router throws → audit live/error, no crash', async () => {
    const audit = new FakeAudit()
    const router = new ThrowingRouter()

    // Should NOT throw
    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    assert.equal(audit.entries.length, 1)
    const entry = audit.entries[0]
    assert.equal(entry.mode, 'live')
    assert.equal(entry.status, 'error')
    assert.equal(entry.blockedReason, 'router_error')
    assert.equal(entry.venueOrderId, null)
  })

  // Audit entry always includes botConfigId, windowId, side, requestedUsd
  test('audit entries carry base fields correctly', async () => {
    const audit = new FakeAudit()
    const router = new FakeRouter()

    await executeDecision({
      bot: makeBot(),
      live: makeLive(),
      gate: TRADE_GATE,
      order: ORDER,
      ceil: CEIL,
      router,
      audit,
      creds: CREDS,
      nowMs: NOW_MS,
    })

    const e = audit.entries[0]
    assert.equal(e.botConfigId, 7)
    assert.equal(e.windowId, 42)
    assert.equal(e.side, 'YES')
    assert.equal(e.requestedUsd, 30)
  })
})
