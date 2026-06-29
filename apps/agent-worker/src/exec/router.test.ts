import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeRouter, OrderRequest } from './router'

describe('FakeRouter', () => {
  test('returns filled result and records the call', async () => {
    const router = new FakeRouter()
    const req: OrderRequest = {
      venue: 'polymarket',
      tokenId: 'token-123',
      side: 'BUY',
      sizeUsd: 50,
      clientId: 'client-1',
    }
    const creds = { apiKey: 'key', secret: 'secret', passphrase: 'pass' }

    const result = await router.placeMarketOrder(req, creds)

    assert.equal(result.ok, true)
    assert.equal(result.status, 'filled')
    assert.equal(result.venueOrderId, 'fake-client-1')
    assert.equal(result.filledUsd, 50)
    assert.equal(result.avgPrice, 0.5)
    assert.equal(router.calls.length, 1)
    assert.deepEqual(router.calls[0], req)
  })

  test('idempotent: second call with same clientId does not record duplicate', async () => {
    const router = new FakeRouter()
    const req: OrderRequest = {
      venue: 'polymarket',
      tokenId: 'token-123',
      side: 'BUY',
      sizeUsd: 50,
      clientId: 'client-1',
    }
    const creds = { apiKey: 'key', secret: 'secret', passphrase: 'pass' }

    const result1 = await router.placeMarketOrder(req, creds)
    const result2 = await router.placeMarketOrder(req, creds)

    // Same result returned
    assert.equal(result1.venueOrderId, result2.venueOrderId)
    assert.equal(result1.filledUsd, result2.filledUsd)
    // Only one call recorded
    assert.equal(router.calls.length, 1)
  })

  test('different clientIds record separate calls', async () => {
    const router = new FakeRouter()
    const creds = { apiKey: 'key', secret: 'secret', passphrase: 'pass' }

    const req1: OrderRequest = {
      venue: 'polymarket',
      tokenId: 'token-123',
      side: 'BUY',
      sizeUsd: 50,
      clientId: 'client-1',
    }
    const req2: OrderRequest = {
      venue: 'polymarket',
      tokenId: 'token-456',
      side: 'BUY',
      sizeUsd: 75,
      clientId: 'client-2',
    }

    const result1 = await router.placeMarketOrder(req1, creds)
    const result2 = await router.placeMarketOrder(req2, creds)

    assert.notEqual(result1.venueOrderId, result2.venueOrderId)
    assert.equal(router.calls.length, 2)
    assert.deepEqual(router.calls[0], req1)
    assert.deepEqual(router.calls[1], req2)
  })

  test('canned override result is applied', async () => {
    const router = new FakeRouter({ status: 'pending', error: 'not enough liquidity' })
    const req: OrderRequest = {
      venue: 'polymarket',
      tokenId: 'token-123',
      side: 'BUY',
      sizeUsd: 50,
      clientId: 'client-1',
    }
    const creds = { apiKey: 'key', secret: 'secret', passphrase: 'pass' }

    const result = await router.placeMarketOrder(req, creds)

    assert.equal(result.status, 'pending')
    assert.equal(result.error, 'not enough liquidity')
    // Defaults still apply for unspecified fields
    assert.equal(result.ok, true)
    assert.equal(result.venueOrderId, 'fake-client-1')
  })
})
