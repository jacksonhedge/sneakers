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
  price_cents       bigint,                   -- null = free
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
  ('updown', 'Up/Down', '🎢', null, 'updown', 'Sneakers Labs', 14.6, 2340, null,
   null, null,
   'The flagship. Trades every Bitcoin and crypto up/down market on Kalshi and Polymarket - 5 and 15-minute windows, both directions. Included with your Sneakers plan.',
   'live', false, true, 'prompt', 10),
  ('oddsjam', 'OddsJam', null, 'oddsjam', 'oddsjam', 'OddsJam', null, 0, 1999,
   'From $1 per day', 'The best sports/predictions agent',
   'The best sports & predictions agent. Powered by OddsJam''s live odds data across every major sportsbook and prediction market - finds +EV lines and trades them for you.',
   'live', true, false, 'connected', 20),
  ('gambly', 'Gambly', null, 'gambly', 'gambly', 'Gambly.com', null, 0, 1499,
   null, 'Gambly.com''s official agent',
   'Gambly.com''s official trading agent. Brings Gambly''s picks and community signal straight to your bankroll - it plays, you watch the balance.',
   'live', true, false, 'connected', 30),
  ('wave', 'Wave Rider', '🏄', null, 'blue', 'Sneakers Labs', 18.2, 1204, 999,
   null, null,
   'Rides momentum across consecutive 5-minute windows. Enters on book imbalance, exits into strength. Best in trending sessions.',
   'live', false, false, 'prompt', 40),
  ('drift', 'Overnight Drift', '🦉', null, 'purple', 'Sneakers Labs', 11.7, 862, 499,
   null, null,
   'Trades the quiet hours - fades overreactions on low-liquidity overnight windows when spreads widen.',
   'live', false, false, 'prompt', 50),
  ('sniper', 'Cent Sniper', '🎯', null, 'gold', '@quantfrat', 8.9, 315, 299,
   null, null,
   'Hunts mispriced 1-5c tails minutes before settle. Small size, high frequency, strict loss ceiling.',
   'live', false, false, 'prompt', 60),
  ('news', 'News Reactor', '🗞️', null, 'red', 'community', null, 0, null,
   null, null,
   'Reacts to headline momentum within seconds. Currently in review — subscribable once it clears the vetting run.',
   'review', false, false, 'prompt', 70)
on conflict (id) do nothing;

comment on table agent_models is 'Agent marketplace catalog + user-created agents (owner_user_id set).';
comment on table user_agent_state is 'Per-user agent runtime state: equipped model, paused, paper balance.';
comment on table agent_configs is 'My Model prompt/preset — the worker re-reads this each window (Phase 3).';
comment on table agent_model_subs is 'Model subscriptions. stripe_subscription_id null = free or paper-mode.';
comment on table agent_decisions is 'Agent decision feed. Fixtures until the worker goes live (Phase 3).';
comment on table wallet_ledger is 'Paper wallet ledger. stripe_ref = PaymentIntent id for idempotency.';
