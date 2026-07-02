# Chrome prompt — Apply migration 046_roundup_demo.sql

Applies the anonymous-session round-up demo tables migration to the Sneakers Terminal Supabase project via the dashboard SQL editor. Must run **before** the /roundup-demo portal routes (Tasks 4-8) receive traffic.

---

Task: apply migration 046_roundup_demo.sql to the Sneakers Terminal Supabase project. Creates three service-role-only tables (roundup_demo_sessions, roundup_demo_txns, roundup_demo_ledger) for anonymous session-scoped demo wallets.

Prerequisites:
- Logged into supabase.com
- Project ref: ujfgtkebslesepbjrhyr

Step 1 — navigate
Go to: https://supabase.com/dashboard/project/ujfgtkebslesepbjrhyr/sql/new

Step 2 — paste this SQL into the editor

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

Step 3 — click Run (or Cmd+Enter)

Step 4 — verify
- Result panel should show "Success. No rows returned."
- Then navigate to Table Editor → public
- You should see three new tables: roundup_demo_sessions, roundup_demo_txns, roundup_demo_ledger
- roundup_demo_sessions should have these columns: session_id (text, primary key), stripe_customer_id (text), bank_account_id (text), bank_institution (text), bank_last4 (text), round_to_cents (int4, default 100), multiplier (int4, default 1), threshold_cents (int4, default 500), weekly_cap_cents (int4, default 2000), facilitated_cents (int4, default 0), wallet_cents (int4, default 0), transferred_this_week_cents (int4, default 0), created_at (timestamptz), updated_at (timestamptz)
- roundup_demo_txns should have these columns: session_id (text, foreign key), txn_id (text), merchant (text), amount_cents (int4), round_up_cents (int4), occurred_on (date), created_at (timestamptz)
- roundup_demo_ledger should have these columns: id (uuid, primary key), session_id (text, foreign key), kind (text, check constraint), amount_cents (int4), memo (text), occurred_at (timestamptz)

Step 5 — report back
- Confirm the SQL ran successfully (screenshot the result panel)
- Screenshot Table Editor showing all three new tables and their columns
- If there's any error message, copy the exact text verbatim before retrying anything

Do NOT:
- Run any other SQL
- Change RLS policies
- Edit any rows manually

If the migration errors, the most likely cause is syntax errors in the foreign key references or check constraint; stop and paste the error.
