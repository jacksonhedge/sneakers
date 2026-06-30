// GET /api/polymarket-balance?address=0x...
//
// Reads on-chain USDC balance from Polygon for a given public wallet address.
// No credentials required — address is public. Returns cents (1/100 of a dollar).
//
// Tries both USDC.e (bridged) and native USDC since Polymarket has used both.
// Sums both balances for the total. Falls back to a second RPC on failure.
//
// Response:
//   { ok: true, address, cents, byToken: { usdce, usdc } }
//   { ok: false, error: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic',
  'https://polygon.drpc.org',
]

// Polymarket USDC collateral contracts on Polygon
const USDCE_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC.e (bridged) — 6 decimals
const USDC_ADDRESS  = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' // native USDC       — 6 decimals

// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = '0x70a08231'

function addressIsValid(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function buildCallData(walletAddress: string): string {
  // balanceOf(address) — 4-byte selector + address padded to 32 bytes
  const stripped = walletAddress.slice(2).toLowerCase()
  const padded = stripped.padStart(64, '0')
  return BALANCE_OF_SELECTOR + padded
}

async function ethCall(rpc: string, to: string, data: string, signal: AbortSignal): Promise<string> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  })

  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  })

  if (!res.ok) throw new Error(`RPC ${rpc} returned HTTP ${res.status}`)
  const json = await res.json() as { result?: string; error?: unknown }
  if (json.error) {
    const errMsg = typeof json.error === 'object' && json.error !== null && 'message' in json.error
      ? String((json.error as { message?: string }).message ?? 'RPC error')
      : 'RPC error'
    throw new Error(errMsg)
  }
  if (!json.result || json.result === '0x') return '0x0000000000000000000000000000000000000000000000000000000000000000'
  return json.result
}

function hexToCents(hex: string): number {
  // hex is a 32-byte ABI-encoded uint256
  const raw = BigInt(hex)
  // 6 decimals → divide by 1e6, multiply by 100 to get cents
  return Math.round(Number(raw) / 1e6 * 100)
}

async function fetchBothBalances(rpc: string, walletAddress: string, signal: AbortSignal): Promise<{ usdce: number; usdc: number }> {
  const callData = buildCallData(walletAddress)

  const [usdceHex, usdcHex] = await Promise.all([
    ethCall(rpc, USDCE_ADDRESS, callData, signal),
    ethCall(rpc, USDC_ADDRESS,  callData, signal),
  ])

  return {
    usdce: hexToCents(usdceHex),
    usdc:  hexToCents(usdcHex),
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address') ?? ''

  if (!addressIsValid(address)) {
    return Response.json(
      { ok: false, error: 'Invalid address — must be 0x followed by 40 hex characters.' },
      { status: 400 },
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    let balances: { usdce: number; usdc: number } | null = null
    let lastError: string = 'Unknown error'

    for (const rpc of POLYGON_RPCS) {
      try {
        balances = await fetchBothBalances(rpc, address, controller.signal)
        break
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[polymarket-balance] RPC ${rpc} failed: ${lastError}`)
        // try next RPC
      }
    }

    if (!balances) {
      return Response.json({ ok: false, error: `All RPCs failed: ${lastError}` }, { status: 502 })
    }

    const cents = balances.usdce + balances.usdc

    return Response.json({
      ok: true,
      address,
      cents,
      byToken: {
        usdce: balances.usdce,
        usdc:  balances.usdc,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('abort') || message.includes('AbortError')) {
      return Response.json({ ok: false, error: 'Request timed out after 8s' }, { status: 504 })
    }
    return Response.json({ ok: false, error: message }, { status: 500 })
  } finally {
    clearTimeout(timeout)
  }
}
