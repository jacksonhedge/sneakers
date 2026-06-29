import type { Venue, Side } from '@sneakers/core'
import type { WindowSeed, WindowRow, BotConfigRow, SignalRow, TradeRow, PnlSummary } from '@sneakers/core/db/agent-repo'

export interface PriceTick {
  windowExternalId: string
  yesPrice: number
  atMs: number
}

export interface MarketFeed {
  venue: Venue
  discoverWindows(nowMs: number): Promise<WindowSeed[]>
  latestYesPrice(externalId: string): Promise<number | null>
}

export interface SpotFeed {
  spot(): number
  recentVolPerSec(): number
}

export interface RefPriceSource {
  refPriceAt(atMs: number): Promise<number>
}

export interface WindowStore {
  upsertWindow(seed: WindowSeed): Promise<WindowRow>
  setOpenRef(id: number, price: number): Promise<void>
  setSettle(id: number, price: number, outcome: 'up' | 'down'): Promise<void>
  setStatus(id: number, status: 'upcoming' | 'live' | 'settled'): Promise<void>
  loadOpenWindows(nowMs: number): Promise<WindowRow[]>
  loadBotConfigs(): Promise<BotConfigRow[]>
  insertSignal(signal: Omit<SignalRow, 'id' | 'createdAt'>): Promise<number>
  insertTrade(trade: Omit<TradeRow, 'id' | 'createdAt'>): Promise<number | null>
  openTradesForWindow(windowId: number): Promise<TradeRow[]>
  markTradeSettled(id: number, settlePrice: number, pnl: number, status: 'won' | 'lost'): Promise<void>
  pnlSummary(botConfigId: number): Promise<PnlSummary>
}
