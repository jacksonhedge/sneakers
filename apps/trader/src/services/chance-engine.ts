// Chance odds engine — source REAL Polymarket markets that can turn a
// purchase into a "pay $0" outcome.
//
// Product: at checkout, a shopper pays `itemPrice + premium`. The premium
// buys YES shares of a real Polymarket outcome at price `p` (= implied
// probability). If that outcome resolves YES, payout = premium / p. We size
// things so a win returns the full amount paid → the shopper nets $0.
//
//     target price  p = premium / (itemPrice + premium)
//
// This module is READ/SOURCING ONLY. It finds and ranks candidate markets and
// returns a pre-selected list of offers for the Chance pop-up. It does NOT
// place orders — true pass-through execution (wallet + CLOB order + the
// outcome→clobTokenId mapping) is the next phase.
//
// Source-agnostic: pass `snapshots` to use cached prices (production fast
// path), or omit them to live-scrape Polymarket (demo).

import { scrapePolymarket } from '../scrapers/polymarket/scrape.js';
import type { MarketSnapshot } from '../scrapers/types.js';

// ----------------------------------------------------------------------------
// Risk-$  <->  likelihood  (the two faces of pop-up portion 1)
// ----------------------------------------------------------------------------

/** Probability of getting refunded, given how much extra the shopper risks. */
export function premiumToProb(premium: number, itemPrice: number): number {
  return premium / (itemPrice + premium);
}

/** How much extra to risk to achieve a target refund likelihood. */
export function probToPremium(targetProb: number, itemPrice: number): number {
  return (targetProb * itemPrice) / (1 - targetProb);
}

/** Format an implied probability as an "X:1" payout label (e.g. 0.091 → "10:1"). */
export function oddsLabel(prob: number): string {
  if (prob <= 0 || prob >= 1) return '—';
  const x = (1 - prob) / prob;
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}:1`;
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** A tier is defined by EITHER the risk amount or the target likelihood. */
export interface ChanceTier {
  premium?: number;
  targetProb?: number;
}

export interface ChanceFilters {
  /** Only markets resolving within this many hours (shopper finds out soon). */
  resolveWithinHours?: number;
  /** Skip markets resolving sooner than this (avoid about-to-lock books). */
  resolveMinHours?: number;
  /** Minimum market liquidity so a real pass-through order could fill. */
  minLiquidity?: number;
  /** How far an outcome's price may sit from the tier's target (absolute). */
  priceTolerance?: number;
  /** If set, a market's tags must intersect this allow-list. */
  allowTags?: string[];
  /** Markets with any of these tags are excluded (brand safety). */
  blockTags?: string[];
  /** Sport/category tag slugs passed to the live scraper. */
  sports?: string[];
}

export interface ChanceOffer {
  /** Whether a real market was found to back this tier. */
  available: boolean;
  premium: number;
  targetProb: number;
  oddsLabel: string;
  itemPrice: number;
  // --- the backing market (null when unavailable) ---
  marketId: string | null;
  question: string | null;
  outcome: string | null;
  /** Price per YES share = what the shopper effectively pays = implied prob. */
  price: number | null;
  shares: number | null;
  /** Gross payout if it hits (each share resolves to $1). */
  grossPayout: number | null;
  /** itemPrice + premium − grossPayout. ~0 by construction. */
  netIfWin: number | null;
  resolvesAt: string | null;
  resolvesInHours: number | null;
  liquidity: number | null;
  tags: string[];
}

const DEFAULT_FILTERS: Required<Omit<ChanceFilters, 'allowTags' | 'sports'>> & {
  allowTags?: string[];
  sports?: string[];
} = {
  resolveWithinHours: 72,
  resolveMinHours: 1,
  minLiquidity: 500,
  priceTolerance: 0.04,
  blockTags: ['politics', 'elections', 'politician'],
};

interface Candidate {
  marketId: string;
  question: string;
  outcome: string;
  price: number;
  resolvesAt: string | null;
  resolvesInHours: number | null;
  liquidity: number | null;
  tags: string[];
}

// ----------------------------------------------------------------------------
// Selection
// ----------------------------------------------------------------------------

function toCandidates(snaps: MarketSnapshot[], now: number): Candidate[] {
  const out: Candidate[] = [];
  for (const s of snaps) {
    if (s.phase === 'closed') continue;
    const resolvesAt = s.resolves_at ?? null;
    const resolvesInHours = resolvesAt
      ? (Date.parse(resolvesAt) - now) / 3_600_000
      : null;
    for (const o of s.outcomes) {
      const price = o.best_ask; // what you'd pay to buy this outcome
      if (price == null || price <= 0 || price >= 1) continue;
      out.push({
        marketId: s.platform_market_id,
        question: s.question,
        outcome: o.name,
        price,
        resolvesAt,
        resolvesInHours,
        liquidity: s.liquidity ?? null,
        tags: s.tags ?? [],
      });
    }
  }
  return out;
}

function passesFilters(c: Candidate, f: typeof DEFAULT_FILTERS): boolean {
  if (f.minLiquidity != null && (c.liquidity ?? 0) < f.minLiquidity) return false;

  if (c.resolvesInHours != null) {
    if (c.resolvesInHours > f.resolveWithinHours) return false;
    if (c.resolvesInHours < f.resolveMinHours) return false;
  } else {
    // Unknown resolution time — exclude (the shopper must find out within the window).
    return false;
  }

  const tags = c.tags.map((t) => t.toLowerCase());
  if (f.blockTags?.some((b) => tags.includes(b.toLowerCase()))) return false;
  if (f.allowTags?.length && !f.allowTags.some((a) => tags.includes(a.toLowerCase())))
    return false;

  return true;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the pre-selected list of Chance offers for the pop-up.
 *
 * Each tier (risk amount OR target likelihood) is matched to the best real
 * Polymarket outcome trading near its implied price. Tiers with no suitable
 * market come back as `available: false` rather than being silently dropped.
 */
export async function findChanceOffers(args: {
  itemPrice: number;
  tiers: ChanceTier[];
  filters?: ChanceFilters;
  /** Inject cached snapshots; omit to live-scrape Polymarket. */
  snapshots?: MarketSnapshot[];
}): Promise<ChanceOffer[]> {
  const { itemPrice } = args;
  const f = { ...DEFAULT_FILTERS, ...(args.filters ?? {}) };

  const snaps =
    args.snapshots ??
    (await scrapePolymarket({ sports: f.sports, limit: 50, withOrderbook: true }));

  const now = Date.now();
  const candidates = toCandidates(snaps, now).filter((c) => passesFilters(c, f));

  const used = new Set<string>(); // one market+outcome per offer list
  const offers: ChanceOffer[] = [];

  for (const tier of args.tiers) {
    const targetProb =
      tier.targetProb ?? premiumToProb(tier.premium!, itemPrice);
    const premium = round2(
      tier.premium ?? probToPremium(tier.targetProb!, itemPrice),
    );

    const pick = candidates
      .filter((c) => !used.has(`${c.marketId}|${c.outcome}`))
      .filter((c) => Math.abs(c.price - targetProb) <= f.priceTolerance)
      .sort(
        (a, b) =>
          Math.abs(a.price - targetProb) - Math.abs(b.price - targetProb) ||
          (a.resolvesInHours ?? Infinity) - (b.resolvesInHours ?? Infinity) ||
          (b.liquidity ?? 0) - (a.liquidity ?? 0),
      )[0];

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
      });
      continue;
    }

    used.add(`${pick.marketId}|${pick.outcome}`);
    const shares = premium / pick.price;
    const grossPayout = shares; // each share pays $1 on YES
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
      grossPayout: round2(grossPayout),
      netIfWin: round2(itemPrice + premium - grossPayout),
      resolvesAt: pick.resolvesAt,
      resolvesInHours:
        pick.resolvesInHours == null ? null : Math.round(pick.resolvesInHours),
      liquidity: pick.liquidity,
      tags: pick.tags,
    });
  }

  return offers;
}

/** Default tiers for an item: risk 10% / 20% / 50% of the price. */
export function defaultTiers(itemPrice: number): ChanceTier[] {
  return [0.1, 0.2, 0.5].map((frac) => ({
    premium: Math.max(1, Math.round(itemPrice * frac)),
  }));
}

// ----------------------------------------------------------------------------
// CLI demo:  tsx src/services/chance-engine.ts --price=50 [--premiums=5,10,25]
// ----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const get = (k: string) =>
    args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];

  const itemPrice = Number(get('price') ?? 50);
  const premiumsArg = get('premiums');
  const probsArg = get('probs');

  let tiers: ChanceTier[];
  if (premiumsArg) {
    tiers = premiumsArg.split(',').map((p) => ({ premium: Number(p) }));
  } else if (probsArg) {
    tiers = probsArg.split(',').map((p) => ({ targetProb: Number(p) }));
  } else {
    tiers = defaultTiers(itemPrice);
  }

  console.log(
    `\nChance offers for a $${itemPrice} item — sourcing real Polymarket markets…\n`,
  );
  const offers = await findChanceOffers({ itemPrice, tiers });

  for (const o of offers) {
    const head = `RISK $${o.premium}  ·  ${o.oddsLabel}  ·  ${(o.targetProb * 100).toFixed(1)}% to pay $0`;
    if (!o.available) {
      console.log(`  ${head}\n     (no market near this tier right now)\n`);
      continue;
    }
    console.log(`  ${head}`);
    console.log(`     market : ${o.question}`);
    console.log(
      `     bet    : YES "${o.outcome}" @ $${o.price?.toFixed(3)}  →  ${o.shares} shares  →  pays $${o.grossPayout}`,
    );
    console.log(
      `     net win: $${o.netIfWin}   resolves in ~${o.resolvesInHours}h   liquidity $${Math.round(o.liquidity ?? 0).toLocaleString()}`,
    );
    console.log('');
  }
}

const invokedPath = process.argv[1] ?? '';
if (invokedPath.endsWith('chance-engine.ts') || invokedPath.endsWith('chance-engine.js')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
