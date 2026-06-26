import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateTick, type WindowTick } from './evaluate'
import type { MarketWindow } from './window'
import type { BotState } from './gate'

const window: MarketWindow = {
  venue: 'polymarket', asset: 'BTC', intervalSec: 300,
  opensAt: 0, closesAt: 300_000, referenceOracle: 'chainlink:BTC-USD',
  openRefPrice: 100, settleRefPrice: null,
}
const bot: BotState = {
  preset: 'balanced', paused: false, killed: false,
  spentTodayUsdc: 0, windowsThisHour: 0, lastTradeAtMs: null,
}

describe('evaluateTick', () => {
  test('edge present + within gate -> decision and trade', () => {
    const t: WindowTick = {
      window,
      price: { openRefPrice: 100, spot: 103, secondsToClose: 1, recentVolPerSec: 0.8 },
      quote: { yesPrice: 0.85 },
      bot,
      nowMs: 299_000,
    }
    const out = evaluateTick(t)
    assert.equal(out.decision?.side, 'YES')
    assert.equal(out.gate?.action, 'trade')
  })

  test('no edge -> decision flows to gate', () => {
    const t: WindowTick = {
      window,
      price: { openRefPrice: 100, spot: 100, secondsToClose: 4, recentVolPerSec: 1 },
      quote: { yesPrice: 0.5 },
      bot,
      nowMs: 296_000,
    }
    const out = evaluateTick(t)
    assert.ok(out.decision)
    assert.equal(out.decision.edgeBps, 0)
    assert.deepEqual(out.gate, { action: 'skip', reason: 'edge_below_min' })
  })

  test('edge present but gate skips (paused)', () => {
    const t: WindowTick = {
      window,
      price: { openRefPrice: 100, spot: 103, secondsToClose: 1, recentVolPerSec: 0.8 },
      quote: { yesPrice: 0.85 },
      bot: { ...bot, paused: true },
      nowMs: 299_000,
    }
    const out = evaluateTick(t)
    assert.ok(out.decision)
    assert.deepEqual(out.gate, { action: 'skip', reason: 'paused' })
  })
})
