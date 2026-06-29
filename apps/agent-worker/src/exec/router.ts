/**
 * Order router interface and implementations.
 * Real PolymarketRouter is intentionally NOT implemented here — it places real orders
 * and is blocked behind Plan 4 Task 1's legal consent gate.
 */

export interface PolymarketCreds {
  apiKey: string
  secret: string
  passphrase: string
}

export interface OrderRequest {
  venue: 'polymarket'
  tokenId: string
  side: 'BUY'
  sizeUsd: number
  clientId: string
}

export interface OrderResult {
  ok: boolean
  venueOrderId?: string
  filledUsd?: number
  avgPrice?: number
  status: 'filled' | 'rejected' | 'error' | 'pending'
  raw?: unknown
  error?: string
}

export interface OrderRouter {
  placeMarketOrder(req: OrderRequest, creds: PolymarketCreds): Promise<OrderResult>
}

/**
 * FakeRouter for testing. Records all calls and returns idempotent filled results.
 * If the same clientId is sent twice, returns the same result without recording
 * a duplicate call.
 */
export class FakeRouter implements OrderRouter {
  calls: OrderRequest[] = []
  private resultMap: Map<string, OrderResult> = new Map()

  constructor(
    private cannedResult?: Partial<OrderResult>
  ) {}

  async placeMarketOrder(req: OrderRequest, _creds: PolymarketCreds): Promise<OrderResult> {
    // Check if we've already seen this clientId
    if (this.resultMap.has(req.clientId)) {
      return this.resultMap.get(req.clientId)!
    }

    // Build the result
    const result: OrderResult = {
      ok: true,
      venueOrderId: `fake-${req.clientId}`,
      filledUsd: req.sizeUsd,
      avgPrice: 0.5,
      status: 'filled',
      ...this.cannedResult,
    }

    // Record the call and result
    this.calls.push(req)
    this.resultMap.set(req.clientId, result)

    return result
  }
}
