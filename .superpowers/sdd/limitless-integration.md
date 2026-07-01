# Limitless Integration Report
_Generated 2026-07-01_

## Auth + Balance Model

Limitless uses **HMAC-SHA256 signed API tokens** (not wallet signatures per-request, not raw API keys).

- Derive once at `limitless.exchange → Profile → API Tokens → "Derive API Token"`
- Results in a **Token ID** (UUID) and a **Secret** (shown once; save immediately)
- Every request signs a `"${timestamp}\n${METHOD}\n${path+query}\n${body}"` payload with the secret
- Headers: `lmts-api-key`, `lmts-timestamp`, `lmts-signature`
- No wallet private key required to use the API
- Balance endpoint: `GET https://api.limitless.exchange/portfolio/trading/allowance?type=clob`
  - Returns `allowance` in USDC base units (6 decimals); convert to cents via `/ 1e4`
  - Returns 401 on bad credentials, 200 on success

## What Was Built

**All built:**
- `src/lib/autotrade/limitless.ts` — HMAC signing + `fetchBalance` + `testConnection`
- `src/lib/balance/venues/limitless.ts` — `BalanceAdapter` registered as `'limitless'`
- `src/lib/balance/adapters.ts` — registered `limitlessBalanceAdapter`
- `src/lib/autotrade/credentials.ts` — added `'limitless'` to `CredentialedVenue`
- `src/app/api/autotrade/credentials/route.ts` — `parseLimitless`, `testLimitless`, SUPPORTED_VENUES
- `src/app/dashboard/credentials-wizard.tsx` — `LimitlessFields` component, wired into form + submit
- `src/app/dashboard/connections/connections-grid.tsx` — `CREDENTIALED_VENUES` + `WizardVenue` expanded

**Not built (deferred):** Order placement (`placeMarketOrder`). Limitless AMM trading requires
on-chain contract calls (not a simple REST endpoint). The API docs show a CLOB `allowance` path
but CLOB order placement requires the `trading` scope token and a separate order-signing flow.
Read-only balance is fully functional.

## User Fields Required

| Field | What It Is | Where to Get It |
|-------|-----------|-----------------|
| **Token ID** | UUID from the derive step | `limitless.exchange → Profile → API Tokens → Derive API Token` |
| **Token Secret** | HMAC signing key | Shown **once** during token creation — copy immediately |

The wallet itself is not stored. No private key needed.

## tsc Result

`npx tsc --noEmit` — **clean, no errors.**

## Verdict

A user can now connect Limitless and see their USDC trading allowance balance. The wizard renders
two fields (Token ID + Secret), the adapter signs every request with HMAC-SHA256, and the test
connection verifies the credentials before saving. Trade execution is deferred pending on-chain
order signing support.
