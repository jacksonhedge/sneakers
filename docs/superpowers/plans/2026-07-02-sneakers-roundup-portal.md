# Sneakers Round-Up Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an interactive, public (no-login) round-up portal at `/roundup-demo` on the Sneakers Trading dev server — a user connects a bank via real Stripe Financial Connections (test mode), configures a round-up rule (default $5.00 threshold), watches round-ups accrue from real-or-seeded transactions, and — at threshold — has that amount automatically swept into a demo wallet balance.

**Architecture:** Pure round-up math and the deterministic demo transaction feed live in `packages/core` (Node's built-in test runner, matching the existing `address-candidates.ts` pattern). Everything else — the Stripe Financial Connections integration, API routes, Supabase persistence, and the interactive page — lives in `apps/platform`, which has no test harness in this repo; those pieces are verified manually via the dev server, matching how every other `apps/platform` route (e.g. `polymarket.ts`, `credentials/route.ts`) already works.

**Tech Stack:** Next.js 16 (App Router, async `cookies()`/route params), Supabase (service-role client for anonymous-session writes, no RLS-by-auth), Stripe SDK v22 (`stripe.financialConnections.*`) + `@stripe/stripe-js` (new client dependency) for `collectFinancialConnectionsAccounts`, `@sneakers/core` workspace package.

## Global Constraints

- Public route, **no Supabase-auth wall** — identity is an anonymous session, tracked via an httpOnly cookie (`roundup_demo_session`), not `auth.users`.
- Round-up threshold **defaults to $5.00 (500 cents)** — user-editable, but this is the out-of-the-box value.
- Facilitation = **wallet-move only**. No Polymarket integration of any kind (no market data, no business credentials, no `placeMarketOrder`) — that is an explicitly deferred future mode. Do not add any Polymarket-related code in this plan.
- The wallet credited here is a **demo-scoped balance in a new table** — never touch or credit the real `wallet_balances`/`wallet_transactions` tables from migration `043_wallet_balances_transactions.sql`.
- Bank link is **real** (Stripe Financial Connections, test mode). Bank *funding* (ACH pull) is **not implemented** — facilitation only ever moves numbers between this demo's own tables, never real money.
- All new Next.js code follows this repo's Next 16 conventions: `await cookies()`, `ctx: { params: Promise<{...}> }` for dynamic routes, `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'` on API routes (see `src/app/api/autotrade/credentials/route.ts` and `src/app/r/[code]/route.ts` for reference).
- Reuse `getStripe()` from `src/lib/stripe.ts` for all server-side Stripe calls — do not create a second Stripe client.
- Reuse `getServerClient()` from `src/lib/supabase-server.ts` (service-role) for all Supabase reads/writes in this feature — anonymous sessions have no `auth.uid()`, so RLS-by-user doesn't apply here.
- Spec: `docs/superpowers/specs/2026-07-02-sneakers-roundup-portal-design.md`.

---

## Task 1: Round-up engine (pure math)

**Files:**
- Create: `packages/core/src/roundup/engine.ts`
- Test: `packages/core/src/roundup/engine.test.ts`
- Modify: `packages/core/src/index.ts:1-4` (add export)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface RoundUpRule { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }`
  - `interface Txn { id: string; merchant: string; amountCents: number; date: string }`
  - `interface RoundUp { txnId: string; roundUpCents: number }`
  - `computeRoundUpCents(amountCents: number, roundToCents: number, multiplier: number): number`
  - `roundUpsFor(txns: Txn[], rule: RoundUpRule): RoundUp[]`
  - `accruedCents(roundUps: RoundUp[]): number`
  - `thresholdReached(accrued: number, rule: RoundUpRule): boolean`
  - `transferableCents(accrued: number, rule: RoundUpRule, transferredThisWeekCents: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/roundup/engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeRoundUpCents, roundUpsFor, accruedCents, thresholdReached, transferableCents,
  type RoundUpRule, type Txn,
} from './engine.js'

const rule: RoundUpRule = { roundToCents: 100, multiplier: 1, thresholdCents: 500, weeklyCapCents: 2000 }

test('computeRoundUpCents rounds up to the nearest unit', () => {
  assert.equal(computeRoundUpCents(420, 100, 1), 80) // $4.20 -> $0.80
  assert.equal(computeRoundUpCents(399, 100, 1), 1)  // $3.99 -> $0.01
})

test('computeRoundUpCents returns 0 on an exact multiple', () => {
  assert.equal(computeRoundUpCents(500, 100, 1), 0)
})

test('computeRoundUpCents applies the multiplier', () => {
  assert.equal(computeRoundUpCents(420, 100, 5), 400) // 80 * 5
})

test('roundUpsFor maps each txn to its round-up', () => {
  const txns: Txn[] = [
    { id: 'a', merchant: 'Coffee', amountCents: 420, date: '2026-06-20' },
    { id: 'b', merchant: 'Rideshare', amountCents: 1899, date: '2026-06-20' },
    { id: 'c', merchant: 'Even', amountCents: 500, date: '2026-06-20' },
  ]
  assert.deepEqual(roundUpsFor(txns, rule), [
    { txnId: 'a', roundUpCents: 80 },
    { txnId: 'b', roundUpCents: 1 },
    { txnId: 'c', roundUpCents: 0 },
  ])
})

test('accruedCents sums round-ups', () => {
  assert.equal(accruedCents([{ txnId: 'a', roundUpCents: 80 }, { txnId: 'b', roundUpCents: 1 }]), 81)
})

test('thresholdReached is false below threshold, true at/above', () => {
  assert.equal(thresholdReached(499, rule), false)
  assert.equal(thresholdReached(500, rule), true)
  assert.equal(thresholdReached(900, rule), true)
})

test('transferableCents transfers the accrued amount when under the weekly cap', () => {
  assert.equal(transferableCents(1500, rule, 0), 1500)
})

test('transferableCents clamps to remaining weekly cap', () => {
  assert.equal(transferableCents(1500, rule, 1000), 1000) // cap 2000, 1000 used
})

test('transferableCents never goes negative', () => {
  assert.equal(transferableCents(1500, rule, 2000), 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && node --import tsx --test src/roundup/engine.test.ts`
Expected: FAIL — cannot find module `./engine.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/roundup/engine.ts
export interface RoundUpRule {
  roundToCents: number
  multiplier: number
  thresholdCents: number
  weeklyCapCents: number
}
export interface Txn {
  id: string
  merchant: string
  amountCents: number
  date: string
}
export interface RoundUp {
  txnId: string
  roundUpCents: number
}

export function computeRoundUpCents(amountCents: number, roundToCents: number, multiplier: number): number {
  const remainder = ((amountCents % roundToCents) + roundToCents) % roundToCents
  const base = remainder === 0 ? 0 : roundToCents - remainder
  return base * multiplier
}

export function roundUpsFor(txns: Txn[], rule: RoundUpRule): RoundUp[] {
  return txns.map((t) => ({
    txnId: t.id,
    roundUpCents: computeRoundUpCents(t.amountCents, rule.roundToCents, rule.multiplier),
  }))
}

export function accruedCents(roundUps: RoundUp[]): number {
  return roundUps.reduce((sum, r) => sum + r.roundUpCents, 0)
}

export function thresholdReached(accrued: number, rule: RoundUpRule): boolean {
  return accrued >= rule.thresholdCents
}

export function transferableCents(accrued: number, rule: RoundUpRule, transferredThisWeekCents: number): number {
  const remainingCap = rule.weeklyCapCents - transferredThisWeekCents
  return Math.max(0, Math.min(accrued, remainingCap))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && node --import tsx --test src/roundup/engine.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Export from the package index**

In `packages/core/src/index.ts`, add:

```ts
export * from './roundup/engine.js'
```

- [ ] **Step 6: Run the full core suite to confirm nothing broke**

Run: `cd packages/core && npm test`
Expected: PASS (all existing tests + the new 10).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/roundup/engine.ts packages/core/src/roundup/engine.test.ts packages/core/src/index.ts
git commit -m "feat(roundup): pure round-up engine in @sneakers/core"
```

---

## Task 2: Deterministic demo transaction feed

**Files:**
- Create: `packages/core/src/roundup/seed.ts`
- Test: `packages/core/src/roundup/seed.test.ts`
- Modify: `packages/core/src/index.ts` (add export)

**Interfaces:**
- Consumes: `Txn` from `./engine.js` (Task 1).
- Produces: `seedTransactions(count?: number): Txn[]` — deterministic, stable ids (`seed-1`, `seed-2`, …), stable order and amounts.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/roundup/seed.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seedTransactions } from './seed.js'

test('seedTransactions is deterministic across calls', () => {
  assert.deepEqual(seedTransactions(10), seedTransactions(10))
})

test('seedTransactions returns the requested count and clamps to available', () => {
  assert.equal(seedTransactions(3).length, 3)
  assert.ok(seedTransactions(999).length >= 8)
})

test('seedTransactions produces non-round amounts so round-ups are non-zero', () => {
  const anyNonRound = seedTransactions(10).some((t) => t.amountCents % 100 !== 0)
  assert.equal(anyNonRound, true)
})

test('seedTransactions has stable ids', () => {
  assert.deepEqual(seedTransactions(2).map((t) => t.id), ['seed-1', 'seed-2'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && node --import tsx --test src/roundup/seed.test.ts`
Expected: FAIL — cannot find module `./seed.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/roundup/seed.ts
import type { Txn } from './engine.js'

const FEED: Array<{ merchant: string; amountCents: number; date: string }> = [
  { merchant: 'Blue Bottle Coffee', amountCents: 475, date: '2026-06-24' },
  { merchant: 'Uber', amountCents: 1899, date: '2026-06-24' },
  { merchant: 'Whole Foods', amountCents: 6312, date: '2026-06-23' },
  { merchant: 'Spotify', amountCents: 1099, date: '2026-06-23' },
  { merchant: 'Shell', amountCents: 4287, date: '2026-06-22' },
  { merchant: 'Chipotle', amountCents: 1340, date: '2026-06-22' },
  { merchant: 'Amazon', amountCents: 2399, date: '2026-06-21' },
  { merchant: 'Netflix', amountCents: 1549, date: '2026-06-21' },
  { merchant: 'CVS Pharmacy', amountCents: 824, date: '2026-06-20' },
  { merchant: "Trader Joe's", amountCents: 3711, date: '2026-06-20' },
]

export function seedTransactions(count = 10): Txn[] {
  const n = Math.min(count, FEED.length)
  return FEED.slice(0, n).map((f, i) => ({ id: `seed-${i + 1}`, ...f }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && node --import tsx --test src/roundup/seed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Export from the package index**

In `packages/core/src/index.ts`, add:

```ts
export * from './roundup/seed.js'
```

- [ ] **Step 6: Run the full core suite**

Run: `cd packages/core && npm test`
Expected: PASS (all existing tests + 14 new).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/roundup/seed.ts packages/core/src/roundup/seed.test.ts packages/core/src/index.ts
git commit -m "feat(roundup): deterministic demo transaction feed in @sneakers/core"
```

---

## Task 3: Supabase migration — session, txns, ledger tables

**Files:**
- Create: `apps/platform/supabase/migrations/046_roundup_demo.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `roundup_demo_sessions`, `roundup_demo_txns`, `roundup_demo_ledger`, all keyed by `session_id text` (the anonymous session id from Task 4), used by every API route from Task 4 onward.

- [ ] **Step 1: Write the migration**

```sql
-- apps/platform/supabase/migrations/046_roundup_demo.sql
--
-- Anonymous-session-scoped tables for the public /roundup-demo portal.
-- NOT the real production wallet (see 043_wallet_balances_transactions.sql) —
-- this is a separate, session-scoped demo balance. No auth.users reference;
-- identity is an unguessable session id stored in an httpOnly cookie, so
-- there is no auth.uid() to write RLS policies against. Only the service
-- role reads/writes these tables.

create table if not exists roundup_demo_sessions (
  session_id                    text primary key,
  stripe_customer_id            text,
  bank_account_id               text,
  bank_institution              text,
  bank_last4                    text,
  round_to_cents                integer not null default 100,
  multiplier                    integer not null default 1,
  threshold_cents               integer not null default 500,
  weekly_cap_cents              integer not null default 2000,
  facilitated_cents             integer not null default 0,
  wallet_cents                  integer not null default 0,
  transferred_this_week_cents   integer not null default 0,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create table if not exists roundup_demo_txns (
  session_id      text not null references roundup_demo_sessions(session_id) on delete cascade,
  txn_id          text not null,
  merchant        text not null,
  amount_cents    integer not null,
  round_up_cents  integer not null,
  occurred_on     date not null,
  created_at      timestamptz not null default now(),
  primary key (session_id, txn_id)
);

create table if not exists roundup_demo_ledger (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null references roundup_demo_sessions(session_id) on delete cascade,
  kind          text not null check (kind in ('facilitation')),
  amount_cents  integer not null,
  memo          text not null,
  occurred_at   timestamptz not null default now()
);

create index if not exists roundup_demo_ledger_session_idx
  on roundup_demo_ledger (session_id, occurred_at desc);

alter table roundup_demo_sessions enable row level security;
alter table roundup_demo_txns enable row level security;
alter table roundup_demo_ledger enable row level security;

-- No public policies on any of these — service role only. Anonymous
-- sessions authenticate via the unguessable cookie value checked in
-- application code, not via Supabase auth.uid().
```

- [ ] **Step 2: Apply the migration locally**

Run: `cd apps/platform && npx supabase db push` (or the project's existing local-apply method — check `package.json`'s `db:migrate` script in `packages/core` if this repo's Supabase is shared across workspace packages; otherwise apply directly via the Supabase SQL editor for the dev project).

Expected: three new tables visible in Supabase (`roundup_demo_sessions`, `roundup_demo_txns`, `roundup_demo_ledger`).

- [ ] **Step 3: Commit**

```bash
git add apps/platform/supabase/migrations/046_roundup_demo.sql
git commit -m "feat(roundup): add anonymous-session round-up portal tables"
```

---

## Task 4: Anonymous session helper + state API route

**Files:**
- Create: `apps/platform/src/lib/roundup/session.ts`
- Create: `apps/platform/src/app/api/roundup-demo/state/route.ts`

**Interfaces:**
- Consumes: `getServerClient` from `@/lib/supabase-server`; the `roundup_demo_sessions`/`roundup_demo_txns` tables from Task 3.
- Produces:
  - `ROUNDUP_SESSION_COOKIE: string`
  - `readSessionId(): Promise<string | null>`
  - `ensureSession(): Promise<{ sessionId: string; isNew: boolean }>`
  - `attachSessionCookie(res: NextResponse, sessionId: string): NextResponse`
  - `GET /api/roundup-demo/state` — returns `{ session: SessionState }` where
    `SessionState = { sessionId: string; bank: { linked: boolean; institution: string | null; last4: string | null }; rule: { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }; pendingAccruedCents: number; walletCents: number; txns: Array<{ id: string; merchant: string; amountCents: number; roundUpCents: number; date: string }> }`
  - Later tasks import `ensureSession` and `attachSessionCookie` from this file — do not duplicate session logic elsewhere.

- [ ] **Step 1: Write `session.ts`**

```ts
// apps/platform/src/lib/roundup/session.ts
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import type { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'

export const ROUNDUP_SESSION_COOKIE = 'roundup_demo_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function readSessionId(): Promise<string | null> {
  const store = await cookies()
  return store.get(ROUNDUP_SESSION_COOKIE)?.value ?? null
}

/**
 * Reads the session cookie if present; otherwise creates a new
 * roundup_demo_sessions row and returns a fresh id. Callers must attach the
 * cookie to their response via attachSessionCookie when isNew is true —
 * this function only touches the DB, never the response (route handlers
 * set cookies on NextResponse, not via next/headers, per this repo's
 * existing pattern in src/app/r/[code]/route.ts).
 */
export async function ensureSession(): Promise<{ sessionId: string; isNew: boolean }> {
  const existing = await readSessionId()
  if (existing) return { sessionId: existing, isNew: false }

  const sessionId = randomUUID()
  const sb = getServerClient()
  const { error } = await sb.from('roundup_demo_sessions').insert({ session_id: sessionId })
  if (error) throw new Error(`failed to create roundup_demo session: ${error.message}`)
  return { sessionId, isNew: true }
}

export function attachSessionCookie(res: NextResponse, sessionId: string): NextResponse {
  res.cookies.set(ROUNDUP_SESSION_COOKIE, sessionId, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
  })
  return res
}
```

- [ ] **Step 2: Write the state route**

```ts
// apps/platform/src/app/api/roundup-demo/state/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { sessionId, isNew } = await ensureSession()
  const sb = getServerClient()

  const { data: session, error: sessionErr } = await sb
    .from('roundup_demo_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()
  if (sessionErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: sessionErr?.message }, { status: 500 })
  }

  const { data: txns, error: txnsErr } = await sb
    .from('roundup_demo_txns')
    .select('*')
    .eq('session_id', sessionId)
    .order('occurred_on', { ascending: false })
  if (txnsErr) {
    return NextResponse.json({ error: 'txns_load_failed', message: txnsErr.message }, { status: 500 })
  }

  const totalRoundUpCents = (txns ?? []).reduce((sum, t) => sum + t.round_up_cents, 0)
  const pendingAccruedCents = Math.max(0, totalRoundUpCents - session.facilitated_cents)

  const body = {
    session: {
      sessionId,
      bank: {
        linked: Boolean(session.bank_account_id),
        institution: session.bank_institution,
        last4: session.bank_last4,
      },
      rule: {
        roundToCents: session.round_to_cents,
        multiplier: session.multiplier,
        thresholdCents: session.threshold_cents,
        weeklyCapCents: session.weekly_cap_cents,
      },
      pendingAccruedCents,
      walletCents: session.wallet_cents,
      txns: (txns ?? []).map((t) => ({
        id: t.txn_id,
        merchant: t.merchant,
        amountCents: t.amount_cents,
        roundUpCents: t.round_up_cents,
        date: t.occurred_on,
      })),
    },
  }

  const res = NextResponse.json(body)
  return isNew ? attachSessionCookie(res, sessionId) : res
}
```

- [ ] **Step 3: Manual verification**

Run: `cd apps/platform && pnpm dev`, then in a second terminal:

```bash
curl -i http://localhost:3000/api/roundup-demo/state
```

Expected: `200`, a `Set-Cookie: roundup_demo_session=...` header, and a JSON body with `session.rule.thresholdCents === 500`, `session.bank.linked === false`, `session.txns` an empty array. Run the same `curl` again with `-b`/`-c` a cookie jar file and confirm the second call returns the SAME `sessionId` with no new `Set-Cookie`.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/lib/roundup/session.ts apps/platform/src/app/api/roundup-demo/state/route.ts
git commit -m "feat(roundup): anonymous session helper + state API route"
```

---

## Task 5: Round-up rule config API route

**Files:**
- Create: `apps/platform/src/app/api/roundup-demo/rule/route.ts`

**Interfaces:**
- Consumes: `ensureSession`, `attachSessionCookie` from Task 4.
- Produces: `PATCH /api/roundup-demo/rule` — body `{ roundToCents?: number; multiplier?: number; thresholdCents?: number; weeklyCapCents?: number }`, returns `{ ok: true }` on success. Later screens (Task 10) call this directly.

- [ ] **Step 1: Write the route**

```ts
// apps/platform/src/app/api/roundup-demo/rule/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function positiveInt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined
}

export async function PATCH(req: Request) {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const update: Record<string, number> = {}
  const roundToCents = positiveInt(body.roundToCents)
  const multiplier = positiveInt(body.multiplier)
  const thresholdCents = positiveInt(body.thresholdCents)
  const weeklyCapCents = positiveInt(body.weeklyCapCents)
  if (roundToCents !== undefined) update.round_to_cents = roundToCents
  if (multiplier !== undefined) update.multiplier = multiplier
  if (thresholdCents !== undefined) update.threshold_cents = thresholdCents
  if (weeklyCapCents !== undefined) update.weekly_cap_cents = weeklyCapCents

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 })
  }

  const sb = getServerClient()
  const { error } = await sb
    .from('roundup_demo_sessions')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -i -X PATCH http://localhost:3000/api/roundup-demo/rule \
  -H 'Content-Type: application/json' \
  -b cookies.txt -c cookies.txt \
  -d '{"thresholdCents": 300}'
curl -s http://localhost:3000/api/roundup-demo/state -b cookies.txt | grep -o '"thresholdCents":[0-9]*'
```

Expected: `PATCH` returns `{"ok":true}`; the follow-up `state` call shows `"thresholdCents":300`.

- [ ] **Step 3: Commit**

```bash
git add apps/platform/src/app/api/roundup-demo/rule/route.ts
git commit -m "feat(roundup): round-up rule config API route"
```

---

## Task 6: Stripe Financial Connections bank adapter + link API routes

**Files:**
- Create: `apps/platform/src/lib/roundup/bank.ts`
- Create: `apps/platform/src/app/api/roundup-demo/bank/link-token/route.ts`
- Create: `apps/platform/src/app/api/roundup-demo/bank/link-complete/route.ts`

**Interfaces:**
- Consumes: `getStripe` from `@/lib/stripe`; `ensureSession`, `attachSessionCookie` from Task 4.
- Produces:
  - `ensureStripeCustomer(existingCustomerId: string | null, sessionId: string): Promise<string>`
  - `createFinancialConnectionsSession(customerId: string): Promise<{ clientSecret: string | null }>`
  - `interface LinkedAccount { id: string; institution: string | null; last4: string | null }`
  - `completeFinancialConnectionsLink(fcSessionId: string): Promise<LinkedAccount | null>`
  - `interface BankTxn { id: string; merchant: string; amountCents: number; date: string }`
  - `listRecentTransactions(bankAccountId: string): Promise<BankTxn[]>` — consumed by Task 7.
  - `POST /api/roundup-demo/bank/link-token` — returns `{ clientSecret: string }`.
  - `POST /api/roundup-demo/bank/link-complete` — body `{ financialConnectionsSessionId: string }`, returns `{ ok: true; institution: string | null; last4: string | null }`. Task 9's client bank-link screen calls both of these in sequence.

This mirrors the existing thin-route + adapter split in this codebase (compare
`src/lib/autotrade/polymarket.ts` + `src/app/api/autotrade/credentials/route.ts`) — routes stay
thin; Stripe API shape and error handling live in the adapter.

- [ ] **Step 1: Write the bank adapter**

```ts
// apps/platform/src/lib/roundup/bank.ts
import { getStripe } from '@/lib/stripe'

export async function ensureStripeCustomer(existingCustomerId: string | null, sessionId: string): Promise<string> {
  if (existingCustomerId) return existingCustomerId
  const stripe = getStripe()
  const customer = await stripe.customers.create({ metadata: { roundup_demo_session: sessionId } })
  return customer.id
}

export async function createFinancialConnectionsSession(customerId: string): Promise<{ clientSecret: string | null }> {
  const stripe = getStripe()
  const fcSession = await stripe.financialConnections.sessions.create({
    account_holder: { type: 'customer', customer: customerId },
    permissions: ['transactions'],
    filters: { countries: ['US'] },
  })
  return { clientSecret: fcSession.client_secret }
}

export interface LinkedAccount {
  id: string
  institution: string | null
  last4: string | null
}

export async function completeFinancialConnectionsLink(fcSessionId: string): Promise<LinkedAccount | null> {
  const stripe = getStripe()
  const fcSession = await stripe.financialConnections.sessions.retrieve(fcSessionId)
  const account = fcSession.accounts?.data?.[0]
  if (!account) return null
  // Required before financialConnections.transactions.list returns data for this account.
  await stripe.financialConnections.accounts.subscribe(account.id, { features: ['transactions'] })
  return { id: account.id, institution: account.institution_name ?? null, last4: account.last4 ?? null }
}

export interface BankTxn {
  id: string
  merchant: string
  amountCents: number
  date: string
}

/**
 * Stripe Financial Connections Transaction objects: `amount` is a signed
 * integer in the account's smallest currency unit (cents for USD, same
 * convention as every other Stripe amount field), `transacted_at` is a unix
 * timestamp, `description` is the merchant/memo string. Verify field names
 * against the installed `stripe` SDK's types (`node_modules/stripe/types`)
 * if this errors — Financial Connections is a newer API surface and field
 * names have shifted across SDK majors before.
 */
export async function listRecentTransactions(bankAccountId: string): Promise<BankTxn[]> {
  const stripe = getStripe()
  const page = await stripe.financialConnections.transactions.list({ account: bankAccountId, limit: 10 })
  return page.data.map((t) => ({
    id: t.id,
    merchant: t.description ?? 'Transaction',
    amountCents: Math.abs(t.amount),
    date: new Date(t.transacted_at * 1000).toISOString().slice(0, 10),
  }))
}
```

- [ ] **Step 2: Write the link-token route**

```ts
// apps/platform/src/app/api/roundup-demo/bank/link-token/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { ensureStripeCustomer, createFinancialConnectionsSession } from '@/lib/roundup/bank'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const sb = getServerClient()

  const { data: session, error: loadErr } = await sb
    .from('roundup_demo_sessions')
    .select('stripe_customer_id')
    .eq('session_id', sessionId)
    .single()
  if (loadErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: loadErr?.message }, { status: 500 })
  }

  const customerId = await ensureStripeCustomer(session.stripe_customer_id, sessionId)
  if (customerId !== session.stripe_customer_id) {
    const { error: updateErr } = await sb
      .from('roundup_demo_sessions')
      .update({ stripe_customer_id: customerId })
      .eq('session_id', sessionId)
    if (updateErr) {
      return NextResponse.json({ error: 'customer_persist_failed', message: updateErr.message }, { status: 500 })
    }
  }

  const { clientSecret } = await createFinancialConnectionsSession(customerId)
  const res = NextResponse.json({ clientSecret })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
```

- [ ] **Step 3: Write the link-complete route**

```ts
// apps/platform/src/app/api/roundup-demo/bank/link-complete/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { completeFinancialConnectionsLink } from '@/lib/roundup/bank'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const body = (await req.json().catch(() => ({}))) as { financialConnectionsSessionId?: unknown }
  const fcSessionId = typeof body.financialConnectionsSessionId === 'string' ? body.financialConnectionsSessionId : null
  if (!fcSessionId) {
    return NextResponse.json({ error: 'missing_fc_session_id' }, { status: 400 })
  }

  const account = await completeFinancialConnectionsLink(fcSessionId)
  if (!account) {
    return NextResponse.json({ error: 'no_account_linked' }, { status: 400 })
  }

  const sb = getServerClient()
  const { error } = await sb
    .from('roundup_demo_sessions')
    .update({
      bank_account_id: account.id,
      bank_institution: account.institution,
      bank_last4: account.last4,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
  if (error) {
    return NextResponse.json({ error: 'persist_failed', message: error.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true, institution: account.institution, last4: account.last4 })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
```

- [ ] **Step 4: Manual verification (needs real Stripe test-mode keys — see Task 9's env step)**

```bash
curl -i -X POST http://localhost:3000/api/roundup-demo/bank/link-token -b cookies.txt -c cookies.txt
```

Expected: `200` with a `clientSecret` starting `fcsess_`. Full end-to-end (completing the actual Financial Connections flow) is verified interactively in Task 9 once the client UI exists — `link-complete` cannot be meaningfully curl'd standalone since it needs a real `financialConnectionsSessionId` from a completed client-side flow.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/lib/roundup/bank.ts apps/platform/src/app/api/roundup-demo/bank/link-token/route.ts apps/platform/src/app/api/roundup-demo/bank/link-complete/route.ts
git commit -m "feat(roundup): Stripe Financial Connections bank adapter + link API routes"
```

---

## Task 7: Transaction sync + round-up accrual API route

**Files:**
- Create: `apps/platform/src/app/api/roundup-demo/transactions/sync/route.ts`

**Interfaces:**
- Consumes: `listRecentTransactions` from `@/lib/roundup/bank` (Task 6); `ensureSession` from Task 4; `roundUpsFor`, `seedTransactions`, `type Txn`, `type RoundUpRule` from `@sneakers/core` (Tasks 1–2).
- Produces: `POST /api/roundup-demo/transactions/sync` — fetches real Financial Connections transactions if a bank is linked (falling back to the seeded demo feed if too few real ones exist), upserts them into `roundup_demo_txns` idempotently, returns the same `SessionState.txns` shape as Task 4's state route. Task 11's activity screen calls this to refresh the feed.

- [ ] **Step 1: Write the route**

```ts
// apps/platform/src/app/api/roundup-demo/transactions/sync/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { listRecentTransactions } from '@/lib/roundup/bank'
import { roundUpsFor, seedTransactions, type Txn, type RoundUpRule } from '@sneakers/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_REAL_TXNS_BEFORE_SKIPPING_DEMO_FEED = 3

export async function POST() {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const sb = getServerClient()

  const { data: session, error: loadErr } = await sb
    .from('roundup_demo_sessions')
    .select('bank_account_id, round_to_cents, multiplier, threshold_cents, weekly_cap_cents')
    .eq('session_id', sessionId)
    .single()
  if (loadErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: loadErr?.message }, { status: 500 })
  }

  let txns: Txn[] = []
  if (session.bank_account_id) {
    try {
      txns = await listRecentTransactions(session.bank_account_id)
    } catch {
      txns = [] // fall through to demo feed below
    }
  }
  if (txns.length < MIN_REAL_TXNS_BEFORE_SKIPPING_DEMO_FEED) {
    txns = seedTransactions(10)
  }

  const rule: RoundUpRule = {
    roundToCents: session.round_to_cents,
    multiplier: session.multiplier,
    thresholdCents: session.threshold_cents,
    weeklyCapCents: session.weekly_cap_cents,
  }
  const roundUps = roundUpsFor(txns, rule)
  const roundUpByTxnId = new Map(roundUps.map((r) => [r.txnId, r.roundUpCents]))

  const rows = txns.map((t) => ({
    session_id: sessionId,
    txn_id: t.id,
    merchant: t.merchant,
    amount_cents: t.amountCents,
    round_up_cents: roundUpByTxnId.get(t.id) ?? 0,
    occurred_on: t.date,
  }))

  const { error: upsertErr } = await sb
    .from('roundup_demo_txns')
    .upsert(rows, { onConflict: 'session_id,txn_id', ignoreDuplicates: true })
  if (upsertErr) {
    return NextResponse.json({ error: 'txn_sync_failed', message: upsertErr.message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true, syncedCount: rows.length })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -i -X POST http://localhost:3000/api/roundup-demo/transactions/sync -b cookies.txt -c cookies.txt
curl -s http://localhost:3000/api/roundup-demo/state -b cookies.txt | python3 -m json.tool
```

Expected: `sync` returns `{"ok":true,"syncedCount":10}` (no bank linked yet, so the seeded feed is used); `state` now shows 10 `txns` with `roundUpCents` matching the engine's math (e.g. Blue Bottle Coffee $4.75 → round-up $0.25 at the $1.00/1x default rule), and `pendingAccruedCents` equal to their sum. Run `sync` a second time and confirm `txns` in `state` is still exactly 10 (idempotent — no duplicates).

- [ ] **Step 3: Commit**

```bash
git add apps/platform/src/app/api/roundup-demo/transactions/sync/route.ts
git commit -m "feat(roundup): transaction sync + round-up accrual API route"
```

---

## Task 8: Facilitation API route (sweep to demo wallet)

**Files:**
- Create: `apps/platform/src/app/api/roundup-demo/facilitate/route.ts`

**Interfaces:**
- Consumes: `ensureSession` from Task 4; `thresholdReached`, `transferableCents`, `type RoundUpRule` from `@sneakers/core`.
- Produces: `POST /api/roundup-demo/facilitate` — returns `{ ok: true; moved: false }` if threshold not reached, or `{ ok: true; moved: true; movedCents: number; walletCents: number }` on a successful sweep. Task 11's activity screen calls this after every sync when `pendingAccruedCents >= thresholdCents`.

- [ ] **Step 1: Write the route**

```ts
// apps/platform/src/app/api/roundup-demo/facilitate/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { thresholdReached, transferableCents, type RoundUpRule } from '@sneakers/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  let sessionId: string
  let isNew: boolean
  try {
    ;({ sessionId, isNew } = await ensureSession())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'session_init_failed', message }, { status: 500 })
  }
  const sb = getServerClient()

  const { data: session, error: loadErr } = await sb
    .from('roundup_demo_sessions')
    .select('round_to_cents, multiplier, threshold_cents, weekly_cap_cents, facilitated_cents, wallet_cents, transferred_this_week_cents')
    .eq('session_id', sessionId)
    .single()
  if (loadErr || !session) {
    return NextResponse.json({ error: 'session_not_found', message: loadErr?.message }, { status: 500 })
  }

  const { data: txns, error: txnsErr } = await sb
    .from('roundup_demo_txns')
    .select('round_up_cents')
    .eq('session_id', sessionId)
  if (txnsErr) {
    return NextResponse.json({ error: 'txns_load_failed', message: txnsErr.message }, { status: 500 })
  }

  const totalRoundUpCents = (txns ?? []).reduce((sum, t) => sum + t.round_up_cents, 0)
  const pendingAccruedCents = Math.max(0, totalRoundUpCents - session.facilitated_cents)

  const rule: RoundUpRule = {
    roundToCents: session.round_to_cents,
    multiplier: session.multiplier,
    thresholdCents: session.threshold_cents,
    weeklyCapCents: session.weekly_cap_cents,
  }

  if (!thresholdReached(pendingAccruedCents, rule)) {
    const res = NextResponse.json({ ok: true, moved: false, pendingAccruedCents })
    return isNew ? attachSessionCookie(res, sessionId) : res
  }

  const movedCents = transferableCents(pendingAccruedCents, rule, session.transferred_this_week_cents)
  if (movedCents <= 0) {
    const res = NextResponse.json({ ok: true, moved: false, pendingAccruedCents, reason: 'weekly_cap_reached' })
    return isNew ? attachSessionCookie(res, sessionId) : res
  }

  const { error: updateErr } = await sb
    .from('roundup_demo_sessions')
    .update({
      facilitated_cents: session.facilitated_cents + movedCents,
      wallet_cents: session.wallet_cents + movedCents,
      transferred_this_week_cents: session.transferred_this_week_cents + movedCents,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
  if (updateErr) {
    return NextResponse.json({ error: 'facilitation_update_failed', message: updateErr.message }, { status: 500 })
  }

  const { error: ledgerErr } = await sb.from('roundup_demo_ledger').insert({
    session_id: sessionId,
    kind: 'facilitation',
    amount_cents: movedCents,
    memo: `Round-ups swept to wallet at $${(rule.thresholdCents / 100).toFixed(2)} threshold`,
  })
  if (ledgerErr) {
    return NextResponse.json({ error: 'ledger_write_failed', message: ledgerErr.message }, { status: 500 })
  }

  const res = NextResponse.json({
    ok: true,
    moved: true,
    movedCents,
    walletCents: session.wallet_cents + movedCents,
  })
  return isNew ? attachSessionCookie(res, sessionId) : res
}
```

- [ ] **Step 2: Manual verification**

Using the cookie jar from Task 7 (which already has $X pending from the seeded feed — check `state` first to confirm `pendingAccruedCents >= 500`; if not, `PATCH /rule` with a lower `thresholdCents` like `100` first):

```bash
curl -s -X POST http://localhost:3000/api/roundup-demo/facilitate -b cookies.txt -c cookies.txt | python3 -m json.tool
curl -s http://localhost:3000/api/roundup-demo/state -b cookies.txt | grep -o '"walletCents":[0-9]*'
```

Expected: `facilitate` returns `"moved": true` with a `movedCents` and `walletCents`; the follow-up `state` call's `walletCents` matches. Run `facilitate` again immediately — expect `"moved": false` since `pendingAccruedCents` has been reduced below threshold (unless more accrual exists).

- [ ] **Step 3: Commit**

```bash
git add apps/platform/src/app/api/roundup-demo/facilitate/route.ts
git commit -m "feat(roundup): facilitation API route (sweep to demo wallet)"
```

---

## Task 9: Page shell — consent + Stripe Financial Connections bank-link screen

**Files:**
- Modify: `apps/platform/package.json` (add `@stripe/stripe-js` dependency)
- Modify: `apps/platform/.env.local.example` (add Stripe publishable key)
- Create: `apps/platform/src/app/roundup-demo/page.tsx`
- Create: `apps/platform/src/app/roundup-demo/bank-link-screen.tsx`

**Interfaces:**
- Consumes: `/api/roundup-demo/state` (GET), `/api/roundup-demo/bank/link-token` (POST), `/api/roundup-demo/bank/link-complete` (POST) from Tasks 4 and 6.
- Produces: the page's top-level client state shape `type SessionState = { sessionId: string; bank: { linked: boolean; institution: string | null; last4: string | null }; rule: { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }; pendingAccruedCents: number; walletCents: number; txns: Array<{ id: string; merchant: string; amountCents: number; roundUpCents: number; date: string }> }` and a `refresh()` callback — Tasks 10 and 11 add sibling screen components that receive `state` and `refresh` as props from this page.

- [ ] **Step 1: Add the client Stripe dependency**

In `apps/platform/package.json`, in `dependencies`, add (alongside the existing `"stripe": "^22.0.2"`):

```json
    "@stripe/stripe-js": "^4.0.0",
```

Run: `cd apps/platform && pnpm install`
Expected: lockfile updates, install succeeds.

- [ ] **Step 2: Add the publishable-key env var**

In `apps/platform/.env.local.example`, add near any existing Stripe-adjacent vars:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Add the real test-mode value (`pk_test_...`) to your local `.env.local` — get it from the Stripe dashboard, test mode, alongside whatever `STRIPE_SECRET_KEY` this repo already uses for the billing flow.

- [ ] **Step 3: Write the bank-link screen**

```tsx
// apps/platform/src/app/roundup-demo/bank-link-screen.tsx
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

export function BankLinkScreen({ onLinked }: { onLinked: (institution: string | null, last4: string | null) => void }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setStatus('connecting')
    setError(null)
    try {
      const tokenRes = await fetch('/api/roundup-demo/bank/link-token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('Could not start the bank connection.')
      const { clientSecret } = (await tokenRes.json()) as { clientSecret: string }

      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe failed to load.')

      const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret })
      if (result.error) throw new Error(result.error.message)

      const fcSessionId = result.financialConnectionsSession.id
      const completeRes = await fetch('/api/roundup-demo/bank/link-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialConnectionsSessionId: fcSessionId }),
      })
      if (!completeRes.ok) throw new Error('Could not finish linking your bank.')
      const complete = (await completeRes.json()) as { institution: string | null; last4: string | null }

      setStatus('idle')
      onLinked(complete.institution, complete.last4)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong connecting your bank.')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Connect your bank</h2>
      <p className="mb-6 text-sm text-gray-500">
        Securely link your bank account. We only read transactions to compute your round-ups.
      </p>
      <button
        onClick={handleConnect}
        disabled={status === 'connecting'}
        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {status === 'connecting' ? 'Connecting…' : 'Connect bank'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Write the page shell (consent + bank-link only for now; Tasks 10–11 add the rest)**

```tsx
// apps/platform/src/app/roundup-demo/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { BankLinkScreen } from './bank-link-screen'

export interface SessionState {
  sessionId: string
  bank: { linked: boolean; institution: string | null; last4: string | null }
  rule: { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }
  pendingAccruedCents: number
  walletCents: number
  txns: Array<{ id: string; merchant: string; amountCents: number; roundUpCents: number; date: string }>
}

export default function RoundupDemoPage() {
  const [state, setState] = useState<SessionState | null>(null)
  const [consented, setConsented] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/roundup-demo/state')
    const body = (await res.json()) as { session: SessionState }
    setState(body.session)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!state) {
    return <div className="mx-auto max-w-md px-4 py-10 text-sm text-gray-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Round-Ups</h1>
      <p className="mb-6 text-sm text-gray-500">Spare change, put to work.</p>

      {!consented && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="mb-4 text-sm text-gray-700">
            Sneakers rounds up your everyday purchases to the nearest dollar and sweeps the spare
            change into your wallet once it adds up to ${(state.rule.thresholdCents / 100).toFixed(2)}.
            This is a demo — your bank link is real (test mode), but no real money moves.
          </p>
          <button
            onClick={() => setConsented(true)}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Continue
          </button>
        </div>
      )}

      {consented && !state.bank.linked && (
        <BankLinkScreen onLinked={() => refresh()} />
      )}

      {consented && state.bank.linked && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Bank linked: {state.bank.institution} ····{state.bank.last4}. (Round-up config + activity
          screens land in Tasks 10–11.)
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Manual verification on the dev server**

Run: `cd apps/platform && pnpm dev`, open `http://localhost:3000/roundup-demo`.

Expected: consent screen renders with the $5.00 threshold copy; clicking Continue reveals "Connect bank"; clicking it opens Stripe's real Financial Connections modal (test mode); completing it (Stripe's test-mode flow lets you pick a fake test institution and account) returns to the page showing "Bank linked: <institution> ····<last4>".

- [ ] **Step 6: Commit**

```bash
git add apps/platform/package.json apps/platform/pnpm-lock.yaml apps/platform/.env.local.example apps/platform/src/app/roundup-demo/page.tsx apps/platform/src/app/roundup-demo/bank-link-screen.tsx
git commit -m "feat(roundup): consent + Stripe Financial Connections bank-link screen"
```

---

## Task 10: Configure round-up rule screen

**Files:**
- Create: `apps/platform/src/app/roundup-demo/configure-screen.tsx`
- Modify: `apps/platform/src/app/roundup-demo/page.tsx` (render this screen after bank link)

**Interfaces:**
- Consumes: `SessionState` type and `refresh()` from Task 9's page; `PATCH /api/roundup-demo/rule` from Task 5.
- Produces: an `onConfigured: () => void` callback the page uses to advance to Task 11's activity screen.

- [ ] **Step 1: Write the configure screen**

```tsx
// apps/platform/src/app/roundup-demo/configure-screen.tsx
'use client'

import { useState } from 'react'
import type { SessionState } from './page'

export function ConfigureScreen({
  rule,
  onConfigured,
}: {
  rule: SessionState['rule']
  onConfigured: () => void
}) {
  const [thresholdDollars, setThresholdDollars] = useState((rule.thresholdCents / 100).toFixed(2))
  const [multiplier, setMultiplier] = useState(rule.multiplier)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const thresholdCents = Math.round(parseFloat(thresholdDollars) * 100)
    if (!Number.isFinite(thresholdCents) || thresholdCents <= 0) {
      setError('Enter a valid threshold amount.')
      setSaving(false)
      return
    }
    try {
      const res = await fetch('/api/roundup-demo/rule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholdCents, multiplier }),
      })
      if (!res.ok) throw new Error('Could not save your round-up rule.')
      onConfigured()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Configure round-ups</h2>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        Sweep to wallet at
      </label>
      <div className="mb-4 flex items-center rounded-xl border border-gray-200 px-3 py-2">
        <span className="mr-1 text-sm text-gray-500">$</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={thresholdDollars}
          onChange={(e) => setThresholdDollars(e.target.value)}
          className="w-full text-sm text-gray-900 outline-none"
        />
      </div>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        Multiplier
      </label>
      <select
        value={multiplier}
        onChange={(e) => setMultiplier(Number(e.target.value))}
        className="mb-6 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900"
      >
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={5}>5x</option>
      </select>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save and continue'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the page**

In `apps/platform/src/app/roundup-demo/page.tsx`:

Add the import:

```tsx
import { ConfigureScreen } from './configure-screen'
```

Add a `'configure' | 'activity'` sub-stage tracked with `useState`, e.g. `const [stage, setStage] = useState<'configure' | 'activity'>('configure')`, and replace the placeholder block from Task 9 Step 4:

```tsx
      {consented && state.bank.linked && stage === 'configure' && (
        <ConfigureScreen rule={state.rule} onConfigured={() => { refresh(); setStage('activity') }} />
      )}
```

(The `stage === 'activity'` branch is added in Task 11.)

- [ ] **Step 3: Manual verification**

On the dev server, after linking a bank (Task 9), confirm the configure screen appears with the $5.00 default pre-filled, change it (e.g. to `0.50` to make the demo threshold easy to hit), click "Save and continue", and confirm `curl -s http://localhost:3000/api/roundup-demo/state -b cookies.txt` reflects the new `thresholdCents`.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/roundup-demo/configure-screen.tsx apps/platform/src/app/roundup-demo/page.tsx
git commit -m "feat(roundup): configure round-up rule screen"
```

---

## Task 11: Activity + facilitation screen

**Files:**
- Create: `apps/platform/src/app/roundup-demo/activity-screen.tsx`
- Modify: `apps/platform/src/app/roundup-demo/page.tsx` (render this screen for `stage === 'activity'`)

**Interfaces:**
- Consumes: `SessionState` and `refresh()` from Task 9's page; `POST /api/roundup-demo/transactions/sync` (Task 7) and `POST /api/roundup-demo/facilitate` (Task 8).
- Produces: nothing consumed by later tasks — this is the terminal screen of the flow for this milestone.

- [ ] **Step 1: Write the activity screen**

```tsx
// apps/platform/src/app/roundup-demo/activity-screen.tsx
'use client'

import { useEffect, useState } from 'react'
import type { SessionState } from './page'

export function ActivityScreen({ state, refresh }: { state: SessionState; refresh: () => Promise<void> }) {
  const [syncing, setSyncing] = useState(false)
  const [justMoved, setJustMoved] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function syncAndFacilitate() {
      setSyncing(true)
      await fetch('/api/roundup-demo/transactions/sync', { method: 'POST' })
      const facilitateRes = await fetch('/api/roundup-demo/facilitate', { method: 'POST' })
      const facilitateBody = (await facilitateRes.json()) as { moved: boolean; movedCents?: number }
      if (!cancelled && facilitateBody.moved && facilitateBody.movedCents) {
        setJustMoved(facilitateBody.movedCents)
      }
      if (!cancelled) await refresh()
      if (!cancelled) setSyncing(false)
    }
    syncAndFacilitate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressPct = Math.min(100, Math.round((state.pendingAccruedCents / state.rule.thresholdCents) * 100))

  return (
    <div className="space-y-4">
      {justMoved !== null && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ${(justMoved / 100).toFixed(2)} swept to your wallet 🎉
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Round-ups toward ${(state.rule.thresholdCents / 100).toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            ${(state.pendingAccruedCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gray-900" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Wallet balance</div>
        <div className="text-2xl font-bold text-gray-900">${(state.walletCents / 100).toFixed(2)}</div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent activity</div>
        <ul className="divide-y divide-gray-100">
          {state.txns.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-700">{t.merchant}</span>
              <span className="text-gray-400">${(t.amountCents / 100).toFixed(2)}</span>
              <span className="font-semibold text-gray-900">+${(t.roundUpCents / 100).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      {syncing && <p className="text-center text-xs text-gray-400">Syncing…</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the page**

In `apps/platform/src/app/roundup-demo/page.tsx`, add the import:

```tsx
import { ActivityScreen } from './activity-screen'
```

Add the final branch alongside the `stage === 'configure'` block from Task 10:

```tsx
      {consented && state.bank.linked && stage === 'activity' && (
        <ActivityScreen state={state} refresh={refresh} />
      )}
```

- [ ] **Step 3: Manual verification — the full end-to-end flow**

On the dev server: consent → connect bank (Stripe test-mode Financial Connections) → configure a low threshold (e.g. `$0.50`) → land on the activity screen. Expected: the screen auto-syncs the seeded transaction feed (since a fresh Stripe test-mode account has no real transactions), shows a progress bar and recent-activity list with round-up amounts matching the engine's math, and — since the seeded feed's round-ups exceed $0.50 — immediately shows the green "$X.XX swept to your wallet" banner with a non-zero wallet balance. Refresh the page (`state` is re-fetched on load) and confirm the wallet balance and bank-linked status persist across the reload (proving the session cookie + Supabase persistence both work).

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/roundup-demo/activity-screen.tsx apps/platform/src/app/roundup-demo/page.tsx
git commit -m "feat(roundup): activity + facilitation screen — completes the round-up portal flow"
```

---

## Task 12: End-to-end verification pass

**Files:** none (verification only).

- [ ] **Step 1: Fresh-session smoke test**

Clear cookies (open a new private/incognito browser window) and load `http://localhost:3000/roundup-demo`. Walk through: consent → connect bank (use Stripe's test-mode Financial Connections flow, picking any test institution) → configure (leave the $5.00 default) → activity. Confirm the demo transaction feed appears (since the test bank account has no real transactions) with correct round-up math per transaction (spot-check 2–3 against `computeRoundUpCents` by hand), and that the wallet balance updates once accrual crosses $5.00.

- [ ] **Step 2: Idempotency + persistence check**

Reload the activity screen 3 times in a row. Confirm: no duplicate transactions appear in "Recent activity" (Task 7's upsert is idempotent), the wallet balance never double-counts a facilitation that already happened, and the progress bar reflects only the *unfacilitated* remainder.

- [ ] **Step 3: Second independent session**

Open a second private window (a second anonymous session) and confirm it starts completely fresh — no bank link, $0.00 wallet, default $5.00 threshold — proving sessions are properly isolated by the cookie-scoped `session_id` and not accidentally shared (e.g. via a module-level cache).

- [ ] **Step 4: Confirm no Polymarket code path was touched**

```bash
git diff main --stat | grep -i polymarket
```

Expected: no output — this milestone must not modify `apps/platform/src/lib/autotrade/polymarket.ts` or any Polymarket-related file, per the Global Constraints.

- [ ] **Step 5: Final commit (if any fixups were needed during verification)**

```bash
git add -A
git commit -m "fix(roundup): address end-to-end verification findings"
```

(Skip this step if verification passed clean with no fixes needed.)
