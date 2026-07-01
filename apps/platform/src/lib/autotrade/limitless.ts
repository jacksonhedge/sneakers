import { createHmac } from 'node:crypto'
import type { CredentialBundle } from './credentials'

// Limitless Exchange API auth: HMAC-SHA256 signed tokens.
//
// How a user creates credentials (limitless.exchange):
//   1. Connect a wallet at limitless.exchange.
//   2. Go to Profile → API Tokens → "Derive API Token".
//   3. Copy the Token ID (UUID) and the Secret (shown ONCE — save it immediately).
//
// Per-request signing:
//   message   = `${timestamp}\n${METHOD}\n${path+query}\n${body}`
//   signature = base64( HMAC-SHA256(secret, message) )
//   timestamp = ISO-8601 string, must be within 30s of server time
//
// Headers: lmts-api-key, lmts-timestamp, lmts-signature
//
// The CredentialBundle mapping:
//   apiKey    → tokenId (UUID from the "derive" step)
//   apiSecret → token secret (the HMAC key, shown only once)
//
// A second read-only path (no credentials needed) exists via:
//   GET /portfolio/{walletAddress}/positions — public by wallet address.
// We use the authenticated path (allowance endpoint) for balance so a
// wallet address alone isn't required for the credentialed integration.

const API_BASE = 'https://api.limitless.exchange'

// Builds the three HMAC auth headers for a Limitless request.
function buildAuthHeaders(
  tokenId: string,
  secret: string,
  method: 'GET' | 'POST' | 'DELETE',
  pathAndQuery: string,
  body = '',
): Record<string, string> {
  const timestamp = new Date().toISOString()
  // Limitless HMAC payload format: timestamp\nMETHOD\npathAndQuery\nbody
  const message = `${timestamp}\n${method}\n${pathAndQuery}\n${body}`
  const signature = createHmac('sha256', secret).update(message).digest('base64')
  return {
    'lmts-api-key': tokenId,
    'lmts-timestamp': timestamp,
    'lmts-signature': signature,
    accept: 'application/json',
  }
}

async function limitlessGet<T>(
  creds: CredentialBundle,
  pathAndQuery: string,
): Promise<{ ok: boolean; status: number; body: T | null; raw: string }> {
  if (!creds.apiKey || !creds.apiSecret) {
    throw new Error('limitless: tokenId (apiKey) and secret (apiSecret) are required')
  }
  const headers = buildAuthHeaders(creds.apiKey, creds.apiSecret, 'GET', pathAndQuery)
  const res = await fetch(`${API_BASE}${pathAndQuery}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  })
  const raw = await res.text()
  let body: T | null = null
  try {
    body = raw ? (JSON.parse(raw) as T) : null
  } catch {
    body = null
  }
  return { ok: res.ok, status: res.status, body, raw }
}

// Allowance shape from GET /portfolio/trading/allowance?type=clob
interface LimitlessAllowance {
  allowance?: string | number
  hasMinimumAllowance?: boolean
  checkedAddress?: string
}

/**
 * Fetch the user's USDC allowance (trading balance) on Limitless.
 *
 * Limitless uses USDC on Base (6 decimals). The `allowance` field is
 * in wei (base units). We convert to cents: allowance / 1e4.
 *
 * If the allowance endpoint doesn't surface a human-readable balance,
 * the positions endpoint is the authoritative fallback. v1 uses allowance
 * because it is the lightest call — a single number, no pagination.
 */
export async function fetchBalance(creds: CredentialBundle): Promise<{
  cents: number
  raw: unknown
}> {
  const path = '/portfolio/trading/allowance?type=clob'
  const res = await limitlessGet<LimitlessAllowance>(creds, path)
  if (!res.ok) {
    throw new Error(
      `limitless ${path} returned ${res.status}: ${res.raw.slice(0, 200)}`,
    )
  }
  const payload = res.body
  const rawAmount = payload?.allowance ?? 0
  // allowance is in USDC base units (6 decimals). Convert to cents.
  const amount = typeof rawAmount === 'string' ? Number(rawAmount) : (rawAmount as number)
  const cents = Number.isFinite(amount) ? Math.floor(amount / 1e4) : 0
  return { cents, raw: res.body }
}

/**
 * Test connection: hit the allowance endpoint with the supplied credentials.
 * A 401 means the tokenId or secret is wrong. A 200 means the token works.
 */
export async function testConnection(creds: CredentialBundle): Promise<{
  ok: boolean
  reason?: string
}> {
  if (!creds.apiKey) return { ok: false, reason: 'missing Token ID' }
  if (!creds.apiSecret) return { ok: false, reason: 'missing token secret' }
  try {
    const path = '/portfolio/trading/allowance?type=clob'
    const res = await limitlessGet<LimitlessAllowance>(creds, path)
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason:
          'Limitless rejected the credentials — check that the Token ID and Secret are correct and the token has not been revoked.',
      }
    }
    if (res.status === 404) {
      return {
        ok: false,
        reason: `Limitless returned 404 for ${path} — the endpoint path may have changed in lib/autotrade/limitless.ts.`,
      }
    }
    return { ok: false, reason: `Limitless returned ${res.status}: ${res.raw.slice(0, 120)}` }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown error' }
  }
}
