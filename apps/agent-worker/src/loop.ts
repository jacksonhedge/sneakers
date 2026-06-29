import {
  evaluateTick,
  secondsToClose,
  settleTrade,
  type MarketWindow,
  type BotState,
} from '@sneakers/core'
import { RollingVol } from './vol'
import type { MarketFeed, SpotFeed, RefPriceSource, WindowStore } from './feeds/types'

interface LoopDeps {
  feeds: MarketFeed[]
  spot: SpotFeed
  ref: RefPriceSource
  store: WindowStore
  now: () => number
}

export class AgentLoop {
  private feeds: MarketFeed[]
  private spot: SpotFeed
  private ref: RefPriceSource
  private store: WindowStore
  private now: () => number
  /** Per-window rolling vol estimator, keyed by windowId */
  private volMap: Map<number, RollingVol> = new Map()

  constructor(deps: LoopDeps) {
    this.feeds = deps.feeds
    this.spot = deps.spot
    this.ref = deps.ref
    this.store = deps.store
    this.now = deps.now
  }

  /**
   * Discover windows from all feeds and upsert them.
   * For windows that have crossed opensAt with no openRefPrice yet,
   * set openRefPrice from ref.refPriceAt(opensAt) and status to 'live'.
   */
  async discoverTick(): Promise<void> {
    const nowMs = this.now()

    for (const feed of this.feeds) {
      const seeds = await feed.discoverWindows(nowMs)
      for (const seed of seeds) {
        const row = await this.store.upsertWindow(seed)

        // Window has opened and we haven't recorded an open ref price yet
        if (nowMs >= row.opensAt && row.openRefPrice === null) {
          const openRef = await this.ref.refPriceAt(row.opensAt)
          await this.store.setOpenRef(row.id, openRef)
          await this.store.setStatus(row.id, 'live')
          // Update local reference to reflect the change
          row.openRefPrice = openRef
          row.status = 'live'
        }
      }
    }
  }

  /**
   * For each live window, evaluate signal+gate for every enabled bot config.
   * On gate action === 'trade', insert a signal and a trade.
   */
  async priceTick(): Promise<void> {
    const nowMs = this.now()
    const openWindows = await this.store.loadOpenWindows(nowMs)
    const liveWindows = openWindows.filter(w => w.status === 'live')

    if (liveWindows.length === 0) return

    const botConfigs = await this.store.loadBotConfigs()
    const enabledBots = botConfigs.filter(b => b.enabled && !b.paused)

    for (const row of liveWindows) {
      // Guard: we need an openRefPrice to compute signal
      if (row.openRefPrice === null) continue

      // Get current market price
      // Find the feed for this venue
      const feed = this.feeds.find(f => f.venue === row.venue)
      if (!feed) continue
      const yesPrice = await feed.latestYesPrice(row.externalId)
      if (yesPrice === null) continue

      // Update rolling vol with spot price
      let vol = this.volMap.get(row.id)
      if (!vol) {
        vol = new RollingVol(60)
        this.volMap.set(row.id, vol)
      }
      vol.push(this.spot.spot(), nowMs)

      // Build PriceState
      const stc = secondsToClose(row as MarketWindow, nowMs)
      const priceState = {
        openRefPrice: row.openRefPrice,
        spot: this.spot.spot(),
        secondsToClose: stc,
        recentVolPerSec: vol.perSec(),
      }

      // Evaluate each enabled bot config that covers this window
      for (const config of enabledBots) {
        if (!config.assets.includes(row.asset)) continue
        if (!config.enabledVenues.includes(row.venue)) continue

        // Build BotState
        const pnl = await this.store.pnlSummary(config.id)
        const botState: BotState = {
          preset: config.riskPreset,
          paused: config.paused,
          killed: false,
          spentTodayUsdc: pnl.spentTodayUsdc,
          windowsThisHour: pnl.windowsThisHour,
          lastTradeAtMs: null,
        }

        const marketWindow: MarketWindow = {
          venue: row.venue,
          asset: row.asset,
          intervalSec: row.intervalSec,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
          referenceOracle: row.referenceOracle,
          openRefPrice: row.openRefPrice,
          settleRefPrice: row.settleRefPrice,
        }

        const { decision, gate } = evaluateTick({
          window: marketWindow,
          price: priceState,
          quote: { yesPrice },
          bot: botState,
          nowMs,
        })

        if (!gate || gate.action !== 'trade') continue
        if (!decision) continue

        // Insert signal
        const signalId = await this.store.insertSignal({
          windowId: row.id,
          kind: 'evaluateTick',
          side: decision.side,
          edgeBps: decision.edgeBps,
          marketProb: decision.marketProb,
          impliedProb: decision.impliedProb,
          secondsToClose: stc,
        })

        // Determine entry price: YES price for YES side, 1 - yesPrice for NO side
        const entryPrice = decision.side === 'YES' ? yesPrice : 1 - yesPrice

        // Insert trade; returns null on unique conflict (already traded this window)
        await this.store.insertTrade({
          botConfigId: config.id,
          windowId: row.id,
          signalId,
          mode: config.mode,
          side: decision.side,
          sizeUsdc: gate.sizeUsdc,
          entryPrice,
          settlePrice: null,
          pnlUsdc: null,
          status: 'open',
        })
        // Silently skip if null (unique conflict — already traded this window)
      }
    }
  }

  /**
   * For windows past closesAt, record settle ref price and outcome,
   * then settle all open trades on those windows.
   */
  async settleTick(): Promise<void> {
    const nowMs = this.now()
    const openWindows = await this.store.loadOpenWindows(nowMs)
    // Find windows whose closesAt has passed (upcoming or live, not yet settled)
    const readyToSettle = openWindows.filter(w => nowMs >= w.closesAt)

    for (const row of readyToSettle) {
      const settleRef = await this.ref.refPriceAt(row.closesAt)
      const outcome: 'up' | 'down' = settleRef >= (row.openRefPrice ?? settleRef) ? 'up' : 'down'

      await this.store.setSettle(row.id, settleRef, outcome)

      // Settle all open trades on this window
      const openTrades = await this.store.openTradesForWindow(row.id)
      for (const trade of openTrades) {
        const result = settleTrade(
          { side: trade.side, sizeUsdc: trade.sizeUsdc, entryPrice: trade.entryPrice },
          { outcome },
        )
        await this.store.markTradeSettled(trade.id, settleRef, result.pnlUsdc, result.status)
      }
    }
  }
}
