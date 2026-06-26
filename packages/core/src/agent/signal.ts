import { normCdf } from './mathx'
import type { Side } from './window'

export interface PriceState {
  openRefPrice: number
  spot: number
  secondsToClose: number
  recentVolPerSec: number
}

export interface MarketQuote {
  yesPrice: number
}

export interface SignalDecision {
  side: Side
  impliedProb: number
  marketProb: number
  edgeBps: number
}

// Probability the price finishes on the "up" side (spot_close >= openRef),
// modeling the remaining move as Normal(0, vol * sqrt(secondsToClose)).
export function impliedProbUp(s: PriceState): number {
  const gap = s.spot - s.openRefPrice
  if (s.secondsToClose <= 0) return gap >= 0 ? 1 : 0
  const sigma = s.recentVolPerSec * Math.sqrt(s.secondsToClose)
  if (sigma <= 0) return gap >= 0 ? 1 : 0
  return normCdf(gap / sigma)
}

// Pick the side whose true probability exceeds its market price. The two
// sides' edges are exact negatives, so at most one is positive; equality
// means no edge.
export function evaluateSignal(s: PriceState, q: MarketQuote): SignalDecision | null {
  const pUp = impliedProbUp(s)
  if (pUp > q.yesPrice) {
    const edge = pUp - q.yesPrice
    return { side: 'YES', impliedProb: pUp, marketProb: q.yesPrice, edgeBps: Math.round(edge * 10000) }
  }
  const noImplied = 1 - pUp
  const noMarket = 1 - q.yesPrice
  if (noImplied > noMarket) {
    const edge = noImplied - noMarket
    return { side: 'NO', impliedProb: noImplied, marketProb: noMarket, edgeBps: Math.round(edge * 10000) }
  }
  return null
}
