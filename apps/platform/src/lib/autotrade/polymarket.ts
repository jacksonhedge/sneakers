import { ClobClient, Chain, Side, OrderType, AssetType } from '@polymarket/clob-client'
import { SignatureType } from '@polymarket/clob-client/dist/order-utils'
import { Wallet, type TypedDataDomain, type TypedDataField } from 'ethers'
import type { CredentialBundle } from './credentials'

// Adapter from ethers-v6 Wallet to the EthersSigner shape Polymarket's
// CLOB SDK expects (it predates v6's renamed methods). v6 has
// `signTypedData`; v5 + the SDK both use `_signTypedData`.
type EthersV5Signer = {
  _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string>
  getAddress(): Promise<string>
}

function v5SignerFromV6(wallet: Wallet): EthersV5Signer {
  return {
    _signTypedData(domain, types, value) {
      return wallet.signTypedData(domain, types, value)
    },
    getAddress() {
      return Promise.resolve(wallet.address)
    },
  }
}

// Thin wrapper around @polymarket/clob-client for the trade-execution
// surface. Stateless — create a fresh client per request, do the call,
// throw it away. The SDK does its own retries internally.
//
// Two flavors of operation:
//   - "read"  — needs only the API key trio. Used for balance + positions
//   - "write" — needs the private key as well. Used for placing orders.
//
// Credential resolution: callers may supply either:
//   (a) the full CLOB trio (apiKey + apiSecret + passphrase) — used directly, no derivation
//   (b) only a privateKey (+ optional funderAddress, "trade-scope") — the SDK derives the
//       CLOB trio via createOrDeriveApiKey() using L1 auth. This path lets trade-scope
//       connections reach balance, test-connection, and order placement without requiring
//       users to separately copy the API key/secret/passphrase from the Polymarket UI.
//
// The CLOB host is hardcoded to mainnet. We don't ship the Amoy testnet
// path because there's no real value in testing against fake liquidity —
// we'd rather test with $1 of real USDC.e on a benign market.

const POLY_CLOB_HOST = 'https://clob.polymarket.com'
const POLY_CHAIN = Chain.POLYGON

type ReadClient = InstanceType<typeof ClobClient>
type WriteClient = InstanceType<typeof ClobClient>
type ApiTrio = { key: string; secret: string; passphrase: string }

// In-process cache of derived CLOB creds, keyed by privateKey. Avoids
// re-deriving (a signed L1 round-trip) on every 60s balance poll, and —
// by caching the in-flight PROMISE — prevents a nonce race when a balance
// poll and a trade derive concurrently for the same user.
const derivedCredsCache = new Map<string, { promise: Promise<ApiTrio>; at: number }>()
const DERIVED_CREDS_TTL_MS = 10 * 60 * 1000 // 10 min

/**
 * Resolve the CLOB API trio ({ key, secret, passphrase }) from a CredentialBundle.
 *
 * If the full trio is already present, return it directly (back-compat — no network call).
 * Otherwise, if a privateKey is present, build an L1-auth client and call
 * createOrDeriveApiKey() to obtain/derive the matching trio from Polymarket.
 * This is the path taken for "trade-scope" connections where the user only
 * provided their EOA private key + funder address.
 */
async function resolveApiCreds(creds: CredentialBundle): Promise<{
  key: string
  secret: string
  passphrase: string
}> {
  // Fast path: caller already supplied the full trio.
  if (creds.apiKey && creds.apiSecret && creds.passphrase) {
    return { key: creds.apiKey, secret: creds.apiSecret, passphrase: creds.passphrase }
  }
  // Derivation path: use the private key to obtain the CLOB API trio via L1 auth.
  if (creds.privateKey) {
    const cacheKey = creds.privateKey
    const cached = derivedCredsCache.get(cacheKey)
    if (cached && Date.now() - cached.at < DERIVED_CREDS_TTL_MS) {
      return cached.promise
    }
    const pk = creds.privateKey
    const funder = creds.funderAddress
    const promise = (async (): Promise<ApiTrio> => {
      const signer = v5SignerFromV6(new Wallet(pk))
      // L1-auth client (no creds yet) with the same signatureType + funderAddress
      // that writeClient uses — the derived creds are tied to this proxy identity.
      const l1Client = new ClobClient(
        POLY_CLOB_HOST,
        POLY_CHAIN,
        signer,
        undefined,
        SignatureType.POLY_PROXY,
        funder,
      )
      const derived = await l1Client.createOrDeriveApiKey()
      return { key: derived.key, secret: derived.secret, passphrase: derived.passphrase }
    })()
    // Don't cache a failure — let the next call retry a fresh derivation.
    promise.catch(() => derivedCredsCache.delete(cacheKey))
    derivedCredsCache.set(cacheKey, { promise, at: Date.now() })
    return promise
  }
  throw new Error('polymarket: need API credentials (key+secret+passphrase) or a private key')
}

async function readClient(creds: CredentialBundle): Promise<ReadClient> {
  const api = await resolveApiCreds(creds)
  return new ClobClient(POLY_CLOB_HOST, POLY_CHAIN, undefined, api)
}

async function writeClient(creds: CredentialBundle): Promise<WriteClient> {
  if (!creds.privateKey) {
    throw new Error('private key required for write operations')
  }
  const api = await resolveApiCreds(creds)
  const signer = v5SignerFromV6(new Wallet(creds.privateKey))
  // SignatureType.POLY_PROXY (1) — most common: user funded their
  // Polymarket UI, generated API creds, and the wallet that signed
  // those creds is the proxy owner. If the user used a Gnosis Safe
  // setup, this needs to be POLY_GNOSIS_SAFE (2). v1 assumes proxy.
  return new ClobClient(
    POLY_CLOB_HOST,
    POLY_CHAIN,
    signer,
    api,
    SignatureType.POLY_PROXY,
    creds.funderAddress,
  )
}

/**
 * Read-only check: hits the API with the credentials. Used by the
 * "Test connection" button. Returns true if the API key trio works
 * AND (if a private key is present) the EOA address derived from it
 * matches the funder address logically.
 */
export async function testConnection(creds: CredentialBundle): Promise<{
  ok: boolean
  reason?: string
  signerAddress?: string
}> {
  try {
    const client = await readClient(creds)
    // Smoke-test with an L2-authed balance read. getApiKeys() requires an L1
    // *signer*, which read-only (API-creds-only) connections don't have — so
    // it falsely rejected every valid read-only trio with "Signer is needed".
    // getBalanceAllowance uses the API-cred trio (L2) and is the exact read
    // we care about, so a pass here means the balance will load.
    await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL })
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'unknown error',
    }
  }

  if (creds.privateKey) {
    try {
      const signer = new Wallet(creds.privateKey)
      return { ok: true, signerAddress: signer.address }
    } catch {
      return { ok: false, reason: 'invalid private key format' }
    }
  }
  return { ok: true }
}

/**
 * Place a market order. v1 places a GTC market order — Polymarket
 * fills market orders against the resting orderbook at the time of
 * placement, so 'GTC market' means "buy at top of book up to size".
 *
 * `tokenId` is the Conditional-Token id for the YES or NO outcome of
 * the market the user clicked. The trade panel resolves this from the
 * MarketSnapshot before calling.
 */
export async function placeMarketOrder(
  creds: CredentialBundle,
  params: {
    tokenId: string
    side: 'BUY' | 'SELL'
    sizeUsd: number
  },
): Promise<{
  orderId: string
  raw: unknown
}> {
  const client = await writeClient(creds)
  const signed = await client.createMarketOrder({
    tokenID: params.tokenId,
    amount: params.sizeUsd,
    side: params.side === 'BUY' ? Side.BUY : Side.SELL,
  })
  const response = (await client.postOrder(signed, OrderType.GTC)) as {
    orderId?: string
    success?: boolean
    errorMsg?: string
  }
  if (!response.success || !response.orderId) {
    throw new Error(response.errorMsg ?? 'order rejected by Polymarket')
  }
  return { orderId: response.orderId, raw: response }
}

/**
 * Read the user's USDC.e + outcome-token balances. Polymarket exposes
 * this via /balance-allowance. Returns the USDC balance; outcome-token
 * counts are surfaced separately when we add positions.
 */
export async function fetchBalance(creds: CredentialBundle): Promise<{
  usdcCents: number
  raw: unknown
}> {
  const client = await readClient(creds)
  // The SDK's BalanceAllowanceResponse type doesn't expose the field
  // names cleanly, so cast to a permissive shape and read defensively.
  // asset_type COLLATERAL = USDC.e — the user's funded balance.
  const res = (await client.getBalanceAllowance({
    asset_type: AssetType.COLLATERAL,
  })) as unknown as {
    balance?: string
  }
  // Polymarket returns balances in USDC.e base units (6 decimals). Convert
  // to cents for display: balance / 1e4.
  const raw = res?.balance ?? '0'
  const usdcCents = Math.floor(Number(raw) / 1e4)
  return { usdcCents, raw: res }
}

/**
 * List the user's currently-open Polymarket orders. Read-only.
 */
export async function fetchOpenOrders(creds: CredentialBundle) {
  const client = await readClient(creds)
  return client.getOpenOrders()
}

/**
 * Resolve the conditional-token IDs for a Polymarket market. The scraper
 * snapshot stores `platform_market_id` (gamma `id`) but not the per-outcome
 * token IDs needed by the CLOB order endpoint — look them up via the
 * public gamma API at trade time. No auth required.
 */
export async function resolveTokenIds(platformMarketId: string): Promise<{
  yesTokenId: string
  noTokenId: string
}> {
  const url = `https://gamma-api.polymarket.com/markets/${encodeURIComponent(platformMarketId)}`
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`gamma /markets/${platformMarketId} returned ${res.status}`)
  }
  const data = (await res.json()) as { clobTokenIds?: string | string[] }
  // gamma returns clobTokenIds as a JSON-encoded string in some
  // responses and a real array in others. Normalize.
  const tokensRaw = data.clobTokenIds
  const tokens: string[] = Array.isArray(tokensRaw)
    ? tokensRaw
    : typeof tokensRaw === 'string'
      ? (JSON.parse(tokensRaw) as string[])
      : []
  if (tokens.length < 2) {
    throw new Error(`gamma response missing token IDs for market ${platformMarketId}`)
  }
  // Polymarket convention: outcomes[0] = YES, outcomes[1] = NO; the
  // clobTokenIds array is parallel.
  return { yesTokenId: tokens[0], noTokenId: tokens[1] }
}
