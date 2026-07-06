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
