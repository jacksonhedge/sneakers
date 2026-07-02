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
