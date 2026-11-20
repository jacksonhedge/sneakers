-- apps/platform/supabase/migrations/049_spare_change_core.sql
--
-- Spare Change Millionaire: members, issues, tickets, wagers and rewards.
--
-- The daily email shows four long-shot parlay "tickets". A member taps a
-- button to open a ticket on the betting or prediction site, places it there
-- themselves and sends a picture of the slip; a verified slip earns a small
-- daily reward, paid by hand on Venmo on Fridays. These tables RECORD that.
-- Nothing here places a wager and nothing here moves money.
--
-- The member table is public.newsletter_waitlist (migration 048), extended
-- below. Everything new is prefixed sc_. Later this is the user database and
-- wager record for the Sneakers app, so: stable uuid ids, integer cents,
-- timestamps everywhere, and newsletter_waitlist.sneakers_account_id (null
-- until a member is linked to a Sneakers account).
--
-- Written by the server only (service role): RLS on, no policies, on every
-- table. The two views are security_invoker, so they obey the same RLS.
--
-- APPLY THIS BEFORE DEPLOYING THE CODE THAT USES IT: the signup route writes
-- link_token and referred_by_member_id, and the claim route writes sc_rewards.
-- (Applying it first is safe for the old code: every new member column has a
-- default.)

-- ---------------------------------------------------------------- 1. members
alter table public.newsletter_waitlist
  -- Unguessable token for tracked links (/go/<ticket>?m=<link_token>). The
  -- server makes 192 random bits; the default (two random uuids, 244 random
  -- bits) covers rows written by anything else and backfills existing rows.
  add column if not exists link_token text
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  add column if not exists status text not null default 'waitlist',
  add column if not exists tester boolean not null default false,
  add column if not exists daily_reward_cents integer not null default 100,
  add column if not exists reward_days integer not null default 30,
  -- First day rewards can accrue. Null until the first rewarded day.
  add column if not exists started_on date,
  -- Extra days earned from referrals (see sc_referral_credits).
  add column if not exists extra_reward_days integer not null default 0,
  add column if not exists unsubscribed_at timestamptz,
  -- Null until this member is linked to a Sneakers account.
  add column if not exists sneakers_account_id text,
  add column if not exists referred_by_member_id uuid references public.newsletter_waitlist(id) on delete set null;

update public.newsletter_waitlist
set link_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where link_token is null;

alter table public.newsletter_waitlist alter column link_token set not null;

alter table public.newsletter_waitlist
  add constraint newsletter_waitlist_link_token_key unique (link_token),
  -- At least 22 URL-safe characters: 128 bits or more.
  add constraint newsletter_waitlist_link_token_shape check (link_token ~ '^[A-Za-z0-9_-]{22,}$'),
  add constraint newsletter_waitlist_status_check check (status in ('waitlist', 'active', 'paused', 'removed')),
  add constraint newsletter_waitlist_daily_reward_check check (daily_reward_cents between 0 and 1000),
  add constraint newsletter_waitlist_reward_days_check check (reward_days between 0 and 365),
  add constraint newsletter_waitlist_extra_days_check check (extra_reward_days between 0 and 365),
  add constraint newsletter_waitlist_not_own_referrer check (referred_by_member_id is null or referred_by_member_id <> id);

create index if not exists newsletter_waitlist_referred_by_member_idx
  on public.newsletter_waitlist (referred_by_member_id)
  where referred_by_member_id is not null;

create index if not exists newsletter_waitlist_sneakers_account_idx
  on public.newsletter_waitlist (sneakers_account_id)
  where sneakers_account_id is not null;

-- updated_at is kept by the database, so no writer can forget it.
create or replace function public.sc_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------- 2. issues
-- One row per day's email. source is the pipeline's whole issue.json.
create table if not exists public.sc_issues (
  issue_date  date primary key,
  issue_no    integer,
  subject     text not null,
  preheader   text,
  from_name   text,
  built_at    timestamptz,
  sent_at     timestamptz,
  source      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger sc_issues_touch before update on public.sc_issues
  for each row execute function public.sc_touch_updated_at();

alter table public.sc_issues enable row level security;

-- ---------------------------------------------------------------- 3. tickets
-- The four tickets of an issue. est_payout_cents is the exact estimated
-- winnings (buy-in x (product of leg decimals - 1)); headline_cents is the
-- rounded-down amount the email shows. min_age comes from the site (one map,
-- in src/lib/spare-change-core.ts; unknown sites are 21).
create table if not exists public.sc_tickets (
  id                uuid primary key default gen_random_uuid(),
  issue_date        date not null references public.sc_issues(issue_date) on delete cascade,
  -- "position" is quoted wherever it stands alone: it is also the name of a built-in SQL function.
  "position"        smallint not null check ("position" between 1 and 4),
  site              text not null,
  name              text not null,
  buy_in_cents      integer not null check (buy_in_cents > 0),
  est_payout_cents  bigint not null check (est_payout_cents >= 0),
  headline_cents    bigint not null check (headline_cents >= 0),
  one_in            integer,
  fair_one_in       integer,
  fee_cents         integer not null default 0 check (fee_cents >= 0),
  min_age           smallint not null check (min_age between 18 and 99),
  link              text,
  estimated         boolean not null default true,
  result            text not null default 'pending' check (result in ('pending', 'won', 'lost', 'void')),
  settled_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (issue_date, "position")
);

alter table public.sc_tickets enable row level security;

-- ------------------------------------------------------------------- 4. legs
create table if not exists public.sc_legs (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.sc_tickets(id) on delete cascade,
  n              smallint not null check (n >= 1),
  sport          text,
  league         text,
  event          text not null,
  starts_at      timestamptz,
  market         text,
  pick           text not null,
  price_text     text not null,
  price_decimal  numeric(12,4) not null check (price_decimal > 1),
  -- The site's own id for this side: line id, ticker, market slug.
  source_ref     text,
  result         text not null default 'pending' check (result in ('pending', 'hit', 'miss', 'void', 'ungraded')),
  created_at     timestamptz not null default now(),
  unique (ticket_id, n)
);

alter table public.sc_legs enable row level security;

-- ----------------------------------------------------------------- 5. wagers
-- One row per member per ticket: they tapped it, then (maybe) sent a slip,
-- then someone verified or rejected the slip. stake_cents is what the member
-- says they put in. A ticket with wagers cannot be deleted (on delete
-- restrict). roundup_funded_cents and source 'roundup' are reserved for
-- round-ups; nothing writes them yet.
create table if not exists public.sc_wagers (
  id                    uuid primary key default gen_random_uuid(),
  member_id             uuid not null references public.newsletter_waitlist(id) on delete cascade,
  ticket_id             uuid not null references public.sc_tickets(id) on delete restrict,
  status                text not null default 'tapped' check (status in ('tapped', 'submitted', 'verified', 'rejected')),
  source                text not null default 'tap' check (source in ('tap', 'slip', 'roundup', 'admin')),
  tapped_at             timestamptz,
  tap_count             integer not null default 0 check (tap_count >= 0),
  stake_cents           integer check (stake_cents > 0),
  slip_received_at      timestamptz,
  -- Email message id or storage path of the slip picture.
  slip_ref              text,
  -- The site's own bet id read off the slip, when there is one.
  slip_bet_id           text,
  verified_at           timestamptz,
  verified_by           text,
  rejected_reason       text,
  result                text not null default 'pending' check (result in ('pending', 'won', 'lost', 'void')),
  payout_cents          bigint check (payout_cents >= 0),
  roundup_funded_cents  integer not null default 0 check (roundup_funded_cents >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (member_id, ticket_id)
);

-- The same slip can't be used twice.
create unique index if not exists sc_wagers_slip_bet_id_key
  on public.sc_wagers (slip_bet_id)
  where slip_bet_id is not null;

create index if not exists sc_wagers_ticket_idx on public.sc_wagers (ticket_id);
create index if not exists sc_wagers_member_created_idx on public.sc_wagers (member_id, created_at);

create trigger sc_wagers_touch before update on public.sc_wagers
  for each row execute function public.sc_touch_updated_at();

alter table public.sc_wagers enable row level security;

-- ---------------------------------------------------------------- 6. rewards
-- The ledger of what members are owed. A row is owed until paid_at is set;
-- paying is done by hand (Venmo, Fridays) and then recorded here with the
-- batch label and the Venmo username it went to. A member with rewards cannot
-- be deleted (on delete restrict): set status = 'removed' instead.
create table if not exists public.sc_rewards (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.newsletter_waitlist(id) on delete restrict,
  kind          text not null check (kind in ('welcome', 'daily', 'referral_day', 'adjustment')),
  issue_date    date,
  amount_cents  integer not null,
  wager_id      uuid references public.sc_wagers(id) on delete set null,
  note          text,
  earned_at     timestamptz not null default now(),
  paid_at       timestamptz,
  pay_batch     text,
  paid_to       text,
  created_at    timestamptz not null default now(),
  constraint sc_rewards_day_needs_date check (kind not in ('daily', 'referral_day') or issue_date is not null),
  constraint sc_rewards_negative_only_adjustment check (amount_cents >= 0 or kind = 'adjustment'),
  constraint sc_rewards_batch_needs_paid check (paid_at is not null or (pay_batch is null and paid_to is null)),
  -- A day can't pay twice.
  constraint sc_rewards_member_kind_date_key unique (member_id, kind, issue_date)
);

-- At most one welcome reward per member (issue_date is null for it, so the
-- constraint above does not cover it).
create unique index if not exists sc_rewards_one_welcome
  on public.sc_rewards (member_id)
  where kind = 'welcome';

-- Belt and braces: one day reward per member per date across both day kinds.
create unique index if not exists sc_rewards_one_day_reward
  on public.sc_rewards (member_id, issue_date)
  where kind in ('daily', 'referral_day');

create index if not exists sc_rewards_unpaid_idx on public.sc_rewards (member_id) where paid_at is null;
create index if not exists sc_rewards_batch_idx on public.sc_rewards (pay_batch) where pay_batch is not null;

alter table public.sc_rewards enable row level security;

-- ------------------------------------------------------- 7. referral credits
-- One row per referred friend. qualified_at is the friend's first verified
-- wager; days_granted is what that added to the referrer's extra_reward_days
-- (0 once the referrer is at the cap).
create table if not exists public.sc_referral_credits (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.newsletter_waitlist(id) on delete cascade,
  friend_id     uuid not null unique references public.newsletter_waitlist(id) on delete cascade,
  qualified_at  timestamptz,
  days_granted  integer not null default 0 check (days_granted >= 0),
  created_at    timestamptz not null default now(),
  constraint sc_referral_credits_not_self check (referrer_id <> friend_id)
);

create index if not exists sc_referral_credits_referrer_idx on public.sc_referral_credits (referrer_id);

alter table public.sc_referral_credits enable row level security;

-- ---------------------------------------------------------- 8. member events
-- Audit trail: taps, refused taps, slips, verifications, payouts. member_id
-- is null for an anonymous tap.
create table if not exists public.sc_member_events (
  id          bigint generated always as identity primary key,
  member_id   uuid references public.newsletter_waitlist(id) on delete set null,
  type        text not null,
  ticket_id   uuid,
  meta        jsonb not null default '{}',
  ip_country  text,
  created_at  timestamptz not null default now()
);

create index if not exists sc_member_events_member_idx on public.sc_member_events (member_id, created_at);
create index if not exists sc_member_events_type_idx on public.sc_member_events (type, created_at);

alter table public.sc_member_events enable row level security;

-- ------------------------------------------------------------------ 9. views
-- Who is owed what: one row per member with unpaid rewards. Only members who
-- have given a Venmo username and have not been removed.
create or replace view public.sc_payouts_due
with (security_invoker = true) as
select
  m.id                           as member_id,
  m.name,
  m.venmo_handle,
  m.state,
  m.age_at_signup,
  count(*)::integer              as unpaid_count,
  sum(r.amount_cents)::bigint    as unpaid_cents,
  min(r.earned_at)               as oldest_earned_at
from public.sc_rewards r
join public.newsletter_waitlist m on m.id = r.member_id
where r.paid_at is null
  and m.venmo_handle is not null
  and m.status <> 'removed'
group by m.id, m.name, m.venmo_handle, m.state, m.age_at_signup;

-- Per ticket: taps = members who tapped, tap_total = every tap,
-- submitted = slips received, verified / rejected = slips checked.
create or replace view public.sc_ticket_summary
with (security_invoker = true) as
select
  t.id                                                        as ticket_id,
  t.issue_date,
  t."position",
  t.site,
  t.name,
  t.result,
  count(w.id) filter (where w.tapped_at is not null)::integer        as taps,
  coalesce(sum(w.tap_count), 0)::integer                             as tap_total,
  count(w.id) filter (where w.slip_received_at is not null)::integer as submitted,
  count(w.id) filter (where w.status = 'verified')::integer          as verified,
  count(w.id) filter (where w.status = 'rejected')::integer          as rejected
from public.sc_tickets t
left join public.sc_wagers w on w.ticket_id = t.id
group by t.id;

-- --------------------------------------------- 10. the welcome dollar, ledger
-- The claim flow keeps writing newsletter_waitlist (venmo_handle, claimed_at)
-- and from now on also inserts a 'welcome' reward of 100 cents. This brings
-- in any claim made before that: one welcome row each, carrying over paid_at
-- for claims already paid under the old runbook.
insert into public.sc_rewards (member_id, kind, amount_cents, note, earned_at, paid_at, pay_batch, paid_to)
select m.id, 'welcome', 100, 'Welcome dollar', m.claimed_at, m.paid_at,
       case when m.paid_at is not null then 'before-ledger' end,
       case when m.paid_at is not null then m.venmo_handle end
from public.newsletter_waitlist m
where m.claimed_at is not null
on conflict do nothing;

-- No public policies anywhere above -- service role only.
