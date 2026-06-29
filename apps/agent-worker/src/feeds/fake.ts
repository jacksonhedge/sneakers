import type { Venue, Side, Outcome } from '@sneakers/core'
import type { WindowSeed, WindowRow, BotConfigRow, SignalRow, TradeRow, PnlSummary } from '@sneakers/core/db/agent-repo'
import type { MarketFeed, SpotFeed, RefPriceSource, WindowStore } from './types'

interface FakeSeedWithPrice {
  seed: WindowSeed
  yesPrice: number
}

export class FakeMarketFeed implements MarketFeed {
  venue: Venue
  private seeds: FakeSeedWithPrice[]
  private priceMap: Map<string, number>

  constructor(venue: Venue, seeds: FakeSeedWithPrice[]) {
    this.venue = venue
    this.seeds = seeds
    this.priceMap = new Map(seeds.map(s => [s.seed.externalId, s.yesPrice]))
  }

  async discoverWindows(nowMs: number): Promise<WindowSeed[]> {
    return this.seeds.map(s => s.seed)
  }

  async latestYesPrice(externalId: string): Promise<number | null> {
    return this.priceMap.get(externalId) ?? null
  }
}

export class FakeSpotFeed implements SpotFeed {
  private spotValue: number
  private volPerSec: number

  constructor(spot: number, volPerSec: number = 0) {
    this.spotValue = spot
    this.volPerSec = volPerSec
  }

  spot(): number {
    return this.spotValue
  }

  recentVolPerSec(): number {
    return this.volPerSec
  }
}

export class FakeRefSource implements RefPriceSource {
  private price: number

  constructor(price: number) {
    this.price = price
  }

  async refPriceAt(atMs: number): Promise<number> {
    return this.price
  }
}

export class InMemoryStore implements WindowStore {
  private windows: Map<string, WindowRow> = new Map()
  private botConfigs: BotConfigRow[] = []
  private signals: Map<number, SignalRow> = new Map()
  private trades: Map<number, TradeRow> = new Map()
  private nextWindowId: number = 1
  private nextSignalId: number = 1
  private nextTradeId: number = 1
  private nextBotConfigId: number = 1

  async upsertWindow(seed: WindowSeed): Promise<WindowRow> {
    const key = `${seed.venue}:${seed.externalId}`
    if (this.windows.has(key)) {
      return this.windows.get(key)!
    }

    const row: WindowRow = {
      id: this.nextWindowId++,
      venue: seed.venue,
      asset: seed.asset,
      intervalSec: seed.intervalSec,
      externalId: seed.externalId,
      opensAt: seed.opensAt,
      closesAt: seed.closesAt,
      referenceOracle: seed.referenceOracle,
      openRefPrice: null,
      settleRefPrice: null,
      outcome: null,
      status: 'upcoming',
    }
    this.windows.set(key, row)
    return row
  }

  async setOpenRef(id: number, price: number): Promise<void> {
    for (const window of this.windows.values()) {
      if (window.id === id) {
        window.openRefPrice = price
        return
      }
    }
  }

  async setSettle(id: number, price: number, outcome: Outcome): Promise<void> {
    for (const window of this.windows.values()) {
      if (window.id === id) {
        window.settleRefPrice = price
        window.outcome = outcome
        window.status = 'settled'
        return
      }
    }
  }

  async setStatus(id: number, status: 'upcoming' | 'live' | 'settled'): Promise<void> {
    for (const window of this.windows.values()) {
      if (window.id === id) {
        window.status = status
        return
      }
    }
  }

  async loadOpenWindows(nowMs: number): Promise<WindowRow[]> {
    const results: WindowRow[] = []
    for (const window of this.windows.values()) {
      if (window.status === 'upcoming' || window.status === 'live') {
        results.push(window)
      }
    }
    return results
  }

  async loadBotConfigs(): Promise<BotConfigRow[]> {
    return this.botConfigs
  }

  async insertSignal(signal: Omit<SignalRow, 'id' | 'createdAt'>): Promise<number> {
    const id = this.nextSignalId++
    const now = Date.now()
    this.signals.set(id, {
      id,
      ...signal,
      createdAt: now,
    })
    return id
  }

  async insertTrade(trade: Omit<TradeRow, 'id' | 'createdAt'>): Promise<number | null> {
    // Enforce one-per-(bot,window) constraint
    for (const existing of this.trades.values()) {
      if (existing.botConfigId === trade.botConfigId && existing.windowId === trade.windowId) {
        return null
      }
    }

    const id = this.nextTradeId++
    const now = Date.now()
    this.trades.set(id, {
      id,
      ...trade,
      createdAt: now,
    })
    return id
  }

  async openTradesForWindow(windowId: number): Promise<TradeRow[]> {
    const results: TradeRow[] = []
    for (const trade of this.trades.values()) {
      if (trade.windowId === windowId && trade.status === 'open') {
        results.push(trade)
      }
    }
    return results
  }

  async markTradeSettled(id: number, settlePrice: number, pnl: number, status: 'won' | 'lost'): Promise<void> {
    const trade = this.trades.get(id)
    if (trade) {
      trade.settlePrice = settlePrice
      trade.pnlUsdc = pnl
      trade.status = status
    }
  }

  async pnlSummary(botConfigId: number): Promise<PnlSummary> {
    const now = Date.now()
    const todayStart = new Date(now).setHours(0, 0, 0, 0)
    const hourAgo = now - 3600000

    let todayUsdc = 0
    let allTimeUsdc = 0
    let spentTodayUsdc = 0
    let windowsThisHour = 0

    for (const trade of this.trades.values()) {
      if (trade.botConfigId === botConfigId) {
        if (trade.status === 'won' || trade.status === 'lost') {
          allTimeUsdc += trade.pnlUsdc ?? 0

          if (trade.createdAt >= todayStart) {
            todayUsdc += trade.pnlUsdc ?? 0
          }
        }

        if (trade.createdAt >= todayStart) {
          spentTodayUsdc += trade.sizeUsdc
        }

        if (trade.createdAt >= hourAgo) {
          windowsThisHour++
        }
      }
    }

    return {
      todayUsdc,
      allTimeUsdc,
      spentTodayUsdc,
      windowsThisHour,
    }
  }
}
