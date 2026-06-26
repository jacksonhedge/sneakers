export type Venue = 'polymarket' | 'kalshi'
export type Asset = 'BTC' | 'ETH' | 'SOL' | 'XRP'
export type Side = 'YES' | 'NO'
export type Outcome = 'up' | 'down'
export type WindowStatus = 'upcoming' | 'live' | 'settled'

export interface MarketWindow {
  venue: Venue
  asset: Asset
  intervalSec: number
  opensAt: number
  closesAt: number
  referenceOracle: string
  openRefPrice: number | null
  settleRefPrice: number | null
}

export function secondsToClose(w: MarketWindow, nowMs: number): number {
  return Math.max(0, Math.floor((w.closesAt - nowMs) / 1000))
}

export function windowStatus(w: MarketWindow, nowMs: number): WindowStatus {
  if (nowMs < w.opensAt) return 'upcoming'
  if (nowMs >= w.closesAt) return 'settled'
  return 'live'
}
