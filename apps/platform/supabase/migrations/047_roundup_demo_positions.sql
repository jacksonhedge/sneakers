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
