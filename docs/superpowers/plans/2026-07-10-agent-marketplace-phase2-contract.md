# Agent Marketplace Phase 2 (Contract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the agent web shell's mock data layer with real user-scoped API routes + Supabase tables — live subscribe/equip, editable My Model config, paper wallet with Stripe test-mode rails, and user agent create/submit — without touching the visual components.

**Architecture:** New Supabase tables (`agent_models`, `user_agent_state`, `agent_model_subs`, `agent_configs`, `agent_decisions`, `wallet_ledger`) hold catalog + per-user state; every `/api/agent/*` route follows the house pattern (`getAuthClient()` auth → `getServerClient()` service-role data access). The client keeps the Phase-1 reducer for optimistic updates: in live mode (`AGENT_API_LIVE=1`) the layout builds the initial `AgentUIState` server-side and the provider's `dispatch` wrapper fires the matching API call after each optimistic action, reconciling via a new `sync` action polled from `GET /api/agent/state` every 5s. Components keep calling the exact same `dispatch` — the swap happens inside `store.tsx`, honoring the Phase-1 promise.

**Tech Stack:** Next 16 App Router route handlers (`runtime='nodejs'`, `dynamic='force-dynamic'`), Supabase (`@supabase/ssr` cookie auth + service-role writes), Stripe SDK v22 (hosted Checkout for model subs, PaymentIntent + Payment Element for deposits, both optional-at-runtime), vitest for pure logic.

**Spec:** `docs/superpowers/specs/2026-07-06-agent-experience-design.md` (Phase 2 + scope decision of 2026-07-07)

## Global Constraints

- Never use "scrape"/"scraper" in user-facing copy — say "live prices", "live data".
- All money is integer cents (`bigint` in SQL); `font-variant-numeric: tabular-nums` already applied by `ag-num`.
- `PAPER` badge is server-driven in live mode: `GET /api/agent/state` returns `paper: true`.
- Creator payouts (Stripe Connect) are OUT of scope (confirmed 2026-07-07). `POST /api/agent/models` + `/submit` are IN scope.
- Auth: `getAuthClient()` + `sb.auth.getUser()`, 401 `{ error: 'unauthenticated' }`. Data access: `getServerClient()` scoped by `.eq('user_id', user.id)`. Errors: `Response.json({ error: '<snake_code>', message? }, { status })`; 400 invalid input, 404 not found, 500 `server_error`.
- Stripe is OPTIONAL at runtime (all 13 Stripe env vars are empty in prod today): every Stripe-touching path must presence-gate on `process.env.STRIPE_SECRET_KEY` and fall back to a working paper-mode path. Log entry + success for every external call (Stripe), not just errors.
- Next 16 gotchas: middleware is `src/proxy.ts` (do not create `middleware.ts`); mutating `/api/*` calls pass a CSRF Origin check — fine for same-origin fetches; the Stripe webhook is already CSRF-exempt.
- The existing mock mode must keep working unchanged when `AGENT_API_LIVE` is unset (`AGENT_PREVIEW=1 pnpm platform` demo path).
- Migration numbering: next free number is **048** (note: 027 is duplicated historically — never reuse a number). Migrations are applied BY HAND via the Supabase dashboard SQL editor BEFORE or in the same deploy window as the code that references them (referral-launch outage precedent).
- Commit after every task; prefix `feat(agent-api):` (server) / `feat(agent-web):` (client). Run all commands from repo root `~/sneakers-trading`.
- Out of scope (separate follow-up plan): accessibility batch (carousel keyboard, sheet focus-trap) and remaining CSS class prefixing — pure-UI carry-ins, independent of the contract.

---

### Task 1: Migration 048 — agent marketplace tables + catalog seed

**Files:**
- Create: `apps/platform/supabase/migrations/048_agent_marketplace.sql`

**Interfaces:**
- Produces: tables `agent_models`, `user_agent_state`, `agent_model_subs`, `agent_configs`, `agent_decisions`, `wallet_ledger`; SQL function `agent_wallet_apply(p_user_id uuid, p_kind text, p_label text, p_detail text, p_amount_cents bigint, p_stripe_ref text) returns bigint` (atomic ledger insert + balance update, idempotent on `stripe_ref`). Catalog seeded with the 7 first-party/partner models using the exact Phase-1 ids (`updown`, `oddsjam`, `gambly`, `wave`, `drift`, `sniper`, `news`).

- [ ] **Step 1: Write the migration**

```sql
-- 048_agent_marketplace.sql
-- Agent experience Phase 2 (contract): marketplace catalog, per-user agent
-- state/config, decision feed, model subscriptions, paper wallet ledger.
-- Spec: docs/superpowers/specs/2026-07-06-agent-experience-design.md
--
-- APPLY BY HAND (Supabase dashboard SQL editor) BEFORE deploying the code
-- that references these tables — same-deploy-window rule.

-- ── Catalog ────────────────────────────────────────────────────────────
create table if not exists agent_models (
  id                text primary key,
  name              text not null,
  emoji             text,
  brand             text,                     -- 'oddsjam' | 'gambly' | null (logo orbs)
  color             text not null,
  author            text not null,            -- display "by …"
  perf_30d          numeric,                  -- null = no metrics shown
  runners           int not null default 1,
  price_cents       int,                      -- null = free
  price_label       text,                     -- overrides "$X/mo" display
  tagline           text,
  description       text not null,
  status            text not null default 'private',
  featured          boolean not null default false,
  included          boolean not null default false,
  kind              text not null default 'prompt',
  owner_user_id     uuid references auth.users (id) on delete cascade, -- null = first-party
  prompt            text,                     -- prompt-kind user agents
  endpoint_url      text,                     -- connected-kind user agents
  api_key_encrypted text,                     -- encryptSecret() output, service-role read only
  sort_order        int not null default 100,
  created_at        timestamptz not null default now(),
  constraint agent_models_status_chk
    check (status in ('live', 'review', 'coming_soon', 'private')),
  constraint agent_models_kind_chk
    check (kind in ('prompt', 'connected')),
  constraint agent_models_brand_chk
    check (brand is null or brand in ('oddsjam', 'gambly'))
);
create index if not exists agent_models_owner_idx
  on agent_models (owner_user_id) where owner_user_id is not null;

-- ── Per-user agent state ───────────────────────────────────────────────
create table if not exists user_agent_state (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  equipped_model_id text not null default 'updown',  -- no FK: 'my-model' is virtual
  paused            boolean not null default false,
  sim_balance_cents bigint not null default 124762,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── My Model config (worker re-reads each window in Phase 3) ───────────
create table if not exists agent_configs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Longshot v3',
  emoji      text not null default '🐎',
  color      text not null default 'green',
  prompt     text not null default 'Trade 5 and 15-minute crypto markets only. Favor longshots priced 10–35¢ with momentum confirmation. Max 5% of bankroll per trade. Skip anything with a spread over 4¢.',
  preset     text not null default 'longshot',
  updated_at timestamptz not null default now(),
  constraint agent_configs_preset_chk
    check (preset in ('longshot', 'momentum', 'fade', 'conservative'))
);

-- ── Model subscriptions ────────────────────────────────────────────────
create table if not exists agent_model_subs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  model_id               text not null references agent_models (id) on delete cascade,
  stripe_subscription_id text,                -- null = free or paper-mode sub
  status                 text not null default 'active',
  created_at             timestamptz not null default now(),
  unique (user_id, model_id),
  constraint agent_model_subs_status_chk
    check (status in ('active', 'pending', 'canceled'))
);
create index if not exists agent_model_subs_user_idx on agent_model_subs (user_id);

-- ── Decision feed (worker writes in Phase 3; fixtures until then) ──────
create table if not exists agent_decisions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  model_id   text not null,
  venue      text not null,
  action     text not null,
  title      text not null,
  detail     text not null,
  pnl_cents  bigint,
  created_at timestamptz not null default now(),
  constraint agent_decisions_venue_chk
    check (venue in ('kalshi', 'polymarket', 'prophetx')),
  constraint agent_decisions_action_chk
    check (action in ('settled', 'entered', 'passed'))
);
create index if not exists agent_decisions_user_ts_idx
  on agent_decisions (user_id, created_at desc);

-- ── Paper wallet ledger ────────────────────────────────────────────────
create table if not exists wallet_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null,
  label        text not null,
  detail       text not null default '',
  amount_cents bigint not null,
  stripe_ref   text,                          -- PaymentIntent id; idempotency key
  created_at   timestamptz not null default now(),
  constraint wallet_ledger_kind_chk
    check (kind in ('deposit', 'withdraw', 'settlement', 'starting'))
);
create unique index if not exists wallet_ledger_stripe_ref_uq
  on wallet_ledger (stripe_ref) where stripe_ref is not null;
create index if not exists wallet_ledger_user_ts_idx
  on wallet_ledger (user_id, created_at desc);

-- ── Atomic wallet apply (insert ledger row + bump balance) ─────────────
-- Idempotent on p_stripe_ref: replayed webhooks insert nothing and the
-- balance is bumped exactly once. Returns the (possibly unchanged) balance.
create or replace function agent_wallet_apply(
  p_user_id      uuid,
  p_kind         text,
  p_label        text,
  p_detail       text,
  p_amount_cents bigint,
  p_stripe_ref   text
) returns bigint
language plpgsql
as $$
declare
  v_inserted int;
  v_balance  bigint;
begin
  insert into wallet_ledger (user_id, kind, label, detail, amount_cents, stripe_ref)
  values (p_user_id, p_kind, p_label, p_detail, p_amount_cents, p_stripe_ref)
  on conflict (stripe_ref) where stripe_ref is not null do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update user_agent_state
       set sim_balance_cents = sim_balance_cents + p_amount_cents,
           updated_at = now()
     where user_id = p_user_id
    returning sim_balance_cents into v_balance;
  else
    select sim_balance_cents into v_balance
      from user_agent_state where user_id = p_user_id;
  end if;

  return coalesce(v_balance, 0);
end;
$$;

-- ── RLS: users read own rows; ALL writes via service role only ─────────
alter table agent_models enable row level security;
drop policy if exists "read catalog and own agents" on agent_models;
create policy "read catalog and own agents" on agent_models
  for select using (owner_user_id is null or owner_user_id = auth.uid());

alter table user_agent_state enable row level security;
drop policy if exists "users read own agent state" on user_agent_state;
create policy "users read own agent state" on user_agent_state
  for select using (auth.uid() = user_id);

alter table agent_configs enable row level security;
drop policy if exists "users read own agent config" on agent_configs;
create policy "users read own agent config" on agent_configs
  for select using (auth.uid() = user_id);

alter table agent_model_subs enable row level security;
drop policy if exists "users read own model subs" on agent_model_subs;
create policy "users read own model subs" on agent_model_subs
  for select using (auth.uid() = user_id);

alter table agent_decisions enable row level security;
drop policy if exists "users read own decisions" on agent_decisions;
create policy "users read own decisions" on agent_decisions
  for select using (auth.uid() = user_id);

alter table wallet_ledger enable row level security;
drop policy if exists "users read own wallet ledger" on wallet_ledger;
create policy "users read own wallet ledger" on wallet_ledger
  for select using (auth.uid() = user_id);
-- No insert/update/delete policies anywhere — writes happen exclusively
-- through API routes running with the service role.

-- ── Seed the first-party / partner catalog (Phase-1 ids preserved) ─────
insert into agent_models
  (id, name, emoji, brand, color, author, perf_30d, runners, price_cents,
   price_label, tagline, description, status, featured, included, kind, sort_order)
values
  ('updown', 'Up/Down', '🎢', null, 'updown', 'Sneakers Labs', 14.6, 2481, null,
   null, null,
   'The flagship. Trades every BTC and crypto up/down market on Kalshi and Polymarket in 5 and 15-minute windows. Included with your plan.',
   'live', false, true, 'prompt', 10),
  ('oddsjam', 'OddsJam', null, 'oddsjam', 'oddsjam', 'OddsJam', null, 1204, 1999,
   'From $1 per day', 'The best sports/predictions agent',
   'OddsJam''s edge-finding engine wired into your agent. Positive-EV entries across sports and prediction markets.',
   'live', true, false, 'connected', 20),
  ('gambly', 'Gambly', null, 'gambly', 'gambly', 'Gambly.com', null, 866, 1499,
   null, 'Community-tuned casino & props agent',
   'Gambly''s community-tuned model for props and quick-settle markets.',
   'live', true, false, 'connected', 30),
  ('wave', 'Wave Rider', '🏄', null, 'blue', 'Sneakers Labs', 18.2, 912, 999,
   null, null,
   'Rides short momentum bursts. Enters on book imbalance, exits into strength.',
   'live', false, false, 'prompt', 40),
  ('drift', 'Overnight Drift', '🦉', null, 'purple', 'Sneakers Labs', 11.7, 540, 499,
   null, null,
   'Positions into the overnight drift on longer windows. Low churn.',
   'live', false, false, 'prompt', 50),
  ('sniper', 'Cent Sniper', '🎯', null, 'gold', '@quantfrat', 8.9, 233, 299,
   null, null,
   'Picks off mispriced cents near settle. High frequency, small size.',
   'live', false, false, 'prompt', 60),
  ('news', 'News Reactor', '🗞️', null, 'red', 'community', null, 1, null,
   null, null,
   'Reacts to headline momentum. Currently in marketplace review.',
   'review', false, false, 'prompt', 70)
on conflict (id) do nothing;

comment on table agent_models is 'Agent marketplace catalog + user-created agents (owner_user_id set).';
comment on table user_agent_state is 'Per-user agent runtime state: equipped model, paused, paper balance.';
comment on table agent_configs is 'My Model prompt/preset — the worker re-reads this each window (Phase 3).';
comment on table agent_model_subs is 'Model subscriptions. stripe_subscription_id null = free or paper-mode.';
comment on table agent_decisions is 'Agent decision feed. Fixtures until the worker goes live (Phase 3).';
comment on table wallet_ledger is 'Paper wallet ledger. stripe_ref = PaymentIntent id for idempotency.';
```

Note the seed descriptions for `wave`/`drift`/`sniper`/`news`/`updown`/`oddsjam`/`gambly`: Phase 1's `catalog.ts` holds the canonical `description`/`tagline` strings — copy them verbatim from `apps/platform/src/app/agent/lib/catalog.ts` into the seed if they differ from the above (the catalog file is the source of truth for copy; the values above are correct as of 2026-07-10 for ids/prices/flags, but re-check description text at implementation time).

Note on `color` for logo orbs: Phase 1 uses `color: 'updown' | 'oddsjam' | 'gambly'` as OrbColor values for branded orbs — the seed stores the same strings so `rowToModel` (Task 2) is a straight copy.

- [ ] **Step 2: Sanity-check the SQL locally**

Run: `psql --no-psqlrc --set ON_ERROR_STOP=1 -c '\i /dev/null' 2>/dev/null; node -e "const fs=require('fs');const s=fs.readFileSync('apps/platform/supabase/migrations/048_agent_marketplace.sql','utf8');console.log('parens ok:', (s.match(/\(/g)||[]).length === (s.match(/\)/g)||[]).length, '| stmts:', (s.match(/;\s*$/gm)||[]).length)"`

Expected: `parens ok: true` and a statement count > 20. (No local Postgres is assumed; the real gate is hand-applying to Supabase — see Task 11 deploy checklist.)

- [ ] **Step 3: Commit**

```bash
git add apps/platform/supabase/migrations/048_agent_marketplace.sql
git commit -m "feat(agent-api): migration 048 — marketplace tables, paper wallet, catalog seed"
```

---

### Task 2: Pure wire layer + formatter carry-ins (TDD)

**Files:**
- Create: `apps/platform/src/lib/agent/wire.ts`
- Test: `apps/platform/src/lib/agent/wire.test.ts`
- Modify: `apps/platform/src/app/agent/lib/format.ts`
- Modify: `apps/platform/src/app/agent/lib/format.test.ts`

**Interfaces:**
- Consumes: `AgentModel`, `Decision`, `LedgerEntry`, `AgentPhase`, `OrbColor`, `CreateAgentInput` from `apps/platform/src/app/agent/lib/types.ts`.
- Produces (used by Tasks 4–8):
  - `interface AgentModelRow` (snake_case DB row) and `rowToModel(row: AgentModelRow, userId: string | null): AgentModel`
  - `myModelEntry(cfg: { name: string; emoji: string; color: string }): AgentModel` — virtual id `'my-model'`
  - `phaseAt(nowMs: number, paused: boolean): { phase: AgentPhase | 'paused'; title: string; sub: string }`
  - `sparkFromLedger(entries: { amountCents: number; at: string }[]): number[]`
  - `decisionRowToWire(row)` / `ledgerRowToWire(row)` mappers
  - `validateCreateAgent(body: unknown): { value: CreateAgentInput; error: null } | { value: null; error: { field: string; message: string } }`
  - `validateConfigPut(body: unknown): { value: Partial<{ name: string; emoji: string; color: OrbColor; prompt: string; preset: string }>; error: null } | { value: null; error: { field: string; message: string } }`
  - `SEED_DECISIONS_LIVE`, `SEED_LEDGER_LIVE` bootstrap fixture constants
  - `PRESETS = ['longshot', 'momentum', 'fade', 'conservative'] as const`

- [ ] **Step 1: Write the failing tests**

Create `apps/platform/src/lib/agent/wire.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  decisionRowToWire, myModelEntry, phaseAt, rowToModel, sparkFromLedger,
  validateConfigPut, validateCreateAgent,
} from './wire'

const updownRow = {
  id: 'updown', name: 'Up/Down', emoji: '🎢', brand: null, color: 'updown',
  author: 'Sneakers Labs', perf_30d: 14.6, runners: 2481, price_cents: null,
  price_label: null, tagline: null, description: 'The flagship.',
  status: 'live', featured: false, included: true, kind: 'prompt',
  owner_user_id: null, sort_order: 10,
} as const

describe('rowToModel', () => {
  it('maps snake_case row to the Phase-1 AgentModel shape', () => {
    const m = rowToModel({ ...updownRow }, 'user-1')
    expect(m).toMatchObject({
      id: 'updown', name: 'Up/Down', emoji: '🎢', color: 'updown',
      by: 'Sneakers Labs', perf30d: 14.6, runners: 2481, priceCents: null,
      status: 'live', included: true, kind: 'prompt',
    })
    expect(m.mine).toBeUndefined()
  })
  it('marks user-owned rows mine and hides numeric perf noise', () => {
    const m = rowToModel({ ...updownRow, id: 'custom-ab12', owner_user_id: 'user-1', status: 'private', perf_30d: null }, 'user-1')
    expect(m.mine).toBe(true)
    expect(m.by).toBe('you')
  })
})

describe('myModelEntry', () => {
  it('builds the virtual my-model orb from config', () => {
    const m = myModelEntry({ name: 'Longshot v3', emoji: '🐎', color: 'green' })
    expect(m).toMatchObject({ id: 'my-model', mine: true, status: 'private', kind: 'prompt', by: 'you', perf30d: null })
  })
})

describe('phaseAt', () => {
  it('is paused when paused', () => {
    expect(phaseAt(0, true).phase).toBe('paused')
  })
  it('cycles the 4 phase slots every 4.5s deterministically', () => {
    expect(phaseAt(0, false).phase).toBe('scanning')
    expect(phaseAt(4500, false).phase).toBe('entering')
    expect(phaseAt(9000, false).phase).toBe('holding')
    expect(phaseAt(18000, false)).toEqual(phaseAt(0, false))
  })
})

describe('sparkFromLedger', () => {
  it('returns the running balance series in chronological order', () => {
    const entries = [
      { amountCents: 3814, at: '2026-07-10' },
      { amountCents: 50000, at: '2026-07-03' },
      { amountCents: -1248, at: '2026-07-02' },
      { amountCents: 72196, at: '2026-06-30' },
    ]
    expect(sparkFromLedger(entries)).toEqual([72196, 70948, 120948, 124762])
  })
  it('pads a single point so the sparkline can draw a line', () => {
    expect(sparkFromLedger([{ amountCents: 100000, at: '2026-07-10' }])).toEqual([100000, 100000])
  })
})

describe('validateCreateAgent', () => {
  it('accepts a prompt agent', () => {
    const r = validateCreateAgent({ name: 'Fade Bot', emoji: '🧊', color: 'cyan', kind: 'prompt', prompt: 'Fade spikes.' })
    expect(r.error).toBeNull()
    expect(r.value?.kind).toBe('prompt')
  })
  it('requires https endpoint + apiKey for connected agents', () => {
    const r = validateCreateAgent({ name: 'X', emoji: '🤖', color: 'blue', kind: 'connected', endpointUrl: 'http://x.dev', apiKey: 'k'.repeat(20) })
    expect(r.error?.field).toBe('endpointUrl')
  })
  it('rejects unknown colors and over-long names', () => {
    expect(validateCreateAgent({ name: 'X', emoji: '🤖', color: 'magenta', kind: 'prompt' }).error?.field).toBe('color')
    expect(validateCreateAgent({ name: 'x'.repeat(41), emoji: '🤖', color: 'blue', kind: 'prompt' }).error?.field).toBe('name')
  })
})

describe('validateConfigPut', () => {
  it('accepts partial updates', () => {
    const r = validateConfigPut({ prompt: 'Only BTC.', preset: 'momentum' })
    expect(r.error).toBeNull()
    expect(r.value).toEqual({ prompt: 'Only BTC.', preset: 'momentum' })
  })
  it('rejects unknown presets and over-long prompts', () => {
    expect(validateConfigPut({ preset: 'yolo' }).error?.field).toBe('preset')
    expect(validateConfigPut({ prompt: 'x'.repeat(2001) }).error?.field).toBe('prompt')
  })
})
```

Add to `apps/platform/src/app/agent/lib/format.test.ts` (formatter carry-ins):

```ts
it('formatMoney and formatMoneyWhole handle negatives with U+2212', () => {
  expect(formatMoney(-1248)).toBe('−$12.48')
  expect(formatMoneyWhole(-124762)).toBe('−$1,248')
})

it('formatPerf uses U+2212 for negative perf', () => {
  expect(formatPerf(-3.2)).toBe('−3.2%')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sneakers/platform test`
Expected: FAIL — `wire.ts` does not exist; format negative tests fail (`$-12.48` style output / ASCII `-`).

- [ ] **Step 3: Implement `format.ts` fixes**

Replace `apps/platform/src/app/agent/lib/format.ts` body:

```ts
const MINUS = '−'

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? MINUS : ''
  return sign + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMoneyWhole(cents: number): string {
  const sign = cents < 0 ? MINUS : ''
  return sign + '$' + Math.round(Math.abs(cents) / 100).toLocaleString('en-US')
}

export function formatSigned(cents: number): string {
  const sign = cents < 0 ? MINUS : '+'
  return sign + formatMoney(Math.abs(cents)).replace(MINUS, '')
}

export function formatPerf(perf30d: number | null): string {
  if (perf30d === null) return '—'
  return (perf30d >= 0 ? '+' : MINUS) + Math.abs(perf30d) + '%'
}
```

- [ ] **Step 4: Implement `src/lib/agent/wire.ts`**

```ts
// Pure mapping + validation layer between the agent DB rows and the wire
// shapes the Phase-1 UI already consumes. No I/O in this module.
import type {
  AgentModel, AgentPhase, CreateAgentInput, Decision, LedgerEntry, OrbColor, Venue,
} from '@/app/agent/lib/types'

export const PRESETS = ['longshot', 'momentum', 'fade', 'conservative'] as const
const COLORS: OrbColor[] = ['green', 'blue', 'purple', 'gold', 'red', 'cyan', 'updown', 'oddsjam', 'gambly']
const USER_COLORS: OrbColor[] = ['green', 'blue', 'purple', 'gold', 'red', 'cyan']

export interface AgentModelRow {
  id: string
  name: string
  emoji: string | null
  brand: 'oddsjam' | 'gambly' | null
  color: string
  author: string
  perf_30d: number | string | null
  runners: number
  price_cents: number | null
  price_label: string | null
  tagline: string | null
  description: string
  status: 'live' | 'review' | 'coming_soon' | 'private'
  featured: boolean
  included: boolean
  kind: 'prompt' | 'connected'
  owner_user_id: string | null
  sort_order: number
}

export function rowToModel(row: AgentModelRow, userId: string | null): AgentModel {
  const mine = row.owner_user_id !== null && row.owner_user_id === userId
  return {
    id: row.id,
    name: row.name,
    color: (COLORS.includes(row.color as OrbColor) ? row.color : 'green') as OrbColor,
    ...(row.emoji ? { emoji: row.emoji } : {}),
    ...(row.brand ? { brand: row.brand } : {}),
    by: mine ? 'you' : row.author,
    perf30d: row.perf_30d === null ? null : Number(row.perf_30d),
    runners: row.runners,
    priceCents: row.price_cents,
    ...(row.price_label ? { priceLabel: row.price_label } : {}),
    ...(row.tagline ? { tagline: row.tagline } : {}),
    description: row.description,
    ...(row.featured ? { featured: true } : {}),
    ...(row.included ? { included: true } : {}),
    ...(mine ? { mine: true } : {}),
    status: row.status,
    kind: row.kind,
  }
}

export function myModelEntry(cfg: { name: string; emoji: string; color: string }): AgentModel {
  return {
    id: 'my-model',
    name: cfg.name,
    color: (COLORS.includes(cfg.color as OrbColor) ? cfg.color : 'green') as OrbColor,
    emoji: cfg.emoji,
    by: 'you',
    perf30d: null,
    runners: 1,
    priceCents: null,
    mine: true,
    status: 'private',
    kind: 'prompt',
    description: 'Your model. Edit its strategy prompt in Models → My Model — it re-reads the prompt before every window.',
  }
}

// Deterministic synthesized status until the worker goes live (Phase 3).
// Same copy + cadence (4.5s) as the Phase-1 mock so web and iOS agree.
const PHASES: { phase: AgentPhase; title: string; sub: string }[] = [
  { phase: 'scanning', title: 'Scanning 14 markets', sub: 'BTC · ETH · SOL — 5 & 15-min windows on Kalshi + Polymarket' },
  { phase: 'entering', title: 'Entering position', sub: 'ETH above $3,410 at 2:30p · buying Yes at 27¢' },
  { phase: 'holding', title: 'Holding 2 positions', sub: 'Next settle in 4m 12s' },
  { phase: 'scanning', title: 'Scanning 14 markets', sub: 'Last window: +$21.60 · 12 trades today' },
]

export function phaseAt(nowMs: number, paused: boolean): { phase: AgentPhase | 'paused'; title: string; sub: string } {
  if (paused) return { phase: 'paused', title: 'Paused', sub: 'The agent will not enter new positions.' }
  return PHASES[Math.floor(nowMs / 4500) % PHASES.length]
}

/** Running-balance series from ledger entries (any order; sorted by `at` asc). */
export function sparkFromLedger(entries: { amountCents: number; at: string }[]): number[] {
  const asc = [...entries].sort((a, b) => a.at.localeCompare(b.at))
  const out: number[] = []
  let run = 0
  for (const e of asc) {
    run += e.amountCents
    out.push(run)
  }
  if (out.length === 1) out.push(out[0])
  return out
}

export function decisionRowToWire(row: {
  id: string; venue: string; action: string; title: string; detail: string
  pnl_cents: number | string | null; created_at: string
}): Decision {
  return {
    id: row.id,
    venue: row.venue as Venue,
    action: row.action as Decision['action'],
    title: row.title,
    detail: row.detail,
    pnlCents: row.pnl_cents === null ? null : Number(row.pnl_cents),
    at: row.created_at,
  }
}

export function ledgerRowToWire(row: {
  id: string; kind: string; label: string; detail: string
  amount_cents: number | string; created_at: string
}): LedgerEntry {
  return {
    id: row.id,
    kind: row.kind as LedgerEntry['kind'],
    label: row.label,
    detail: row.detail,
    amountCents: Number(row.amount_cents),
    at: row.created_at,
  }
}

type FieldError = { field: string; message: string }

export function validateCreateAgent(body: unknown):
  { value: CreateAgentInput; error: null } | { value: null; error: FieldError } {
  const b = (body ?? {}) as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const emoji = typeof b.emoji === 'string' ? b.emoji.trim() : ''
  const color = typeof b.color === 'string' ? b.color : ''
  const kind = b.kind === 'connected' ? 'connected' : b.kind === 'prompt' ? 'prompt' : null

  if (name.length > 40) return { value: null, error: { field: 'name', message: 'Name must be 40 characters or fewer.' } }
  if (!emoji || emoji.length > 8) return { value: null, error: { field: 'emoji', message: 'Pick an emoji.' } }
  if (!USER_COLORS.includes(color as OrbColor)) return { value: null, error: { field: 'color', message: 'Pick a color.' } }
  if (!kind) return { value: null, error: { field: 'kind', message: 'kind must be prompt or connected.' } }

  if (kind === 'connected') {
    const endpointUrl = typeof b.endpointUrl === 'string' ? b.endpointUrl.trim() : ''
    const apiKey = typeof b.apiKey === 'string' ? b.apiKey.trim() : ''
    if (!endpointUrl.startsWith('https://') || endpointUrl.length > 300) {
      return { value: null, error: { field: 'endpointUrl', message: 'Endpoint must be an https:// URL.' } }
    }
    if (apiKey.length < 8 || apiKey.length > 200) {
      return { value: null, error: { field: 'apiKey', message: 'API key looks wrong (8–200 characters).' } }
    }
    return { value: { name, emoji, color: color as OrbColor, kind, endpointUrl, apiKey }, error: null }
  }

  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : ''
  if (prompt.length > 2000) return { value: null, error: { field: 'prompt', message: 'Prompt must be 2000 characters or fewer.' } }
  return { value: { name, emoji, color: color as OrbColor, kind, ...(prompt ? { prompt } : {}) }, error: null }
}

export function validateConfigPut(body: unknown):
  { value: Partial<{ name: string; emoji: string; color: OrbColor; prompt: string; preset: string }>; error: null }
  | { value: null; error: FieldError } {
  const b = (body ?? {}) as Record<string, unknown>
  const out: Partial<{ name: string; emoji: string; color: OrbColor; prompt: string; preset: string }> = {}
  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 40) {
      return { value: null, error: { field: 'name', message: 'Name must be 1–40 characters.' } }
    }
    out.name = b.name.trim()
  }
  if (b.emoji !== undefined) {
    if (typeof b.emoji !== 'string' || !b.emoji.trim() || b.emoji.trim().length > 8) {
      return { value: null, error: { field: 'emoji', message: 'Pick an emoji.' } }
    }
    out.emoji = b.emoji.trim()
  }
  if (b.color !== undefined) {
    if (typeof b.color !== 'string' || !USER_COLORS.includes(b.color as OrbColor)) {
      return { value: null, error: { field: 'color', message: 'Pick a color.' } }
    }
    out.color = b.color as OrbColor
  }
  if (b.prompt !== undefined) {
    if (typeof b.prompt !== 'string' || b.prompt.length > 2000) {
      return { value: null, error: { field: 'prompt', message: 'Prompt must be 2000 characters or fewer.' } }
    }
    out.prompt = b.prompt
  }
  if (b.preset !== undefined) {
    if (typeof b.preset !== 'string' || !(PRESETS as readonly string[]).includes(b.preset)) {
      return { value: null, error: { field: 'preset', message: 'Unknown preset.' } }
    }
    out.preset = b.preset
  }
  return { value: out, error: null }
}

// ── Bootstrap fixtures (until the worker writes real rows in Phase 3) ──
// Amounts mirror the Phase-1 mock: ledger sums to the 124762 default
// balance; decision P&L sums to 3580 for day-one Today P&L.
export const SEED_DECISIONS_LIVE = [
  { venue: 'kalshi', action: 'settled', title: 'Settled: BTC above $109,250 at 2:15p — Yes hit', detail: 'Kalshi · +$21.60', pnl_cents: 2160, minutes_ago: 5 },
  { venue: 'polymarket', action: 'entered', title: 'Entered ETH above $3,410 at 2:30p · 27¢ × 80', detail: 'Polymarket · momentum + book imbalance', pnl_cents: null, minutes_ago: 9 },
  { venue: 'prophetx', action: 'settled', title: 'Settled: Thunder −4.5 vs Pacers — covered', detail: 'ProphetX · +$14.20', pnl_cents: 1420, minutes_ago: 27 },
  { venue: 'kalshi', action: 'passed', title: 'Passed on SOL range 2:15p — spread too wide', detail: 'Kalshi · gate: liquidity floor', pnl_cents: null, minutes_ago: 12 },
] as const

export const SEED_LEDGER_LIVE = [
  { kind: 'starting', label: 'Starting balance', detail: 'Paper account opened', amount_cents: 72196, days_ago: 10 },
  { kind: 'settlement', label: 'Trade settlements (31)', detail: 'Paper trading', amount_cents: -1248, days_ago: 8 },
  { kind: 'deposit', label: 'Added cash', detail: 'Visa ··4242 (test)', amount_cents: 50000, days_ago: 7 },
  { kind: 'settlement', label: 'Trade settlements (12)', detail: 'Paper trading', amount_cents: 3814, days_ago: 0 },
] as const
```

Note: check that `@/` maps to `src/` in `apps/platform/tsconfig.json` (it does for `@/lib/*` imports used across the app); the import `@/app/agent/lib/types` must resolve — if the alias is only `@/lib/*`, use a relative import `../../app/agent/lib/types` instead.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sneakers/platform test`
Expected: PASS (wire tests + format tests; pre-existing engine/catalog tests still green — `formatSigned('−'...)` behavior is unchanged for the values the old tests assert).

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/lib/agent/wire.ts apps/platform/src/lib/agent/wire.test.ts apps/platform/src/app/agent/lib/format.ts apps/platform/src/app/agent/lib/format.test.ts
git commit -m "feat(agent-api): pure wire layer (row mappers, phase synth, validators) + negative-money formatting"
```

---

### Task 3: Engine additions for live mode (TDD)

**Files:**
- Modify: `apps/platform/src/app/agent/lib/engine.ts`
- Test: `apps/platform/src/app/agent/lib/engine.test.ts`

**Interfaces:**
- Consumes: existing `AgentUIState`, `AgentAction`, `agentReducer`.
- Produces (used by Task 9's live store):
  - `AgentUIState` gains `serverPnlCents: number | null` (null in mock mode) — `initialState()` sets it to `null`.
  - New actions:
    - `{ type: 'sync'; patch: Partial<Pick<AgentUIState, 'models' | 'equippedId' | 'subscribedIds' | 'paused' | 'balanceCents' | 'decisions' | 'ledger' | 'spark' | 'serverPnlCents'>> }` — shallow-merge server truth.
    - `{ type: 'modelCreated'; model: AgentModel }` — replaces the optimistic `createAgent` result: if a model with the same id exists, replace it; else append.
    - `{ type: 'updateConfig'; patch: { name?: string; emoji?: string; color?: OrbColor; prompt?: string; preset?: string } }` — updates the `mine` model entry's name/emoji/color in `models` (prompt/preset have no mock-visual effect; stored nowhere client-side beyond the My Model editor's own state).

- [ ] **Step 1: Write the failing tests** (append to `engine.test.ts`)

```ts
describe('live-mode actions', () => {
  it('sync shallow-merges server truth', () => {
    const s0 = initialState()
    const s1 = agentReducer(s0, { type: 'sync', patch: { paused: true, balanceCents: 99, serverPnlCents: -500 } })
    expect(s1.paused).toBe(true)
    expect(s1.balanceCents).toBe(99)
    expect(s1.serverPnlCents).toBe(-500)
    expect(s1.models).toBe(s0.models) // untouched keys preserved by reference
  })

  it('modelCreated replaces an optimistic model with the same id, else appends', () => {
    const s0 = initialState()
    const optimistic = agentReducer(s0, { type: 'createAgent', input: { name: 'Fade', emoji: '🧊', color: 'cyan', kind: 'prompt' } })
    const serverModel = { ...optimistic.models.at(-1)!, id: optimistic.models.at(-1)!.id, description: 'server copy' }
    const s1 = agentReducer(optimistic, { type: 'modelCreated', model: serverModel })
    expect(s1.models.filter(m => m.id === serverModel.id)).toHaveLength(1)
    expect(s1.models.find(m => m.id === serverModel.id)!.description).toBe('server copy')
  })

  it('updateConfig renames the mine model in place', () => {
    const s0 = initialState()
    const s1 = agentReducer(s0, { type: 'updateConfig', patch: { name: 'Longshot v4', emoji: '🏇' } })
    const mine = s1.models.find(m => m.mine)!
    expect(mine.name).toBe('Longshot v4')
    expect(mine.emoji).toBe('🏇')
  })

  it('initialState has serverPnlCents null (mock mode)', () => {
    expect(initialState().serverPnlCents).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sneakers/platform test`
Expected: FAIL — unknown action types / missing `serverPnlCents`.

- [ ] **Step 3: Implement**

In `engine.ts`: add `serverPnlCents: number | null` to `AgentUIState`; add `serverPnlCents: null,` inside `initialState()`; extend `AgentAction` with the three new variants (typed exactly as in Interfaces above, importing `OrbColor` into the existing type import); add reducer cases:

```ts
    case 'sync':
      return { ...s, ...a.patch }
    case 'modelCreated': {
      const i = s.models.findIndex(m => m.id === a.model.id)
      if (i === -1) return { ...s, models: [...s.models, a.model] }
      const models = [...s.models]
      models[i] = a.model
      return { ...s, models }
    }
    case 'updateConfig': {
      const models = s.models.map(m =>
        m.mine
          ? {
              ...m,
              ...(a.patch.name ? { name: a.patch.name } : {}),
              ...(a.patch.emoji ? { emoji: a.patch.emoji } : {}),
              ...(a.patch.color ? { color: a.patch.color } : {}),
            }
          : m,
      )
      return { ...s, models }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sneakers/platform test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/agent/lib/engine.ts apps/platform/src/app/agent/lib/engine.test.ts
git commit -m "feat(agent-web): engine sync/modelCreated/updateConfig actions for live mode"
```

---

### Task 4: Server service layer (bootstrap + loaders)

**Files:**
- Create: `apps/platform/src/lib/agent/service.ts`

**Interfaces:**
- Consumes: Task 2's `wire.ts`; `getServerClient()` from `@/lib/supabase-server`; tables from Task 1.
- Produces (used by every route in Tasks 5–8 and the live layout in Task 9):
  - `ensureAgentBootstrap(userId: string): Promise<void>` — first-touch: insert `user_agent_state` + `agent_configs` defaults; on FIRST insert also seed `agent_decisions` (model_id `'updown'`) and `wallet_ledger` fixtures from `SEED_DECISIONS_LIVE` / `SEED_LEDGER_LIVE`.
  - `loadStateWire(userId): Promise<StateWire>` where `StateWire = { phase, title, sub, paused, paper: true, equippedId, balanceCents, todayPnlCents, lastDecision: Decision | null }`
  - `loadModelsWire(userId): Promise<{ models: AgentModel[]; subscribedIds: string[]; equippedId: string }>` — catalog (status live/review, owner null) + user's own rows + virtual `myModelEntry`, ordered: `updown`, `my-model`, user customs, then remaining catalog by `sort_order`.
  - `loadConfig(userId): Promise<{ name: string; emoji: string; color: string; prompt: string; preset: string }>`
  - `loadWalletWire(userId): Promise<{ balanceCents: number; spark: number[]; ledger: LedgerEntry[] }>`
  - `loadActivity(userId, limit: number, before?: string): Promise<Decision[]>`
  - `applyWallet(userId, args: { kind: 'deposit' | 'withdraw'; label: string; detail: string; amountCents: number; stripeRef?: string }): Promise<number>` — calls the `agent_wallet_apply` SQL function via `.rpc()`, returns the new balance.
  - `isSubscribed(userId, modelId): Promise<boolean>`; `activateSub(userId, modelId, stripeSubscriptionId: string | null): Promise<void>` (upsert on `(user_id, model_id)`, status `active`); `cancelSubByStripeId(stripeSubscriptionId): Promise<void>`.

- [ ] **Step 1: Implement `service.ts`**

```ts
// Service-role data access for the agent experience. Every function takes
// an explicit userId (already authenticated by the route) — nothing here
// reads cookies. Pure mapping lives in ./wire; this file is the only I/O.
import { getServerClient } from '@/lib/supabase-server'
import type { AgentModel, Decision, LedgerEntry } from '@/app/agent/lib/types'
import {
  decisionRowToWire, ledgerRowToWire, myModelEntry, phaseAt, rowToModel,
  sparkFromLedger, SEED_DECISIONS_LIVE, SEED_LEDGER_LIVE,
  type AgentModelRow,
} from './wire'

export interface StateWire {
  phase: string
  title: string
  sub: string
  paused: boolean
  paper: true
  equippedId: string
  balanceCents: number
  todayPnlCents: number
  lastDecision: Decision | null
}

export async function ensureAgentBootstrap(userId: string): Promise<void> {
  const sb = getServerClient()
  // Insert-if-absent; `count` tells us whether this was the first touch.
  const { data: inserted, error } = await sb
    .from('user_agent_state')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('user_id')
  if (error) throw error
  await sb.from('agent_configs')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })

  const firstTouch = (inserted?.length ?? 0) > 0
  if (!firstTouch) return

  const now = Date.now()
  const { error: decErr } = await sb.from('agent_decisions').insert(
    SEED_DECISIONS_LIVE.map(d => ({
      user_id: userId, model_id: 'updown', venue: d.venue, action: d.action,
      title: d.title, detail: d.detail, pnl_cents: d.pnl_cents,
      created_at: new Date(now - d.minutes_ago * 60_000).toISOString(),
    })),
  )
  if (decErr) console.error('[agent] seed decisions failed', decErr)
  const { error: ledErr } = await sb.from('wallet_ledger').insert(
    SEED_LEDGER_LIVE.map(l => ({
      user_id: userId, kind: l.kind, label: l.label, detail: l.detail,
      amount_cents: l.amount_cents,
      created_at: new Date(now - l.days_ago * 86_400_000).toISOString(),
    })),
  )
  if (ledErr) console.error('[agent] seed ledger failed', ledErr)
}

export async function loadStateWire(userId: string): Promise<StateWire> {
  const sb = getServerClient()
  const [{ data: st }, { data: last }, { data: pnlRows }] = await Promise.all([
    sb.from('user_agent_state').select('equipped_model_id, paused, sim_balance_cents')
      .eq('user_id', userId).maybeSingle(),
    sb.from('agent_decisions')
      .select('id, venue, action, title, detail, pnl_cents, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    // Carry-in: Today P&L is DATE-FILTERED (UTC day), not all-time.
    sb.from('agent_decisions').select('pnl_cents')
      .eq('user_id', userId)
      .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
  ])
  const paused = st?.paused ?? false
  const p = phaseAt(Date.now(), paused)
  return {
    phase: p.phase, title: p.title, sub: p.sub,
    paused,
    paper: true,
    equippedId: st?.equipped_model_id ?? 'updown',
    balanceCents: Number(st?.sim_balance_cents ?? 0),
    todayPnlCents: (pnlRows ?? []).reduce((s, r) => s + Number(r.pnl_cents ?? 0), 0),
    lastDecision: last?.[0] ? decisionRowToWire(last[0]) : null,
  }
}

export async function loadModelsWire(userId: string): Promise<{
  models: AgentModel[]; subscribedIds: string[]; equippedId: string
}> {
  const sb = getServerClient()
  const [{ data: rows }, { data: cfg }, { data: subs }, { data: st }] = await Promise.all([
    sb.from('agent_models')
      .select('id, name, emoji, brand, color, author, perf_30d, runners, price_cents, price_label, tagline, description, status, featured, included, kind, owner_user_id, sort_order')
      .or(`owner_user_id.is.null,owner_user_id.eq.${userId}`)
      .neq('status', 'coming_soon')
      .order('sort_order', { ascending: true }),
    sb.from('agent_configs').select('name, emoji, color').eq('user_id', userId).maybeSingle(),
    sb.from('agent_model_subs').select('model_id').eq('user_id', userId).eq('status', 'active'),
    sb.from('user_agent_state').select('equipped_model_id').eq('user_id', userId).maybeSingle(),
  ])
  const catalog = ((rows ?? []) as AgentModelRow[]).map(r => rowToModel(r, userId))
  const firstParty = catalog.filter(m => !m.mine)
  const customs = catalog.filter(m => m.mine)
  const flagship = firstParty.filter(m => m.id === 'updown')
  const rest = firstParty.filter(m => m.id !== 'updown')
  const mine = myModelEntry(cfg ?? { name: 'Longshot v3', emoji: '🐎', color: 'green' })
  return {
    models: [...flagship, mine, ...customs, ...rest],
    subscribedIds: (subs ?? []).map(s => s.model_id),
    equippedId: st?.equipped_model_id ?? 'updown',
  }
}

export async function loadConfig(userId: string) {
  const sb = getServerClient()
  const { data } = await sb.from('agent_configs')
    .select('name, emoji, color, prompt, preset').eq('user_id', userId).maybeSingle()
  return data ?? {
    name: 'Longshot v3', emoji: '🐎', color: 'green',
    prompt: '', preset: 'longshot',
  }
}

export async function loadWalletWire(userId: string): Promise<{
  balanceCents: number; spark: number[]; ledger: LedgerEntry[]
}> {
  const sb = getServerClient()
  const [{ data: st }, { data: rows }] = await Promise.all([
    sb.from('user_agent_state').select('sim_balance_cents').eq('user_id', userId).maybeSingle(),
    sb.from('wallet_ledger')
      .select('id, kind, label, detail, amount_cents, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ])
  const ledger = (rows ?? []).map(ledgerRowToWire)
  return {
    balanceCents: Number(st?.sim_balance_cents ?? 0),
    spark: sparkFromLedger(ledger.map(l => ({ amountCents: l.amountCents, at: l.at }))),
    ledger,
  }
}

export async function loadActivity(userId: string, limit: number, before?: string): Promise<Decision[]> {
  const sb = getServerClient()
  let q = sb.from('agent_decisions')
    .select('id, venue, action, title, detail, pnl_cents, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (before) q = q.lt('created_at', before)
  const { data } = await q
  return (data ?? []).map(decisionRowToWire)
}

export async function applyWallet(userId: string, args: {
  kind: 'deposit' | 'withdraw'; label: string; detail: string
  amountCents: number; stripeRef?: string
}): Promise<number> {
  const sb = getServerClient()
  const { data, error } = await sb.rpc('agent_wallet_apply', {
    p_user_id: userId,
    p_kind: args.kind,
    p_label: args.label,
    p_detail: args.detail,
    p_amount_cents: args.amountCents,
    p_stripe_ref: args.stripeRef ?? null,
  })
  if (error) throw error
  return Number(data)
}

export async function isSubscribed(userId: string, modelId: string): Promise<boolean> {
  const sb = getServerClient()
  const { data } = await sb.from('agent_model_subs').select('id')
    .eq('user_id', userId).eq('model_id', modelId).eq('status', 'active').maybeSingle()
  return Boolean(data)
}

export async function activateSub(userId: string, modelId: string, stripeSubscriptionId: string | null): Promise<void> {
  const sb = getServerClient()
  const { error } = await sb.from('agent_model_subs').upsert(
    { user_id: userId, model_id: modelId, stripe_subscription_id: stripeSubscriptionId, status: 'active' },
    { onConflict: 'user_id,model_id' },
  )
  if (error) throw error
}

export async function cancelSubByStripeId(stripeSubscriptionId: string): Promise<void> {
  const sb = getServerClient()
  const { error } = await sb.from('agent_model_subs')
    .update({ status: 'canceled' }).eq('stripe_subscription_id', stripeSubscriptionId)
  if (error) throw error
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sneakers/platform exec tsc --noEmit`
Expected: clean (or only pre-existing errors — check `git stash && tsc` baseline first if any appear).

- [ ] **Step 3: Commit**

```bash
git add apps/platform/src/lib/agent/service.ts
git commit -m "feat(agent-api): agent service layer — bootstrap seeding, wire loaders, atomic wallet apply"
```

---

### Task 5: Read routes — state, activity, models, config, wallet

**Files:**
- Create: `apps/platform/src/app/api/agent/state/route.ts`
- Create: `apps/platform/src/app/api/agent/activity/route.ts`
- Create: `apps/platform/src/app/api/agent/models/route.ts` (GET here; POST added in Task 6)
- Create: `apps/platform/src/app/api/agent/config/route.ts` (GET here; PUT added in Task 6)
- Create: `apps/platform/src/app/api/wallet/route.ts`

**Interfaces:**
- Consumes: Task 4 service functions.
- Produces: the wire contract Task 9's client consumes:
  - `GET /api/agent/state` → `StateWire` (see Task 4)
  - `GET /api/agent/activity?limit=30&before=<ISO>` → `{ decisions: Decision[] }`
  - `GET /api/agent/models` → `{ models, subscribedIds, equippedId }`
  - `GET /api/agent/config` → `{ name, emoji, color, prompt, preset }`
  - `GET /api/wallet` → `{ balanceCents, spark, ledger }`

Every file uses this shared skeleton (auth + bootstrap + error shape) — shown once in full for `state`, and the same wrapper applies to all:

- [ ] **Step 1: Create `api/agent/state/route.ts`**

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { ensureAgentBootstrap, loadStateWire } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadStateWire(user.id))
  } catch (err) {
    console.error('[api/agent/state]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `api/agent/activity/route.ts`**

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { ensureAgentBootstrap, loadActivity } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100)
  const before = url.searchParams.get('before') ?? undefined
  if (before && Number.isNaN(Date.parse(before))) {
    return Response.json({ error: 'invalid_before' }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json({ decisions: await loadActivity(user.id, limit, before) })
  } catch (err) {
    console.error('[api/agent/activity]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create `api/agent/models/route.ts` (GET)**

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { ensureAgentBootstrap, loadModelsWire } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadModelsWire(user.id))
  } catch (err) {
    console.error('[api/agent/models]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create `api/agent/config/route.ts` (GET) and `api/wallet/route.ts`** — identical wrapper, bodies:

```ts
// api/agent/config GET body:
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadConfig(user.id))
// api/wallet GET body:
    await ensureAgentBootstrap(user.id)
    return Response.json(await loadWalletWire(user.id))
```

(with matching imports `loadConfig` / `loadWalletWire` and `console.error` tags `[api/agent/config]` / `[api/wallet]`.)

- [ ] **Step 5: Verify unauthenticated behavior end-to-end**

Run: `pnpm platform` (dev server), then:

```bash
for p in agent/state agent/activity agent/models agent/config wallet; do
  curl -s -o /dev/null -w "%{http_code} /api/$p\n" http://localhost:3000/api/$p
done
```

Expected: `401` for all five.

Then log in through the browser at `http://localhost:3000/login` and hit `http://localhost:3000/api/agent/state` in the same browser — expected JSON with `paper: true`, `balanceCents: 124762`, `todayPnlCents: 3580` on first touch. (Requires migration 048 applied to the Supabase project your `.env.local` points at — apply it to the dev/staging project first via the dashboard SQL editor.)

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/api/agent apps/platform/src/app/api/wallet/route.ts
git commit -m "feat(agent-api): read routes — state, activity, models, config, wallet"
```

---

### Task 6: Mutation routes — equip, pause/resume, config PUT, create, submit

**Files:**
- Create: `apps/platform/src/app/api/agent/models/[id]/equip/route.ts`
- Create: `apps/platform/src/app/api/agent/pause/route.ts`
- Create: `apps/platform/src/app/api/agent/resume/route.ts`
- Modify: `apps/platform/src/app/api/agent/config/route.ts` (add PUT)
- Modify: `apps/platform/src/app/api/agent/models/route.ts` (add POST)
- Create: `apps/platform/src/app/api/agent/models/[id]/submit/route.ts`

**Interfaces:**
- Consumes: Tasks 2/4; `encryptSecret` from `@/lib/secrets`.
- Produces:
  - `POST /api/agent/models/:id/equip` → `{ ok: true, equippedId }` | 404 `model_not_found` | 400 `model_not_equippable` | 402 `subscription_required`
  - `POST /api/agent/pause` / `POST /api/agent/resume` → `{ ok: true, paused }`
  - `PUT /api/agent/config` body partial `{ name, emoji, color, prompt, preset }` → `{ ok: true }` | 400 `invalid_input` with `field`/`message`
  - `POST /api/agent/models` body `CreateAgentInput` → 201 `{ model: AgentModel }` | 400 `invalid_input` | 400 `agent_cap_reached`
  - `POST /api/agent/models/:id/submit` → `{ ok: true, status: 'review' }` | 404 | 400 `not_submittable`

- [ ] **Step 1: Create `equip/route.ts`** — this is the server-side id-validation carry-in:

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { ensureAgentBootstrap, isSubscribed } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()

    if (id !== 'my-model') {
      const { data: m } = await service.from('agent_models')
        .select('id, status, price_cents, included, owner_user_id')
        .eq('id', id).maybeSingle()
      if (!m) return Response.json({ error: 'model_not_found' }, { status: 404 })
      const mine = m.owner_user_id === user.id
      if (m.owner_user_id !== null && !mine) {
        return Response.json({ error: 'model_not_found' }, { status: 404 })
      }
      if (!mine && m.status !== 'live') {
        return Response.json({ error: 'model_not_equippable' }, { status: 400 })
      }
      const free = m.included || m.price_cents === null
      if (!mine && !free && !(await isSubscribed(user.id, id))) {
        return Response.json({ error: 'subscription_required' }, { status: 402 })
      }
    }

    const { error } = await service.from('user_agent_state')
      .update({ equipped_model_id: id, paused: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) throw error
    return Response.json({ ok: true, equippedId: id })
  } catch (err) {
    console.error('[api/agent/equip]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

Note the Next 16 dynamic-segment signature: `ctx.params` is a Promise — check `node_modules/next/dist/docs/` route-handler docs before writing and match the house style used by existing `[id]` API routes if any differ.

- [ ] **Step 2: Create `pause/route.ts` and `resume/route.ts`** — same auth wrapper; body:

```ts
// pause: set true; resume: set false
    const service = getServerClient()
    const paused = true // resume/route.ts: false
    const { error } = await service.from('user_agent_state')
      .update({ paused, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) throw error
    return Response.json({ ok: true, paused })
```

- [ ] **Step 3: Add PUT to `config/route.ts`**

```ts
export async function PUT(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const v = validateConfigPut(body)
  if (v.error) {
    return Response.json({ error: 'invalid_input', field: v.error.field, message: v.error.message }, { status: 400 })
  }
  if (Object.keys(v.value).length === 0) {
    return Response.json({ error: 'invalid_input', message: 'Nothing to update.' }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { error } = await service.from('agent_configs')
      .update({ ...v.value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/agent/config PUT]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

(add imports: `validateConfigPut` from `@/lib/agent/wire`, `getServerClient`.)

- [ ] **Step 4: Add POST to `models/route.ts`** (create user agent):

```ts
const MAX_USER_AGENTS = 10

export async function POST(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const v = validateCreateAgent(body)
  if (v.error) {
    return Response.json({ error: 'invalid_input', field: v.error.field, message: v.error.message }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { count } = await service.from('agent_models')
      .select('id', { count: 'exact', head: true }).eq('owner_user_id', user.id)
    if ((count ?? 0) >= MAX_USER_AGENTS) {
      return Response.json({ error: 'agent_cap_reached', message: `You can have up to ${MAX_USER_AGENTS} agents.` }, { status: 400 })
    }
    const input = v.value
    const id = 'custom-' + crypto.randomUUID().slice(0, 8)
    const n = (count ?? 0) + 1
    const row = {
      id,
      name: input.name || 'My Agent ' + n,
      emoji: input.emoji,
      color: input.color,
      author: 'you',
      description:
        input.kind === 'connected'
          ? 'Your connected bot. We send it market signals; it returns orders. Trading your paper balance while in review for the marketplace.'
          : (input.prompt || 'Your prompt-built agent, running on the Sneakers worker against your paper balance.'),
      status: 'private',
      kind: input.kind,
      owner_user_id: user.id,
      prompt: input.kind === 'prompt' ? (input.prompt ?? null) : null,
      endpoint_url: input.kind === 'connected' ? input.endpointUrl : null,
      api_key_encrypted: input.kind === 'connected' ? encryptSecret(input.apiKey!) : null,
      sort_order: 90,
    }
    const { data, error } = await service.from('agent_models').insert(row)
      .select('id, name, emoji, brand, color, author, perf_30d, runners, price_cents, price_label, tagline, description, status, featured, included, kind, owner_user_id, sort_order')
      .single()
    if (error) throw error
    return Response.json({ model: rowToModel(data as AgentModelRow, user.id) }, { status: 201 })
  } catch (err) {
    console.error('[api/agent/models POST]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

(add imports: `validateCreateAgent`, `rowToModel`, `type AgentModelRow` from `@/lib/agent/wire`; `encryptSecret` from `@/lib/secrets`; `getServerClient`.)

- [ ] **Step 5: Create `submit/route.ts`** — own private agents → `review`:

```ts
    const service = getServerClient()
    const { data: m } = await service.from('agent_models')
      .select('id, status, owner_user_id').eq('id', id).maybeSingle()
    if (!m || m.owner_user_id !== user.id) {
      return Response.json({ error: 'model_not_found' }, { status: 404 })
    }
    if (m.status !== 'private') {
      return Response.json({ error: 'not_submittable', message: 'Only private agents can be submitted.' }, { status: 400 })
    }
    const { error } = await service.from('agent_models')
      .update({ status: 'review' }).eq('id', id)
    if (error) throw error
    return Response.json({ ok: true, status: 'review' })
```

(same `[id]` param + auth wrapper as equip.)

- [ ] **Step 6: Verify with dev server** (logged-in browser session; or curl with the copied `sb-*` cookies):

```bash
# from the browser devtools console while logged in at localhost:3000:
await (await fetch('/api/agent/models/wave/equip', { method: 'POST' })).json()
// → { error: 'subscription_required' } (wave is paid, not subscribed)  [carry-in ✓]
await (await fetch('/api/agent/models/nope/equip', { method: 'POST' })).json()
// → { error: 'model_not_found' }                                       [carry-in ✓]
await (await fetch('/api/agent/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset: 'momentum' }) })).json()
// → { ok: true }
```

- [ ] **Step 7: Commit**

```bash
git add apps/platform/src/app/api/agent
git commit -m "feat(agent-api): mutations — equip (server-validated), pause/resume, config PUT, create + submit agents"
```

---

### Task 7: Subscribe route + Stripe model subscriptions + webhook branches

**Files:**
- Create: `apps/platform/src/lib/agent/stripe.ts`
- Create: `apps/platform/src/app/api/agent/models/[id]/subscribe/route.ts`
- Modify: `apps/platform/src/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `getStripe()`, `siteUrl()` from `@/lib/stripe`; Task 4's `activateSub`/`cancelSubByStripeId`/`isSubscribed`.
- Produces:
  - `POST /api/agent/models/:id/subscribe` → `{ ok: true, status: 'active', testMode?: true }` (free, or paid with Stripe unconfigured) | `{ url }` (Stripe Checkout redirect) | 404 `model_not_found` | 400 `model_not_subscribable` | 400 `already_subscribed`
  - `createAgentModelCheckout({ userId, email, modelId, modelName, priceCents })` → Checkout Session with `metadata.agent_model_id` on session AND subscription.
  - Webhook: sessions/subscriptions carrying `metadata.agent_model_id` are routed to agent-sub handling BEFORE the plan-subscription logic.

- [ ] **Step 1: Create `src/lib/agent/stripe.ts`**

```ts
// Stripe Checkout for agent-model subscriptions. Uses inline recurring
// price_data so no Products/Prices need pre-creating in the dashboard —
// right for test mode; revisit if models need per-interval pricing.
import Stripe from 'stripe'
import { getStripe, siteUrl } from '@/lib/stripe'

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export async function createAgentModelCheckout(args: {
  userId: string
  email: string | null
  modelId: string
  modelName: string
  priceCents: number
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const metadata = { user_id: args.userId, agent_model_id: args.modelId }
  console.log('[agent/stripe] creating model checkout', { modelId: args.modelId, userId: args.userId })
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: args.priceCents,
        recurring: { interval: 'month' },
        product_data: { name: `Sneakers Agent · ${args.modelName}` },
      },
    }],
    ...(args.email ? { customer_email: args.email } : {}),
    client_reference_id: args.userId,
    metadata,
    subscription_data: { metadata },
    success_url: `${siteUrl()}/agent/models?sub=success&model=${args.modelId}`,
    cancel_url: `${siteUrl()}/agent/models?sub=canceled&model=${args.modelId}`,
  })
  console.log('[agent/stripe] model checkout created', { sessionId: session.id })
  return session
}
```

- [ ] **Step 2: Create `subscribe/route.ts`**

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { activateSub, ensureAgentBootstrap, isSubscribed } from '@/lib/agent/service'
import { createAgentModelCheckout, stripeConfigured } from '@/lib/agent/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { data: m } = await service.from('agent_models')
      .select('id, name, status, price_cents, included, owner_user_id')
      .eq('id', id).maybeSingle()
    if (!m || m.owner_user_id !== null) {
      return Response.json({ error: 'model_not_found' }, { status: 404 })
    }
    if (m.status !== 'live') {
      return Response.json({ error: 'model_not_subscribable' }, { status: 400 })
    }
    if (m.included) {
      return Response.json({ error: 'already_subscribed', message: 'Included with your plan.' }, { status: 400 })
    }
    if (await isSubscribed(user.id, id)) {
      return Response.json({ error: 'already_subscribed' }, { status: 400 })
    }

    if (m.price_cents === null) {
      await activateSub(user.id, id, null)
      return Response.json({ ok: true, status: 'active' })
    }

    if (!stripeConfigured()) {
      // Paper mode: no Stripe keys anywhere yet — grant the sub, mark it test.
      await activateSub(user.id, id, null)
      return Response.json({ ok: true, status: 'active', testMode: true })
    }

    const session = await createAgentModelCheckout({
      userId: user.id,
      email: user.email ?? null,
      modelId: m.id,
      modelName: m.name,
      priceCents: m.price_cents,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    console.error('[api/agent/subscribe]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Branch the existing webhook** — in `api/stripe/webhook/route.ts`, inside the existing event `switch`, BEFORE the plan-subscription handling in each relevant case, add the agent-model branch (adapt to the file's local variable names when editing):

```ts
// case 'checkout.session.completed':
const agentModelId = session.metadata?.agent_model_id
if (agentModelId) {
  const userId = session.metadata?.user_id ?? session.client_reference_id
  if (userId && typeof session.subscription === 'string') {
    await activateSub(userId, agentModelId, session.subscription)
    console.log('[stripe/webhook] agent model sub activated', { agentModelId, userId })
  } else {
    console.error('[stripe/webhook] agent model session missing user/subscription', { sessionId: session.id })
  }
  break // do NOT fall through to plan handling
}

// case 'customer.subscription.deleted':
if (sub.metadata?.agent_model_id) {
  await cancelSubByStripeId(sub.id)
  console.log('[stripe/webhook] agent model sub canceled', { subId: sub.id })
  break
}
```

(add import `{ activateSub, cancelSubByStripeId }` from `@/lib/agent/service`.)

- [ ] **Step 4: Test the paper-mode path** (Stripe unconfigured locally): from the logged-in browser console:

```js
await (await fetch('/api/agent/models/wave/subscribe', { method: 'POST' })).json()
// → { ok: true, status: 'active', testMode: true }
await (await fetch('/api/agent/models/wave/equip', { method: 'POST' })).json()
// → { ok: true, equippedId: 'wave' }   (402 gate now passes)
await (await fetch('/api/agent/models/wave/subscribe', { method: 'POST' })).json()
// → { error: 'already_subscribed' }
await (await fetch('/api/agent/models/news/subscribe', { method: 'POST' })).json()
// → { error: 'model_not_subscribable' }  (news is in review)
```

- [ ] **Step 5: Run existing tests + typecheck** — `pnpm --filter @sneakers/platform test && pnpm --filter @sneakers/platform exec tsc --noEmit`. Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/lib/agent/stripe.ts apps/platform/src/app/api/agent/models apps/platform/src/app/api/stripe/webhook/route.ts
git commit -m "feat(agent-api): model subscribe — Stripe test-mode checkout with paper fallback + webhook activation"
```

---

### Task 8: Wallet deposit + withdraw routes

**Files:**
- Create: `apps/platform/src/app/api/wallet/deposit/route.ts`
- Create: `apps/platform/src/app/api/wallet/withdraw/route.ts`
- Modify: `apps/platform/src/app/api/stripe/webhook/route.ts` (payment_intent.succeeded branch)

**Interfaces:**
- Consumes: Task 4's `applyWallet`, `loadWalletWire`; `getStripe` from `@/lib/stripe`.
- Produces:
  - `POST /api/wallet/deposit` body `{ amountCents }` (int, 100–1_000_000) →
    - Stripe configured: `{ clientSecret }` (PaymentIntent, `metadata: { user_id, kind: 'agent_wallet_deposit' }`)
    - Stripe absent: `{ ok: true, balanceCents }` (direct paper credit)
  - `POST /api/wallet/withdraw` body `{ amountCents }` → `{ ok: true, balanceCents }` | 400 `insufficient_funds` (test-mode stub — no real payout)
  - Webhook handles `payment_intent.succeeded` with `metadata.kind === 'agent_wallet_deposit'` → `applyWallet` credit, idempotent on the PaymentIntent id.

- [ ] **Step 1: Create `deposit/route.ts`**

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { getStripe } from '@/lib/stripe'
import { applyWallet, ensureAgentBootstrap } from '@/lib/agent/service'
import { stripeConfigured } from '@/lib/agent/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_CENTS = 100
const MAX_CENTS = 1_000_000

export async function POST(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown }
  const amountCents = Number(body.amountCents)
  if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return Response.json(
      { error: 'invalid_amount', message: 'Amount must be between $1 and $10,000.' },
      { status: 400 },
    )
  }
  try {
    await ensureAgentBootstrap(user.id)

    if (!stripeConfigured()) {
      const balanceCents = await applyWallet(user.id, {
        kind: 'deposit', label: 'Added cash', detail: 'Test mode · no card charged', amountCents,
      })
      return Response.json({ ok: true, balanceCents })
    }

    console.log('[api/wallet/deposit] creating PaymentIntent', { userId: user.id, amountCents })
    const pi = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: user.id, kind: 'agent_wallet_deposit' },
    })
    console.log('[api/wallet/deposit] PaymentIntent created', { id: pi.id })
    return Response.json({ clientSecret: pi.client_secret })
  } catch (err) {
    console.error('[api/wallet/deposit]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `withdraw/route.ts`** (test-mode stub; negative-amount ledger row):

```ts
import { getAuthClient } from '@/lib/supabase-auth'
import { getServerClient } from '@/lib/supabase-server'
import { applyWallet, ensureAgentBootstrap } from '@/lib/agent/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sb = await getAuthClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown }
  const amountCents = Number(body.amountCents)
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    return Response.json({ error: 'invalid_amount' }, { status: 400 })
  }
  try {
    await ensureAgentBootstrap(user.id)
    const service = getServerClient()
    const { data: st } = await service.from('user_agent_state')
      .select('sim_balance_cents').eq('user_id', user.id).maybeSingle()
    if (Number(st?.sim_balance_cents ?? 0) < amountCents) {
      return Response.json({ error: 'insufficient_funds' }, { status: 400 })
    }
    const balanceCents = await applyWallet(user.id, {
      kind: 'withdraw', label: 'Withdrawal', detail: 'Test mode · no payout sent', amountCents: -amountCents,
    })
    return Response.json({ ok: true, balanceCents })
  } catch (err) {
    console.error('[api/wallet/withdraw]', err)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Add the `payment_intent.succeeded` case to the subscription webhook** (`api/stripe/webhook/route.ts`):

```ts
case 'payment_intent.succeeded': {
  const pi = event.data.object as Stripe.PaymentIntent
  if (pi.metadata?.kind !== 'agent_wallet_deposit') break // not ours
  const userId = pi.metadata.user_id
  if (!userId) { console.error('[stripe/webhook] agent deposit PI missing user_id', { id: pi.id }); break }
  const balance = await applyWallet(userId, {
    kind: 'deposit', label: 'Added cash', detail: 'Stripe (test)', amountCents: pi.amount,
    stripeRef: pi.id, // idempotent: replayed events are no-ops
  })
  console.log('[stripe/webhook] agent wallet credited', { userId, pi: pi.id, balance })
  break
}
```

(add import `applyWallet` from `@/lib/agent/service`; Stripe dashboard must add `payment_intent.succeeded` to this endpoint's event list — Task 11 checklist.)

- [ ] **Step 4: Test paper path** (browser console, logged in):

```js
await (await fetch('/api/wallet/deposit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents: 10000 }) })).json()
// → { ok: true, balanceCents: 134762 }
await (await fetch('/api/wallet/withdraw', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents: 99999999 }) })).json()
// → { error: 'insufficient_funds' }
await (await fetch('/api/wallet', { method: 'GET' })).json()
// → ledger shows the deposit at the top; spark's last point equals balanceCents
```

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/api/wallet apps/platform/src/app/api/stripe/webhook/route.ts
git commit -m "feat(agent-api): paper wallet deposit/withdraw with Stripe PaymentIntent path + idempotent webhook credit"
```

---

### Task 9: Live store — client API module, dispatch side effects, polling, layout flag

**Files:**
- Create: `apps/platform/src/app/agent/lib/api.ts`
- Modify: `apps/platform/src/app/agent/lib/store.tsx`
- Modify: `apps/platform/src/app/agent/layout.tsx`

**Interfaces:**
- Consumes: Tasks 3, 5–8; `buildInitialUIState` added to Task 4's service here.
- Produces:
  - `AgentProvider` props become `{ children, live?: boolean, initial?: AgentUIState }`.
  - `useAgent()` context gains `live: boolean` and `api: { deposit(cents): Promise<DepositResult>; saveConfig(patch): Promise<boolean>; refreshWallet(): Promise<void> }` — everything else (state/status/todayPnl/owned/dispatch) is unchanged, so no component signature changes.
  - Mock mode (`live` falsy): behavior is byte-identical to Phase 1.

- [ ] **Step 1: Add `buildInitialUIState` to `src/lib/agent/service.ts`** (server-side initial payload so live mode has no client loading flash):

```ts
export async function buildInitialUIState(userId: string) {
  await ensureAgentBootstrap(userId)
  const [state, models, wallet, decisions] = await Promise.all([
    loadStateWire(userId),
    loadModelsWire(userId),
    loadWalletWire(userId),
    loadActivity(userId, 30),
  ])
  return {
    models: models.models,
    equippedId: models.equippedId,
    subscribedIds: models.subscribedIds,
    paused: state.paused,
    tick: 0,
    balanceCents: state.balanceCents,
    decisions,
    ledger: wallet.ledger,
    spark: wallet.spark,
    customCount: models.models.filter(m => m.mine && m.id !== 'my-model').length,
    serverPnlCents: state.todayPnlCents,
  }
}
```

- [ ] **Step 2: Create `src/app/agent/lib/api.ts`** (client fetchers, same-origin):

```ts
// Thin client for /api/agent/* and /api/wallet. All calls are same-origin
// (cookie session) and return null on network/HTTP failure — callers
// reconcile by re-syncing rather than surfacing raw errors.
import type { AgentModel, CreateAgentInput, Decision, LedgerEntry } from './types'

async function j<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      console.warn('[agent/api]', path, res.status, await res.text().catch(() => ''))
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn('[agent/api]', path, err)
    return null
  }
}

export interface StateRes {
  phase: string; title: string; sub: string; paused: boolean; paper: boolean
  equippedId: string; balanceCents: number; todayPnlCents: number
  lastDecision: Decision | null
}
export type SubscribeRes = { ok: true; status: string; testMode?: boolean } | { url: string }
export type DepositRes = { ok: true; balanceCents: number } | { clientSecret: string }

export const agentApi = {
  state: () => j<StateRes>('/api/agent/state'),
  activity: (limit = 30) => j<{ decisions: Decision[] }>(`/api/agent/activity?limit=${limit}`),
  models: () => j<{ models: AgentModel[]; subscribedIds: string[]; equippedId: string }>('/api/agent/models'),
  subscribe: (id: string) => j<SubscribeRes>(`/api/agent/models/${encodeURIComponent(id)}/subscribe`, { method: 'POST' }),
  equip: (id: string) => j<{ ok: true; equippedId: string }>(`/api/agent/models/${encodeURIComponent(id)}/equip`, { method: 'POST' }),
  pause: () => j<{ ok: true; paused: boolean }>('/api/agent/pause', { method: 'POST' }),
  resume: () => j<{ ok: true; paused: boolean }>('/api/agent/resume', { method: 'POST' }),
  createAgent: (input: CreateAgentInput) => j<{ model: AgentModel }>('/api/agent/models', { method: 'POST', body: JSON.stringify(input) }),
  submit: (id: string) => j<{ ok: true; status: string }>(`/api/agent/models/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
  getConfig: () => j<{ name: string; emoji: string; color: string; prompt: string; preset: string }>('/api/agent/config'),
  saveConfig: (patch: Record<string, string>) => j<{ ok: true }>('/api/agent/config', { method: 'PUT', body: JSON.stringify(patch) }),
  wallet: () => j<{ balanceCents: number; spark: number[]; ledger: LedgerEntry[] }>('/api/wallet'),
  deposit: (amountCents: number) => j<DepositRes>('/api/wallet/deposit', { method: 'POST', body: JSON.stringify({ amountCents }) }),
  withdraw: (amountCents: number) => j<{ ok: true; balanceCents: number }>('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amountCents }) }),
}
```

- [ ] **Step 3: Rewrite `store.tsx`** — same context shape plus `live`/`api`; dispatch wrapper fires API calls after the optimistic local apply:

```tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import { agentReducer, currentStatus, initialState, isOwned, todayPnlCents } from './engine'
import type { AgentAction, AgentUIState } from './engine'
import { agentApi } from './api'

interface AgentCtx {
  state: AgentUIState
  status: ReturnType<typeof currentStatus>
  todayPnl: number
  owned: (id: string) => boolean
  dispatch: (a: AgentAction) => void
  live: boolean
  api: typeof agentApi
}

const Ctx = createContext<AgentCtx | null>(null)

export function AgentProvider({ children, live = false, initial }: {
  children: React.ReactNode
  live?: boolean
  initial?: AgentUIState
}) {
  const [state, rawDispatch] = useReducer(agentReducer, initial, s => s ?? initialState())
  const stateRef = useRef(state)
  stateRef.current = state

  const resync = useCallback(async () => {
    const [st, models, wallet] = await Promise.all([agentApi.state(), agentApi.models(), agentApi.wallet()])
    rawDispatch({
      type: 'sync',
      patch: {
        ...(st ? { paused: st.paused, balanceCents: st.balanceCents, equippedId: st.equippedId, serverPnlCents: st.todayPnlCents } : {}),
        ...(models ? { models: models.models, subscribedIds: models.subscribedIds } : {}),
        ...(wallet ? { balanceCents: wallet.balanceCents, spark: wallet.spark, ledger: wallet.ledger } : {}),
      },
    })
  }, [])

  // Live side effects: optimistic local apply already happened; fire the
  // matching API call and reconcile. Components keep the same dispatch API.
  const dispatch = useCallback((a: AgentAction) => {
    const before = stateRef.current
    rawDispatch(a)
    if (!live) return
    switch (a.type) {
      case 'subscribe':
        void agentApi.subscribe(a.id).then(res => {
          if (res && 'url' in res) window.location.assign(res.url) // Stripe Checkout
          else if (!res) void resync() // revert optimistic sub on failure
        })
        break
      case 'equip':
        void agentApi.equip(a.id).then(res => { if (!res) void resync() })
        break
      case 'togglePaused':
        void (before.paused ? agentApi.resume() : agentApi.pause()).then(res => { if (!res) void resync() })
        break
      case 'deposit':
        // Live deposits go through ctx.api.deposit (Payment Element path);
        // this local action only fires in mock mode. Guard: resync to undo.
        void resync()
        break
      case 'createAgent':
        void agentApi.createAgent(a.input).then(res => {
          if (res?.model) rawDispatch({ type: 'modelCreated', model: res.model })
          else void resync()
        })
        break
      case 'updateConfig':
        void agentApi.saveConfig(a.patch as Record<string, string>).then(res => { if (!res) void resync() })
        break
    }
  }, [live, resync])

  // Mock ticker (phase animation) runs in both modes — the synthesized
  // server phase and this local cycle share the same copy + cadence.
  useEffect(() => {
    const id = setInterval(() => rawDispatch({ type: 'tick' }), 4500)
    return () => clearInterval(id)
  }, [])

  // Live polling: /api/agent/state every 5s while the tab is visible.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void agentApi.state().then(st => {
        if (st) rawDispatch({
          type: 'sync',
          patch: { paused: st.paused, balanceCents: st.balanceCents, equippedId: st.equippedId, serverPnlCents: st.todayPnlCents },
        })
      })
    }, 5000)
    return () => clearInterval(id)
  }, [live])

  return (
    <Ctx.Provider
      value={{
        state,
        status: currentStatus(state),
        todayPnl: state.serverPnlCents ?? todayPnlCents(state),
        owned: id => isOwned(state, id),
        dispatch,
        live,
        api: agentApi,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAgent(): AgentCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAgent outside AgentProvider')
  return ctx
}
```

Note: `useReducer(agentReducer, initial, s => s ?? initialState())` keeps lazy init for mock mode while accepting the server payload; the server `initial` must be passed as a plain JSON-serializable object (it is — `AgentUIState` is plain data).

- [ ] **Step 4: Wire `layout.tsx`** — live flag + initial payload:

```tsx
import { redirect } from 'next/navigation'
import { getAuthClient } from '@/lib/supabase-auth'
import { buildInitialUIState } from '@/lib/agent/service'
import { AgentProvider } from './lib/store'
import { AgentFrame } from './components/agent-frame'

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const preview = process.env.NODE_ENV !== 'production' && process.env.AGENT_PREVIEW === '1'
  let userId: string | null = null
  if (!preview) {
    const supabase = await getAuthClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) redirect('/login')
    userId = data.user.id
  }

  const live = process.env.AGENT_API_LIVE === '1' && userId !== null
  const initial = live ? await buildInitialUIState(userId!) : undefined

  return (
    <AgentProvider live={live} initial={initial}>
      <AgentFrame>{children}</AgentFrame>
    </AgentProvider>
  )
}
```

(Preserve whatever else the current `layout.tsx` renders — adapt the diff to the file as it exists; the auth block shown matches the current file at `layout.tsx:9-14`.)

- [ ] **Step 5: Run tests + mock-mode regression**

Run: `pnpm --filter @sneakers/platform test` → PASS.
Run: `AGENT_PREVIEW=1 pnpm platform` → open `http://localhost:3000/agent`; verify the mock demo behaves exactly as before (equip, pause, add cash, create agent — all local).

- [ ] **Step 6: Live-mode smoke test**

Run: `AGENT_API_LIVE=1 pnpm platform` → log in → `/agent`:
- Balance shows the DB value; Today P&L = 3580 on a fresh user (seed fixtures).
- Subscribe to Wave Rider in Models → grid `+` flips to ✓ and survives a hard refresh (DB-backed).
- Pause → refresh → still paused.
- Add cash $100 via the sheet — balance +$100 and the ledger entry survives refresh.

- [ ] **Step 7: Commit**

```bash
git add apps/platform/src/app/agent/lib/api.ts apps/platform/src/app/agent/lib/store.tsx apps/platform/src/app/agent/layout.tsx apps/platform/src/lib/agent/service.ts
git commit -m "feat(agent-web): live store — API-backed dispatch, 5s state polling, server-built initial state behind AGENT_API_LIVE"
```

---

### Task 10: UI wires — subscribe asymmetry, My Model editor, My-Agents list, live add-cash

**Files:**
- Modify: `apps/platform/src/app/agent/components/agent-tab-view.tsx`
- Modify: `apps/platform/src/app/agent/components/models-tab-view.tsx`
- Modify: `apps/platform/src/app/agent/components/add-cash-sheet.tsx`
- Create: `apps/platform/src/app/agent/components/my-model-editor.tsx`

**Interfaces:**
- Consumes: Task 9's `useAgent()` (`live`, `api`), Task 3's `updateConfig` action.
- Produces: spec carry-ins resolved — paid-model equip routes through the detail sheet (payment context); My Model prompt is editable and persisted; user-created agents are listed in the Models tab; add-cash works in live mode with a Payment Element branch when Stripe is configured.

- [ ] **Step 1: Subscribe asymmetry in `agent-tab-view.tsx`** — replace the equip button's `onClick` (currently `dispatch({ type: 'equip', id: m.id })` at line 66):

```tsx
onClick={() => {
  const paid = !owned(m.id) && m.priceCents !== null && !m.included
  if (paid) setSheetModel(m)          // payment goes through the detail sheet
  else dispatch({ type: 'equip', id: m.id })
}}
```

Rationale (records the spec's "resolve in the contract design"): free/included models keep one-tap equip everywhere; paid models always open the sheet, whose Subscribe action hits the API and — when Stripe is configured — redirects to Checkout (handled invisibly by the store's dispatch wrapper).

- [ ] **Step 2: Create `my-model-editor.tsx`** (editable prompt + presets, persisted via `updateConfig`):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useAgent } from '../lib/store'

const PRESET_LABELS: Record<string, string> = {
  longshot: 'Longshot 10–35¢',
  momentum: 'Momentum',
  fade: 'Fade the spike',
  conservative: 'Conservative',
}

const FALLBACK_PROMPT =
  'Trade 5 and 15-minute crypto markets only. Favor longshots priced 10–35¢ with momentum confirmation. ' +
  'Max 5% of bankroll per trade. Skip anything with a spread over 4¢.'

export function MyModelEditor() {
  const { live, api, dispatch } = useAgent()
  const [prompt, setPrompt] = useState(FALLBACK_PROMPT)
  const [preset, setPreset] = useState('longshot')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!live) return
    void api.getConfig().then(cfg => {
      if (cfg) { setPrompt(cfg.prompt || FALLBACK_PROMPT); setPreset(cfg.preset) }
    })
  }, [live, api])

  function save() {
    dispatch({ type: 'updateConfig', patch: { prompt, preset } })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <textarea
        className="mprompt"
        style={{ width: '100%', minHeight: 96, resize: 'vertical', background: 'transparent', border: 0, color: 'inherit', font: 'inherit' }}
        value={prompt}
        maxLength={2000}
        aria-label="Strategy prompt"
        onChange={e => { setPrompt(e.target.value); setDirty(true) }}
      />
      <div className="mchips">
        {Object.entries(PRESET_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={'mchip' + (preset === key ? ' mchip--on' : '')}
            onClick={() => { setPreset(key); setDirty(true) }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ag-sub" style={{ marginTop: 12 }}>
        Your model re-reads this prompt before every window. Changes apply to the next scan.
      </div>
      {(dirty || saved) && (
        <button className="ag-pill ag-pill--primary" style={{ width: '100%', marginTop: 10, fontSize: 14 }} onClick={save} disabled={saved}>
          {saved ? 'Saved ✓' : 'Save prompt'}
        </button>
      )}
    </>
  )
}
```

- [ ] **Step 3: Wire the editor + My-Agents list into `models-tab-view.tsx`** — in the `seg === 'mine'` branch, replace the static `<div className="mprompt">…</div>` + `<div className="mchips">…</div>` + trailing `ag-sub` block (lines 45-57) with `<MyModelEditor />`, and after the Run/Backtest button row insert the My-Agents section:

```tsx
{state.models.filter(m => m.mine && m.id !== mine.id).length > 0 && (
  <>
    <div className="ag-sechead" style={{ marginTop: 16 }}>My agents</div>
    {state.models.filter(m => m.mine && m.id !== mine.id).map(m => (
      <button key={m.id} className="ag-card ag-row" style={{ width: '100%', textAlign: 'left', marginBottom: 8 }} onClick={() => setSheetModel(m)}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{m.emoji} {m.name}</div>
        <div className="ag-sub">{m.status === 'review' ? 'In review' : 'Private'}</div>
      </button>
    ))}
  </>
)}
```

(`mine` at line 15 stays as-is — in live mode it resolves to the `my-model` virtual entry. Adapt classNames to the existing `agent.css` tokens if `ag-card ag-row` on a `<button>` needs a small style shim.)

- [ ] **Step 4: Live add-cash in `add-cash-sheet.tsx`** — replace the confirm button's `onClick` and add the Payment Element branch:

```tsx
'use client'
import { useState } from 'react'
import { Sheet } from './sheet'
import { useAgent } from '../lib/store'

const AMOUNTS = [2500, 10000, 25000]

export function AddCashSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { live, api, dispatch } = useAgent()
  const [cents, setCents] = useState(10000)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!live) { dispatch({ type: 'deposit', cents }); setCents(10000); onClose(); return }
    setBusy(true); setError(null)
    const res = await api.deposit(cents)
    if (!res) { setError('Deposit failed — try again.'); setBusy(false); return }
    if ('clientSecret' in res) {
      // Stripe configured: hosted confirmation via Payment Element.
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')
      if (!stripe) { setError('Payments unavailable.'); setBusy(false); return }
      const elements = stripe.elements({ clientSecret: res.clientSecret, appearance: { theme: 'night' } })
      const mount = document.getElementById('ag-payel')
      if (mount) {
        elements.create('payment').mount(mount)
        // Confirm on a second tap: swap the button handler by state.
        setPayState({ stripe, elements })
        setBusy(false)
        return
      }
    }
    // Paper path: server already credited the balance.
    await api.wallet().then(w => {
      if (w) dispatch({ type: 'sync', patch: { balanceCents: w.balanceCents, ledger: w.ledger, spark: w.spark } })
    })
    setBusy(false); setCents(10000); onClose()
  }

  const [payState, setPayState] = useState<{ stripe: import('@stripe/stripe-js').Stripe; elements: import('@stripe/stripe-js').StripeElements } | null>(null)

  async function confirmCard() {
    if (!payState) return
    setBusy(true)
    const { error: err } = await payState.stripe.confirmPayment({
      elements: payState.elements,
      confirmParams: { return_url: window.location.origin + '/agent/balance?deposit=success' },
      redirect: 'if_required',
    })
    if (err) { setError(err.message ?? 'Payment failed.'); setBusy(false); return }
    // Webhook credits the ledger; poll wallet until the balance lands (≤10s).
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const w = await api.wallet()
      if (w) dispatch({ type: 'sync', patch: { balanceCents: w.balanceCents, ledger: w.ledger, spark: w.spark } })
    }
    setPayState(null); setBusy(false); setCents(10000); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="ag-row">
        <div style={{ fontSize: 17, fontWeight: 700 }}>Add cash</div>
        <span className="ag-badge ag-badge--test">STRIPE TEST</span>
      </div>
      <div className="ag-sub" style={{ marginTop: 8 }}>
        Test mode — card 4242 4242 4242 4242. No real money moves.
      </div>
      <div className="ag-pickrow" style={{ margin: '14px 0 16px' }}>
        {AMOUNTS.map(a => (
          <button key={a} className={'mchip ag-num' + (a === cents ? ' mchip--on' : '')}
            style={{ flex: 1, textAlign: 'center', fontSize: 14, padding: '11px 0' }}
            disabled={Boolean(payState)}
            onClick={() => setCents(a)}>
            ${a / 100}
          </button>
        ))}
      </div>
      <div id="ag-payel" style={{ marginBottom: payState ? 16 : 0 }} />
      {error && <div className="ag-sub" style={{ color: 'var(--ag-red)', marginBottom: 10 }}>{error}</div>}
      <button className="ag-pill ag-pill--primary ag-num" style={{ width: '100%' }} disabled={busy}
        onClick={payState ? confirmCard : confirm}>
        {busy ? '…' : payState ? `Pay $${cents / 100}` : `Add $${cents / 100}`}
      </button>
    </Sheet>
  )
}
```

(Move the `payState` useState declaration above `confirm` — shown out of order here for readability. `var(--ag-red)`: use the actual red token name from `agent.css`.)

- [ ] **Step 5: Regression + live QA**

Run: `pnpm --filter @sneakers/platform test && pnpm --filter @sneakers/platform exec tsc --noEmit` → green.
Run: `AGENT_PREVIEW=1 pnpm platform` → mock demo unchanged (add cash still instant-local; My Model editor edits locally; carousel paid-model button opens the sheet).
Run: `AGENT_API_LIVE=1 pnpm platform` (logged in) → edit the prompt, Save, hard-refresh → text persists (PUT/GET config round-trip). Create an agent via Add Agent → it appears in the carousel AND under Models → My Model → "My agents"; Submit to marketplace from its sheet → status flips to "In review".

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/agent/components
git commit -m "feat(agent-web): paid-sub sheet routing, editable My Model prompt, My-Agents list, live add-cash flow"
```

---

### Task 11: Verification sweep, docs, deploy checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-07-06-agent-experience-design.md` (Phase 2 status section)
- Modify: `ROADMAP.md` (if it tracks the agent track — update status line)

- [ ] **Step 1: Full gate** — `pnpm --filter @sneakers/platform test && pnpm --filter @sneakers/platform exec tsc --noEmit && pnpm --filter @sneakers/platform build`. Expected: all green.

- [ ] **Step 2: Mock-mode final regression** — `AGENT_PREVIEW=1 pnpm platform`, walk all five tabs. Nothing regressed with `AGENT_API_LIVE` unset.

- [ ] **Step 3: Append a "Phase 2 status" block to the spec** (mirrors the Phase-1 status convention):

```markdown
## Phase 2 status (updated YYYY-MM-DD)

Phase 2 (contract) is BUILT on `feat/sneakers-agent`: migration 048, `/api/agent/*`
+ `/api/wallet*` routes, live store behind `AGENT_API_LIVE=1`. Stripe rails are
presence-gated (paper fallback while keys are empty). Carry-ins resolved: editable
My Model prompt, date-filtered today P&L, server-side subscribe/equip validation,
subscribe asymmetry (paid → sheet → Checkout), My-Agents list, negative-money
formatting. Still parked for the follow-up UI batch: accessibility (carousel
keyboard, sheet focus-trap), remaining CSS prefixing. GET /api/connections and
GET /api/plans deferred to the iOS-port phase (web Profile reads these server-side
already).
```

- [ ] **Step 4: Write the deploy checklist into the PR/WORKLOG** (order matters):

1. Apply `048_agent_marketplace.sql` by hand in the prod Supabase SQL editor (BEFORE deploying — same-window rule).
2. Set `AGENT_API_LIVE=1` on Vercel (production) — leave unset to keep prod on the mock while validating preview.
3. Stripe (whenever test keys get pasted): set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`; in the Stripe dashboard add `payment_intent.succeeded` to the `/api/stripe/webhook` endpoint's event list. Until then everything runs in paper fallback by design.
4. Deploy; verify `/api/agent/state` returns `paper: true` for a logged-in user; run the Task 9 Step 6 smoke list against prod.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-06-agent-experience-design.md ROADMAP.md
git commit -m "docs(agent): Phase 2 contract status + deploy checklist"
```

---

## Self-review notes (spec coverage)

- API contract: `state`, `activity`, `models` (GET/POST), `subscribe`, `equip`, `submit`, `config` (GET/PUT), `pause`/`resume`, `wallet` (GET), `deposit`, `withdraw` — all implemented. `GET /api/connections` and `GET /api/plans` are intentionally DEFERRED to the iOS-port phase: the web Profile tab already reads this data via server components (redesign absorption track), so the routes have no web consumer; noted in the spec status block.
- Data model: all six spec tables created (Task 1), plus `agent_wallet_apply` for atomic idempotent wallet writes.
- Carry-ins: prompt editing (T10), date-filtered P&L (T4), server-side id validation (T6), subscribe asymmetry (T10 + T7), My-Agents list (T10), negative formatting (T2), PAPER badge server-driven (T4 `paper: true`; client badge still renders its prop — iOS reads the flag). Profile identity was already fixed by the redesign track. Accessibility + CSS prefixing → separate follow-up plan by design.
- Stripe: subscriptions via hosted Checkout (house pattern), deposits via PaymentIntent + Payment Element (spec pattern), both presence-gated with paper fallbacks since all Stripe env vars are empty in prod today.
- Error handling: worker-stale amber state is a Phase 3 concern (no worker yet); every Stripe call logs entry + success per the log-success-path rule.
