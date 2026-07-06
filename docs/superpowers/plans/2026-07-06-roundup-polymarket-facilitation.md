# Round-Up Polymarket Facilitation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, admin-configured facilitation mode to the round-up portal — instead of sweeping accrued round-ups into the demo wallet, route them into a single Polymarket market and record a simulated position (entry price vs. live current price, unrealized P&L), surfaced on the Activity screen.

**Architecture:** A global env-var switch (`ROUNDUP_FACILITATION_MODE`) branches `POST /api/roundup-demo/facilitate` between the existing wallet-move path (unchanged) and a new Polymarket path that inserts a row into a new `roundup_demo_positions` table using a live price read from Polymarket's public gamma API (no credentials, no order placement). `GET /api/roundup-demo/state` is extended to return each position with its live current price and computed P&L, fetched fresh on every call — the client never talks to Polymarket directly.

**Tech Stack:** Next.js 16 (App Router), Supabase (service-role client, no RLS policies), Polymarket's public gamma API (plain `fetch`, no SDK), `@sneakers/core` (Node's built-in test runner for pure math).

## Global Constraints

- No real Polymarket order placement, no business-account trading credentials used anywhere in this milestone — only public, unauthenticated gamma API reads.
- One market for everyone, admin-configured via environment variables (`ROUNDUP_FACILITATION_MODE`, `ROUNDUP_POLYMARKET_MARKET_ID`) — no per-user picker, no admin settings UI.
- Real-bank/live-Stripe connectivity is explicitly out of scope — this milestone touches only the facilitation/positions surface, not the Stripe bank-link flow.
- A session's history can span both modes if the admin flips the switch mid-flight — `state`'s positions list and wallet balance are independent; render whichever data exists, don't assume one mode for the whole session.
- All new Next.js API routes follow this repo's established conventions: `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`, `ensureSession()`/`attachSessionCookie()` from `@/lib/roundup/session` wrapped in try/catch returning `{ error: 'session_init_failed', message }` at 500.
- Reuse `getServerClient()` from `@/lib/supabase-server` (service-role) for all Supabase access — same as every existing round-up route.
- `apps/platform` has no automated test harness in this repo; API routes and UI are verified manually via Playwright (confirmed working directly against `localhost:3000` in this session) and curl. `packages/core` uses Node's built-in test runner (`node --import tsx --test "src/**/*.test.ts"`) for pure logic — TDD there.
- Spec: `docs/superpowers/specs/2026-07-06-roundup-polymarket-facilitation-design.md`.

---

## Task 1: Position P&L math (pure, TDD) in packages/core

**Files:**
- Create: `packages/core/src/roundup/position.ts`
- Test: `packages/core/src/roundup/position.test.ts`
- Modify: `packages/core/src/index.ts` (add export)

**Interfaces:**
- Consumes: nothing.
- Produces: `computePositionPnlCents(entryPrice: number, currentPrice: number, sizeCents: number): number` — consumed by Task 6 (the `state` route).

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/roundup/position.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePositionPnlCents } from './position.js'

test('computePositionPnlCents is zero when price is unchanged', () => {
  assert.equal(computePositionPnlCents(0.5, 0.5, 1000), 0)
})

test('computePositionPnlCents is positive when price rises', () => {
  // entry 0.50 -> current 0.60, size 1000c: pnl = ((0.60-0.50)/0.50)*1000 = 200
  assert.equal(computePositionPnlCents(0.5, 0.6, 1000), 200)
})

test('computePositionPnlCents is negative when price falls', () => {
  // entry 0.50 -> current 0.40, size 1000c: pnl = ((0.40-0.50)/0.50)*1000 = -200
  assert.equal(computePositionPnlCents(0.5, 0.4, 1000), -200)
})

test('computePositionPnlCents rounds to the nearest cent', () => {
  // entry 0.30 -> current 0.31, size 500c: ((0.01)/0.30)*500 = 16.666... -> 17
  assert.equal(computePositionPnlCents(0.3, 0.31, 500), 17)
})

test('computePositionPnlCents handles a price of exactly 1.0 (resolved YES)', () => {
  // entry 0.20 -> current 1.0, size 1000c: ((0.80)/0.20)*1000 = 4000
  assert.equal(computePositionPnlCents(0.2, 1.0, 1000), 4000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && node --import tsx --test src/roundup/position.test.ts`
Expected: FAIL — cannot find module `./position.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/roundup/position.ts
/**
 * Unrealized P&L for a simulated Polymarket position, in signed cents.
 * entryPrice/currentPrice are Polymarket YES prices in the 0-1 range.
 * A position of sizeCents "bought" at entryPrice is worth
 * sizeCents * (currentPrice / entryPrice) today; P&L is that minus sizeCents.
 */
export function computePositionPnlCents(
  entryPrice: number,
  currentPrice: number,
  sizeCents: number,
): number {
  return Math.round(((currentPrice - entryPrice) / entryPrice) * sizeCents)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && node --import tsx --test src/roundup/position.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Export from the package index**

In `packages/core/src/index.ts`, add:

```ts
export * from './roundup/position'
```

(No `.js` extension — matches every other line in this file; a prior fix in this same file corrected two lines that mistakenly had one, since Turbopack's resolver doesn't tolerate it even though plain `tsc` does.)

- [ ] **Step 6: Run the full core suite to confirm nothing broke**

Run: `cd packages/core && npm test`
Expected: PASS (all existing tests + the new 5).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/roundup/position.ts packages/core/src/roundup/position.test.ts packages/core/src/index.ts
git commit -m "feat(roundup): position P&L math in @sneakers/core"
```

---

## Task 2: Supabase migration for `roundup_demo_positions`

**Files:**
- Create: `apps/platform/supabase/migrations/047_roundup_demo_positions.sql`
- Create: `docs/prompts/apply-047-roundup-demo-positions-migration.md`

**Interfaces:**
- Consumes: `roundup_demo_sessions(session_id)` from migration 046 (foreign key).
- Produces: the `roundup_demo_positions` table, consumed by Tasks 5 (facilitate route, inserts) and 6 (state route, reads).

This repo's convention for applying migrations to the live shared Supabase project is a Chrome-driven manual-apply prompt file (no linked Supabase CLI project exists) — see `docs/prompts/apply-046-roundup-demo-migration.md` for the exact format to match.

- [ ] **Step 1: Write the migration**

```sql
-- apps/platform/supabase/migrations/047_roundup_demo_positions.sql
--
-- Simulated Polymarket positions for the round-up portal's Polymarket
-- facilitation mode (Milestone 2). Separate from roundup_demo_ledger
-- (wallet-mode's audit table) so wallet-mode's data model is untouched
-- regardless of which facilitation mode is active. No real trades are ever
-- recorded here -- entry_price/size_cents describe a simulated fill against
-- a live market price, not a real Polymarket order. Same anonymous-session
-- model as the rest of this feature: no auth.users reference, service-role
-- only, no RLS policies.

create table if not exists roundup_demo_positions (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null references roundup_demo_sessions(session_id) on delete cascade,
  market_id        text not null,
  market_question  text,
  entry_price      numeric not null,
  size_cents       integer not null,
  opened_at        timestamptz not null default now()
);

create index if not exists roundup_demo_positions_session_idx
  on roundup_demo_positions (session_id, opened_at desc);

alter table roundup_demo_positions enable row level security;

-- No public policies -- service role only, same as every other roundup_demo_* table.
```

- [ ] **Step 2: Write the apply-migration prompt file**

```markdown
# Chrome prompt — Apply migration 047_roundup_demo_positions.sql

Applies the simulated-Polymarket-position table to the Sneakers Terminal Supabase project via the dashboard SQL editor. Must run **before** the Polymarket facilitation mode (Tasks 5-7) receives traffic.

---

Task: apply migration 047_roundup_demo_positions.sql to the Sneakers Terminal Supabase project. Creates one service-role-only table (roundup_demo_positions) for simulated Polymarket positions recorded by the round-up portal's Polymarket facilitation mode.

Prerequisites:
- Logged into supabase.com
- Project ref: ujfgtkebslesepbjrhyr

Step 1 — navigate
Go to: https://supabase.com/dashboard/project/ujfgtkebslesepbjrhyr/sql/new

Step 2 — paste this SQL into the editor

\`\`\`sql
-- apps/platform/supabase/migrations/047_roundup_demo_positions.sql
--
-- Simulated Polymarket positions for the round-up portal's Polymarket
-- facilitation mode (Milestone 2). Separate from roundup_demo_ledger
-- (wallet-mode's audit table) so wallet-mode's data model is untouched
-- regardless of which facilitation mode is active. No real trades are ever
-- recorded here -- entry_price/size_cents describe a simulated fill against
-- a live market price, not a real Polymarket order. Same anonymous-session
-- model as the rest of this feature: no auth.users reference, service-role
-- only, no RLS policies.

create table if not exists roundup_demo_positions (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null references roundup_demo_sessions(session_id) on delete cascade,
  market_id        text not null,
  market_question  text,
  entry_price      numeric not null,
  size_cents       integer not null,
  opened_at        timestamptz not null default now()
);

create index if not exists roundup_demo_positions_session_idx
  on roundup_demo_positions (session_id, opened_at desc);

alter table roundup_demo_positions enable row level security;

-- No public policies -- service role only, same as every other roundup_demo_* table.
\`\`\`

Step 3 — click Run (or Cmd+Enter)

Step 4 — verify
- Result panel should show "Success. No rows returned."
- Then navigate to Table Editor → public
- You should see a new table: roundup_demo_positions
- Its columns: id (uuid, primary key), session_id (text, foreign key to roundup_demo_sessions), market_id (text), market_question (text, nullable), entry_price (numeric), size_cents (int4), opened_at (timestamptz)

Step 5 — report back
- Confirm the SQL ran successfully (screenshot the result panel)
- Screenshot Table Editor showing the new table and its columns
- If there's any error message, copy the exact text verbatim before retrying anything

Do NOT:
- Run any other SQL
- Change RLS policies
- Edit any rows manually

If the migration errors, the most likely cause is a syntax error in the foreign key reference; stop and paste the error.
```

- [ ] **Step 3: Manual SQL read-through**

Read the SQL in Step 1 for syntax correctness (balanced parens, correct `references` syntax, correct index syntax) since it cannot be executed in this environment without a human applying it via the dashboard. Note in your report that this is a manual read-through, not an executed test — the same pattern used for migration 046.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/supabase/migrations/047_roundup_demo_positions.sql docs/prompts/apply-047-roundup-demo-positions-migration.md
git commit -m "feat(roundup): add roundup_demo_positions migration for Polymarket facilitation mode"
```

---

## Task 3: Facilitation-mode config helper

**Files:**
- Create: `apps/platform/src/lib/roundup/facilitation-mode.ts`
- Modify: `apps/platform/.env.local.example`

**Interfaces:**
- Consumes: `process.env.ROUNDUP_FACILITATION_MODE`, `process.env.ROUNDUP_POLYMARKET_MARKET_ID`.
- Produces: `type FacilitationMode = { kind: 'wallet' } | { kind: 'polymarket'; marketId: string }` and `getFacilitationMode(): FacilitationMode` (throws if misconfigured) — consumed by Task 5 (facilitate route).

- [ ] **Step 1: Write the config helper**

```ts
// apps/platform/src/lib/roundup/facilitation-mode.ts
//
// Reads which facilitation mode is active from environment variables. This
// is a global (not per-session) switch -- per the Milestone 2 design's
// "one market for everyone, admin-configured" decision, there is no admin
// UI or per-user picker in this pass. Changing the mode or target market
// means editing these env vars and restarting the server.

export type FacilitationMode = { kind: 'wallet' } | { kind: 'polymarket'; marketId: string }

export function getFacilitationMode(): FacilitationMode {
  const raw = process.env.ROUNDUP_FACILITATION_MODE
  if (raw !== 'polymarket') {
    return { kind: 'wallet' }
  }
  const marketId = process.env.ROUNDUP_POLYMARKET_MARKET_ID
  if (!marketId) {
    throw new Error(
      'ROUNDUP_FACILITATION_MODE=polymarket requires ROUNDUP_POLYMARKET_MARKET_ID to also be set',
    )
  }
  return { kind: 'polymarket', marketId }
}
```

- [ ] **Step 2: Document the env vars**

In `apps/platform/.env.local.example`, add a new documented section (this file has no existing round-up-specific section beyond the Stripe keys added in Milestone 1 — add this as its own block):

```
# Round-up portal — Polymarket facilitation mode (Milestone 2). Optional; if
# unset, the portal defaults to wallet-move facilitation (Milestone 1).
# ROUNDUP_FACILITATION_MODE=polymarket
# ROUNDUP_POLYMARKET_MARKET_ID=
```

- [ ] **Step 3: Manual verification**

This is a pure config-reading function with no I/O — verify by temporarily adding a one-off script or by exercising it indirectly once Task 5 wires it into the facilitate route (that task's manual verification covers both the `wallet` default and `polymarket`-mode paths). No standalone test needed for this trivial a function, consistent with this repo's convention of not unit-testing simple env-var readers in `apps/platform` (e.g. `apps/platform/src/lib/stripe.ts`'s `siteUrl()` has no test either).

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/lib/roundup/facilitation-mode.ts apps/platform/.env.local.example
git commit -m "feat(roundup): facilitation-mode config helper (wallet default, polymarket opt-in)"
```

---

## Task 4: Polymarket read-only price lookup

**Files:**
- Create: `apps/platform/src/lib/roundup/polymarket-price.ts`

**Interfaces:**
- Consumes: nothing (plain `fetch` against Polymarket's public gamma API).
- Produces: `interface PolymarketPrice { question: string; price: number }` and `fetchPolymarketPrice(marketId: string): Promise<PolymarketPrice>` — consumed by Tasks 5 (facilitate route) and 6 (state route).

This mirrors `resolveTokenIds` in `apps/platform/src/lib/autotrade/polymarket.ts:409-436` — same gamma API, same `/markets/{id}` endpoint, same "gamma sometimes returns a JSON-encoded string, sometimes a real array" normalization already established for `clobTokenIds` there and for `outcomePrices` in `apps/platform/src/lib/chance/source.ts:33-38`. This module never calls Polymarket's CLOB/trading endpoints and never touches business account credentials — read-only market data only.

- [ ] **Step 1: Write the price-lookup module**

```ts
// apps/platform/src/lib/roundup/polymarket-price.ts
//
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
```

- [ ] **Step 2: Manual verification against the real gamma API**

Find a real, currently-active Polymarket market ID to test against (any market slug/id works since this is a public read — check `https://gamma-api.polymarket.com/markets?limit=1` for a sample id, or reuse one already referenced elsewhere in this codebase's test fixtures/docs if one exists).

```bash
curl -s "https://gamma-api.polymarket.com/markets?limit=1" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'], d[0]['question'])"
```

Then verify the module directly with a one-off script (delete after running):

```bash
cd apps/platform
cat > /tmp/test-price.ts <<'EOF'
import { fetchPolymarketPrice } from './src/lib/roundup/polymarket-price'
const MARKET_ID = process.argv[2]
fetchPolymarketPrice(MARKET_ID).then(console.log).catch(console.error)
EOF
npx tsx /tmp/test-price.ts <the-market-id-from-above>
rm /tmp/test-price.ts
```

Expected: `{ question: '<real question text>', price: <a number between 0 and 1> }`. If a market has already resolved, price may legitimately be `0` or `1` — that's correct behavior, not a bug.

- [ ] **Step 3: Run tsc to confirm no type errors**

Run: `cd apps/platform && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/lib/roundup/polymarket-price.ts
git commit -m "feat(roundup): read-only Polymarket price lookup for facilitation mode"
```

---

## Task 5: Wire the Polymarket branch into the facilitate route

**Files:**
- Modify: `apps/platform/src/app/api/roundup-demo/facilitate/route.ts`

**Interfaces:**
- Consumes: `getFacilitationMode` (Task 3), `fetchPolymarketPrice` (Task 4), `roundup_demo_positions` table (Task 2).
- Produces: no new exports; the route's `polymarket`-mode response shape is `{ ok: true, moved: true, movedCents, marketId, entryPrice }` on success, matching the existing `{ ok: true, moved: false, ... }` shapes for the not-reached/cap-reached/concurrent-update cases.

**This task replaces the entire current file.** The existing wallet-mode logic (lines through the final `return` — already reviewed, hardened against a real concurrency race, and covered by the progress ledger's history) is preserved byte-for-byte as the `wallet` branch; only the mode check and the new `polymarket` branch are added.

- [ ] **Step 1: Read the current file to confirm it matches this plan's assumption**

```bash
cat apps/platform/src/app/api/roundup-demo/facilitate/route.ts
```

If it materially differs from the "wallet mode" logic shown in Step 2 below (e.g. a future unrelated change landed on it), STOP and report — do not silently reconcile a mismatch in money-movement code.

- [ ] **Step 2: Write the full replacement file**

```ts
// apps/platform/src/app/api/roundup-demo/facilitate/route.ts
import { NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { ensureSession, attachSessionCookie } from '@/lib/roundup/session'
import { thresholdReached, transferableCents, type RoundUpRule } from '@sneakers/core'
import { getFacilitationMode } from '@/lib/roundup/facilitation-mode'
import { fetchPolymarketPrice, type PolymarketPrice } from '@/lib/roundup/polymarket-price'

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

  let mode: ReturnType<typeof getFacilitationMode>
  try {
    mode = getFacilitationMode()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'config_error', message }, { status: 500 })
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

  if (mode.kind === 'polymarket') {
    let priceData: PolymarketPrice
    try {
      priceData = await fetchPolymarketPrice(mode.marketId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: 'polymarket_price_lookup_failed', message }, { status: 502 })
    }

    // Audit-record-first, same fail-closed ordering as wallet mode below: if this
    // insert fails, bail before touching session state at all.
    const { data: positionRow, error: positionErr } = await sb
      .from('roundup_demo_positions')
      .insert({
        session_id: sessionId,
        market_id: mode.marketId,
        market_question: priceData.question,
        entry_price: priceData.price,
        size_cents: movedCents,
      })
      .select('id')
      .single()
    if (positionErr || !positionRow) {
      return NextResponse.json({ error: 'position_write_failed', message: positionErr?.message }, { status: 500 })
    }

    // Same optimistic-concurrency guard as wallet mode -- see that branch's comments
    // for the full race-condition rationale. wallet_cents is deliberately untouched
    // here: no money enters the demo wallet in this mode, the position row itself is
    // the audit record.
    const { data: updatedRows, error: updateErr } = await sb
      .from('roundup_demo_sessions')
      .update({
        facilitated_cents: session.facilitated_cents + movedCents,
        transferred_this_week_cents: session.transferred_this_week_cents + movedCents,
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('facilitated_cents', session.facilitated_cents)
      .select('session_id')
    if (updateErr) {
      await sb.from('roundup_demo_positions').delete().eq('id', positionRow.id)
      return NextResponse.json({ error: 'facilitation_update_failed', message: updateErr.message }, { status: 500 })
    }
    if (!updatedRows || updatedRows.length === 0) {
      await sb.from('roundup_demo_positions').delete().eq('id', positionRow.id)
      return NextResponse.json({
        ok: true,
        moved: false,
        reason: 'concurrent_update',
        pendingAccruedCents,
      })
    }

    const res = NextResponse.json({
      ok: true,
      moved: true,
      movedCents,
      marketId: mode.marketId,
      entryPrice: priceData.price,
    })
    return isNew ? attachSessionCookie(res, sessionId) : res
  }

  // wallet mode (default) -- unchanged from Milestone 1.
  //
  // Ledger row is written BEFORE the wallet/session update (fail closed): if the ledger
  // insert fails, we bail out before any money moves, so there's never a wallet credit
  // without a corresponding audit row. The inverse gap (a ledger row exists but the
  // session update below fails) is possible since this isn't a real DB transaction, but
  // that gap is detectable/reconcilable later (ledger cumulative sum vs. wallet_cents),
  // which is strictly better than the original ordering's silent over-crediting. True
  // atomicity would need a Postgres function/RPC wrapping both writes in one transaction
  // — out of scope here since there's no migration path available in this environment.
  const { data: ledgerRow, error: ledgerErr } = await sb
    .from('roundup_demo_ledger')
    .insert({
      session_id: sessionId,
      kind: 'facilitation',
      amount_cents: movedCents,
      memo: `Round-ups swept to wallet at $${(rule.thresholdCents / 100).toFixed(2)} threshold`,
    })
    .select('id')
    .single()
  if (ledgerErr || !ledgerRow) {
    return NextResponse.json({ error: 'ledger_write_failed', message: ledgerErr?.message }, { status: 500 })
  }

  // Optimistic concurrency control: only apply the update if facilitated_cents still
  // matches what we read moments earlier. If another concurrent request already moved
  // the session forward, this filter matches zero rows and .select() comes back empty
  // (distinct from a Supabase error, which surfaces via updateErr). We do NOT retry with
  // fresh values in this request — that would risk double-applying movedCents against a
  // value we didn't originate.
  const { data: updatedRows, error: updateErr } = await sb
    .from('roundup_demo_sessions')
    .update({
      facilitated_cents: session.facilitated_cents + movedCents,
      wallet_cents: session.wallet_cents + movedCents,
      transferred_this_week_cents: session.transferred_this_week_cents + movedCents,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)
    .eq('facilitated_cents', session.facilitated_cents)
    .select('wallet_cents')
  if (updateErr) {
    // Genuine DB error on the update (network blip, constraint violation, etc.).
    // The ledger row was already inserted; compensate by deleting it so the audit
    // trail doesn't claim a movement that didn't happen. Best-effort: if the delete
    // itself fails, proceed to return the original error anyway without letting the
    // failed cleanup mask or replace the real error.
    await sb.from('roundup_demo_ledger').delete().eq('id', ledgerRow.id)
    return NextResponse.json({ error: 'facilitation_update_failed', message: updateErr.message }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Zero rows matched: another concurrent request already changed facilitated_cents
    // between our read and this write, so no money actually moved on this call. The
    // ledger row inserted above was written on the assumption this call would win the
    // race; since it didn't, compensate by deleting that row so the audit trail never
    // claims a movement that didn't happen. Best-effort: if the delete fails, we still
    // return the no-op response rather than resurrecting an update we deliberately
    // chose not to retry; the caller re-syncs and calls facilitate() again on its next
    // poll cycle, so the money itself isn't lost.
    await sb.from('roundup_demo_ledger').delete().eq('id', ledgerRow.id)
    return NextResponse.json({
      ok: true,
      moved: false,
      reason: 'concurrent_update',
      pendingAccruedCents,
    })
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

- [ ] **Step 3: Run tsc**

Run: `cd apps/platform && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification — wallet mode is unaffected**

With `ROUNDUP_FACILITATION_MODE` unset (or absent from `.env.local`) and the dev server running:

```bash
curl -s -X POST http://localhost:3000/api/roundup-demo/facilitate -b cookies.txt -c cookies.txt | python3 -m json.tool
```

Expected: identical behavior to before this change (a `moved: true` response with `walletCents`, or a `moved: false` response — whichever matches the test session's current accrual state). This confirms the untouched wallet branch still works byte-for-byte.

- [ ] **Step 5: Manual verification — Polymarket mode, using Playwright to observe network + Supabase state**

Requires migration 047 already applied (Task 2) and a real Polymarket market id (from Task 4's verification step).

1. Set in `apps/platform/.env.local`:
   ```
   ROUNDUP_FACILITATION_MODE=polymarket
   ROUNDUP_POLYMARKET_MARKET_ID=<the market id from Task 4>
   ```
2. Restart the dev server so the new env vars are picked up.
3. Get a fresh session's accrual above threshold (PATCH the rule to a low threshold, POST sync, per the established pattern from Milestone 1's task reports), then:
   ```bash
   curl -s -X POST http://localhost:3000/api/roundup-demo/facilitate -b cookies.txt -c cookies.txt | python3 -m json.tool
   ```
4. Expected: `{ "ok": true, "moved": true, "movedCents": <n>, "marketId": "<the market id>", "entryPrice": <a number 0-1> }`.
5. Confirm a row was actually written: query `roundup_demo_positions` for that session_id via the Supabase dashboard Table Editor, or note that Task 6's `state` route (once built) will surface it — cross-check there instead of a second manual query if that's simpler.
6. Test the config-error path: temporarily set `ROUNDUP_FACILITATION_MODE=polymarket` with `ROUNDUP_POLYMARKET_MARKET_ID` unset, restart, call facilitate again, confirm a clean `{ "error": "config_error", "message": "..." }` at 500 rather than a crash.
7. Revert `.env.local` to `ROUNDUP_FACILITATION_MODE` unset (or `wallet`) afterward so Task 6/7's default-path testing isn't affected, unless you're intentionally leaving it in `polymarket` mode to continue into those tasks.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/api/roundup-demo/facilitate/route.ts
git commit -m "feat(roundup): branch facilitate route on facilitation mode (wallet unchanged, new polymarket path)"
```

---

## Task 6: Surface positions with live price in the state route

**Files:**
- Modify: `apps/platform/src/app/api/roundup-demo/state/route.ts`

**Interfaces:**
- Consumes: `fetchPolymarketPrice` (Task 4), `computePositionPnlCents` (Task 1), `roundup_demo_positions` table (Task 2).
- Produces: extends the `GET /api/roundup-demo/state` response with `session.positions: Array<{ id: string; marketId: string; marketQuestion: string | null; entryPrice: number; sizeCents: number; currentPrice: number | null; pnlCents: number | null }>` — consumed by Task 7 (the `SessionState` type and Activity screen).

- [ ] **Step 1: Read the current file**

```bash
cat apps/platform/src/app/api/roundup-demo/state/route.ts
```

- [ ] **Step 2: Add the positions fetch + live-price enrichment, and include it in the response body**

Add these imports at the top (alongside the existing ones):

```ts
import { fetchPolymarketPrice } from '@/lib/roundup/polymarket-price'
import { computePositionPnlCents } from '@sneakers/core'
```

After the existing `txns` fetch block (right before `const totalRoundUpCents = ...`), add:

```ts
  const { data: positions, error: positionsErr } = await sb
    .from('roundup_demo_positions')
    .select('*')
    .eq('session_id', sessionId)
    .order('opened_at', { ascending: false })
  if (positionsErr) {
    return NextResponse.json({ error: 'positions_load_failed', message: positionsErr.message }, { status: 500 })
  }

  // Live price is fetched fresh on every call (same "server is authoritative,
  // recomputed on read" pattern as pendingAccruedCents below) -- the client never
  // calls Polymarket directly. A failed live-price lookup degrades gracefully to
  // showing the entry price only (currentPrice/pnlCents null) rather than failing
  // the whole state load.
  const positionsWithLivePrice = await Promise.all(
    (positions ?? []).map(async (p) => {
      let currentPrice: number | null = null
      try {
        const live = await fetchPolymarketPrice(p.market_id)
        currentPrice = live.price
      } catch {
        currentPrice = null
      }
      const entryPrice = Number(p.entry_price)
      return {
        id: p.id,
        marketId: p.market_id,
        marketQuestion: p.market_question,
        entryPrice,
        sizeCents: p.size_cents,
        currentPrice,
        pnlCents: currentPrice !== null ? computePositionPnlCents(entryPrice, currentPrice, p.size_cents) : null,
      }
    }),
  )
```

Then, in the response `body` object, add `positions: positionsWithLivePrice` as a new field alongside the existing `sessionId`/`bank`/`rule`/`pendingAccruedCents`/`walletCents`/`txns` fields (inside `body.session`).

- [ ] **Step 3: Run tsc**

Run: `cd apps/platform && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

With a session that has at least one position from Task 5's verification:

```bash
curl -s http://localhost:3000/api/roundup-demo/state -b cookies.txt | python3 -m json.tool
```

Expected: `session.positions` is a non-empty array; each entry has `entryPrice` matching what Task 5 recorded, a `currentPrice` (a live number, possibly identical to `entryPrice` if the market hasn't moved), and `pnlCents` computed consistently — hand-verify one entry's `pnlCents` against `computePositionPnlCents`'s formula using the `entryPrice`/`currentPrice`/`sizeCents` shown.

Also verify with a session that has NO positions (a fresh session, or one that's only ever run in `wallet` mode): confirm `session.positions` is an empty array `[]`, not `null` or a missing field, and that this doesn't break anything (existing `bank`/`rule`/`txns`/`walletCents` fields are unaffected).

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/api/roundup-demo/state/route.ts
git commit -m "feat(roundup): surface positions with live Polymarket price in the state route"
```

---

## Task 7: Position card on the Activity screen

**Files:**
- Modify: `apps/platform/src/app/roundup-demo/page.tsx` (extend `SessionState` type)
- Modify: `apps/platform/src/app/roundup-demo/activity-screen.tsx` (render the position card)

**Interfaces:**
- Consumes: `session.positions` from Task 6's `state` route response.
- Produces: nothing consumed by later tasks — this is the final UI piece of this milestone.

- [ ] **Step 1: Extend the `SessionState` type in page.tsx**

In `apps/platform/src/app/roundup-demo/page.tsx`, find:

```ts
export interface SessionState {
  sessionId: string
  bank: { linked: boolean; institution: string | null; last4: string | null }
  rule: { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }
  pendingAccruedCents: number
  walletCents: number
  txns: Array<{ id: string; merchant: string; amountCents: number; roundUpCents: number; date: string }>
}
```

Replace it with:

```ts
export interface SessionState {
  sessionId: string
  bank: { linked: boolean; institution: string | null; last4: string | null }
  rule: { roundToCents: number; multiplier: number; thresholdCents: number; weeklyCapCents: number }
  pendingAccruedCents: number
  walletCents: number
  txns: Array<{ id: string; merchant: string; amountCents: number; roundUpCents: number; date: string }>
  positions: Array<{
    id: string
    marketId: string
    marketQuestion: string | null
    entryPrice: number
    sizeCents: number
    currentPrice: number | null
    pnlCents: number | null
  }>
}
```

- [ ] **Step 2: Add the position card to activity-screen.tsx**

In `apps/platform/src/app/roundup-demo/activity-screen.tsx`, after the existing "Wallet balance" card block (`<div className="rounded-2xl border border-gray-200 bg-white p-6">...Wallet balance...</div>`) and before the "Recent activity" card, add:

```tsx
      {state.positions.length > 0 && (
        <div className="space-y-2">
          {state.positions.map((p) => {
            const pnlPositive = p.pnlCents !== null && p.pnlCents >= 0
            return (
              <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Polymarket position
                </div>
                <div className="mb-3 text-sm text-gray-700">{p.marketQuestion ?? p.marketId}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Entry {(p.entryPrice * 100).toFixed(0)}¢ · Size ${(p.sizeCents / 100).toFixed(2)}
                  </span>
                  {p.pnlCents !== null && p.currentPrice !== null ? (
                    <span className={`font-semibold ${pnlPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {pnlPositive ? '+' : ''}
                      ${(p.pnlCents / 100).toFixed(2)} ({(p.currentPrice * 100).toFixed(0)}¢ now)
                    </span>
                  ) : (
                    <span className="text-gray-400">Live price unavailable</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
```

- [ ] **Step 3: Run tsc**

Run: `cd apps/platform && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification with Playwright**

With the dev server running and `ROUNDUP_FACILITATION_MODE=polymarket` set (per Task 5's verification setup), drive the flow in a real browser via Playwright:

1. Navigate to `http://localhost:3000/roundup-demo`.
2. Walk through consent → bank-link (mock the network call for `bank/link-token`/`bank/link-complete` if a live Stripe key isn't configured in this environment, matching the technique used in prior Milestone 1 task verifications) → configure a low threshold → land on Activity.
3. Confirm the position card renders: market question, entry price in cents, size in dollars, and either a colored P&L figure or "Live price unavailable" if the lookup happens to fail.
4. Reload the page and confirm the position card still renders identically (state persists, per the existing session-persistence behavior).
5. Take a screenshot for the report.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/roundup-demo/page.tsx apps/platform/src/app/roundup-demo/activity-screen.tsx
git commit -m "feat(roundup): render the Polymarket position card on the Activity screen"
```

---

## Task 8: End-to-end verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full flow in wallet mode (regression check)**

With `ROUNDUP_FACILITATION_MODE` unset, drive the full flow via Playwright exactly as in Milestone 1's final verification: consent → bank-link → configure → activity, confirm the wallet-balance card and sweep banner still work identically to before this milestone. This confirms Task 5's byte-for-byte-preserved wallet branch is genuinely unaffected.

- [ ] **Step 2: Full flow in polymarket mode**

With `ROUNDUP_FACILITATION_MODE=polymarket` and a real market id set, drive the full flow via Playwright: consent → bank-link → configure → activity, confirm the position card renders with a real entry price and live current price/P&L, and that the wallet-balance card either doesn't render or shows $0 (since no wallet crediting happens in this mode) — check `activity-screen.tsx`'s current unconditional wallet-balance-card render and confirm this doesn't look broken/confusing when `walletCents` stays 0 in polymarket mode; if it reads oddly, that's a legitimate finding for this task to flag (not silently patch) since the spec didn't explicitly resolve whether the wallet card should hide itself in polymarket-only sessions.

- [ ] **Step 3: Mixed-mode session (spec's explicit edge case)**

Using a single session: start in `wallet` mode, sync + facilitate once (get a wallet-mode ledger entry), then switch the server to `polymarket` mode (restart), sync + facilitate again (get a position). Confirm `GET /api/roundup-demo/state` returns both non-zero `walletCents` AND a non-empty `positions` array simultaneously, and that the Activity screen renders both the wallet card and the position card without error — this is the spec's explicitly-called-out "session history can span both modes" requirement.

- [ ] **Step 4: Confirm no business-account Polymarket code was touched**

```bash
git diff <base-commit> --stat | grep -iE "clob|placeMarketOrder|writeClient|business"
```

Expected: no output — this milestone must not modify anything in `apps/platform/src/lib/autotrade/polymarket.ts`'s write/trading surface, per the Global Constraints.

- [ ] **Step 5: Run the full packages/core suite one more time**

Run: `cd packages/core && npm test`
Expected: PASS, all tests including the new position math.

- [ ] **Step 6: Final commit (only if fixups were needed)**

```bash
git add -A
git commit -m "fix(roundup): address end-to-end verification findings for Polymarket facilitation mode"
```

(Skip this step if verification passed clean with no fixes needed.)
