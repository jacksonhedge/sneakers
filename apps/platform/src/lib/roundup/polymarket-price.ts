// Read-only Polymarket price lookup for the round-up portal's Polymarket
// facilitation mode. Hits the same public, unauthenticated gamma API used
// by resolveTokenIds() in lib/autotrade/polymarket.ts -- no CLOB API trio,
// no business account credentials, no order placement. This module never
// calls Polymarket's trading/CLOB surface.

export interface PolymarketPrice {
  question: string
  price: number
}

export async function fetchPolymarketPrice(marketId: string): Promise<PolymarketPrice> {
  const url = `https://gamma-api.polymarket.com/markets/${encodeURIComponent(marketId)}`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`gamma /markets/${marketId} returned ${res.status}`)
  }
  const data = (await res.json()) as { question?: string; outcomePrices?: string | string[] }
  const pricesRaw = data.outcomePrices
  const prices: string[] = Array.isArray(pricesRaw)
    ? pricesRaw
    : typeof pricesRaw === 'string'
      ? (JSON.parse(pricesRaw) as string[])
      : []
  if (prices.length === 0) {
    throw new Error(`gamma response missing outcomePrices for market ${marketId}`)
  }
  // Polymarket convention: outcomes[0] = YES; outcomePrices is parallel.
  const price = Number(prices[0])
  if (!Number.isFinite(price)) {
    throw new Error(`gamma response had a non-numeric YES price for market ${marketId}`)
  }
  return { question: data.question ?? 'Unknown market', price }
}
