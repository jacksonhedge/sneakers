// Chance odds-selection engine (pure).
//
// At checkout a shopper pays `itemPrice + premium`. The premium buys a YES
// position on a REAL market at price `p` (= implied probability); a win pays
// `premium / p`. Sized so a win returns the full amount paid → they pay $0:
//
//     target price  p = premium / (itemPrice + premium)
//
// Pure + source-agnostic: it selects over a `MarketSnapshot[]` the caller
// supplies (live fetch now, cached DB later). No network, no order placement.

import type { MarketSnapshot } from '../markets-data'

// --- risk-$ <-> likelihood (the two faces of pop-up portion 1) ---
export function premiumToProb(premium: number, itemPrice: number): number {
  return premium / (itemPrice + premium)
}
export function probToPremium(targetProb: number, itemPrice: number): number {
  return (targetProb * itemPrice) / (1 - targetProb)
}
/** Implied prob → "X:1" payout label (0.091 → "10:1"). */
export function oddsLabel(prob: number): string {
  if (prob <= 0 || prob >= 1) return '—'
  const x = (1 - prob) / prob
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}:1`
}

/** A tier is defined by EITHER the risk amount or the target likelihood. */
export interface ChanceTier {
  premium?: number
  targetProb?: number
}

export interface ChanceFilters {
  resolveWithinHours?: number
  resolveMinHours?: number
  minLiquidity?: number
  priceTolerance?: number
  /** Require a win to fully cover the purchase (price ≤ target). */
  mustMakeWhole?: boolean
  allowTags?: string[]
  blockTags?: string[]
}

export interface ChanceOffer {
  available: boolean
  premium: number
  targetProb: number
  oddsLabel: string
  itemPrice: number
  marketId: string | null
  question: string | null
  outcome: string | null
  price: number | null
  shares: number | null
  grossPayout: number | null
  /** itemPrice + premium − grossPayout. ≤0 means fully covered (a win = $0). */
  netIfWin: number | null
  resolvesAt: string | null
  resolvesInHours: number | null
  liquidity: number | null
  tags: string[]
}

const DEFAULTS: Required<Omit<ChanceFilters, 'allowTags'>> = {
  resolveWithinHours: 72,
  resolveMinHours: 1,
  minLiquidity: 250,
  priceTolerance: 0.05,
  mustMakeWhole: false,
  blockTags: ['politics', 'elections', 'politician'],
}

interface Candidate {
  marketId: string
  question: string
  outcome: string
  price: number
  resolvesAt: string | null
  resolvesInHours: number | null
  liquidity: number | null
  tags: string[]
}

function toCandidates(snaps: MarketSnapshot[], now: number): Candidate[] {
  const out: Candidate[] = []
  for (const s of snaps) {
    if (s.phase === 'closed') continue
    const resolvesAt = s.resolves_at ?? null
    const resolvesInHours = resolvesAt
      ? (Date.parse(resolvesAt) - now) / 3_600_000
      : null
    for (const o of s.outcomes) {
      const price = o.best_ask
      if (price == null || price <= 0 || price >= 1) continue
      out.push({
        marketId: s.platform_market_id,
        question: s.question,
        outcome: o.name,
        price,
        resolvesAt,
        resolvesInHours,
        liquidity: s.liquidity ?? null,
        tags: s.tags ?? [],
      })
    }
  }
  return out
}

function passes(c: Candidate, f: Required<Omit<ChanceFilters, 'allowTags'>> & ChanceFilters): boolean {
  if (f.minLiquidity != null && (c.liquidity ?? 0) < f.minLiquidity) return false
  if (c.resolvesInHours == null) return false
  if (c.resolvesInHours > f.resolveWithinHours) return false
  if (c.resolvesInHours < f.resolveMinHours) return false
  const tags = c.tags.map((t) => t.toLowerCase())
  if (f.blockTags?.some((b) => tags.includes(b.toLowerCase()))) return false
  if (f.allowTags?.length && !f.allowTags.some((a) => tags.includes(a.toLowerCase()))) return false
  return true
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Build the pre-selected list of Chance offers (pop-up portion 2). Each tier
 * (risk amount OR likelihood) is matched to the best real outcome near its
 * implied price. Tiers with no match return `available: false` (never silently
 * dropped).
 */
export function findChanceOffers(args: {
  itemPrice: number
  tiers: ChanceTier[]
  snapshots: MarketSnapshot[]
  filters?: ChanceFilters
  now?: number
}): ChanceOffer[] {
  const { itemPrice, snapshots } = args
  const f = { ...DEFAULTS, ...(args.filters ?? {}) }
  const now = args.now ?? Date.now()

  const candidates = toCandidates(snapshots, now).filter((c) => passes(c, f))
  const used = new Set<string>()
  const offers: ChanceOffer[] = []

  for (const tier of args.tiers) {
    const targetProb = tier.targetProb ?? premiumToProb(tier.premium!, itemPrice)
    const premium = round2(tier.premium ?? probToPremium(tier.targetProb!, itemPrice))

    const pick = candidates
      .filter((c) => !used.has(`${c.marketId}|${c.outcome}`))
      .filter((c) => Math.abs(c.price - targetProb) <= f.priceTolerance)
      .filter((c) => (f.mustMakeWhole ? c.price <= targetProb : true))
      .sort(
        (a, b) =>
          Math.abs(a.price - targetProb) - Math.abs(b.price - targetProb) ||
          (a.resolvesInHours ?? Infinity) - (b.resolvesInHours ?? Infinity) ||
          (b.liquidity ?? 0) - (a.liquidity ?? 0),
      )[0]

    if (!pick) {
      offers.push({
        available: false,
        premium,
        targetProb,
        oddsLabel: oddsLabel(targetProb),
        itemPrice,
        marketId: null,
        question: null,
        outcome: null,
        price: null,
        shares: null,
        grossPayout: null,
        netIfWin: null,
        resolvesAt: null,
        resolvesInHours: null,
        liquidity: null,
        tags: [],
      })
      continue
    }

    used.add(`${pick.marketId}|${pick.outcome}`)
    const shares = premium / pick.price
    offers.push({
      available: true,
      premium,
      targetProb,
      oddsLabel: oddsLabel(pick.price),
      itemPrice,
      marketId: pick.marketId,
      question: pick.question,
      outcome: pick.outcome,
      price: pick.price,
      shares: round2(shares),
      grossPayout: round2(shares),
      netIfWin: round2(itemPrice + premium - shares),
      resolvesAt: pick.resolvesAt,
      resolvesInHours: pick.resolvesInHours == null ? null : Math.round(pick.resolvesInHours),
      liquidity: pick.liquidity,
      tags: pick.tags,
    })
  }

  return offers
}

/** Default tiers for an item: risk 10% / 20% / 50% of the price. */
export function defaultTiers(itemPrice: number): ChanceTier[] {
  return [0.1, 0.2, 0.5].map((frac) => ({
    premium: Math.max(1, Math.round(itemPrice * frac)),
  }))
}
