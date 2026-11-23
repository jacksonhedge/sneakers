-- apps/platform/supabase/migrations/053_sc_referral_cash.sql
--
-- Spare Change Millionaire referrals pay cash: $5 (500 cents) to the referrer
-- when a friend who joined with their link has a first slip verified, for the
-- referrer's first 5 such friends. The $5 is one 'referral' row in sc_rewards,
-- paid by hand with the Friday Venmo batch like every other reward.
--
-- Replaces extra reward days as what a referral earns. days_granted stays
-- (always 0 from now on unless SPARE_CHANGE_REFERRAL_DAYS_PER_FRIEND is set),
-- so old rows keep their meaning.
--
-- Apply before deploying the code that uses it. Safe for the old code: it only
-- widens a check and adds columns with defaults.

-- 1. A reward kind for the referral $5.
alter table public.sc_rewards drop constraint if exists sc_rewards_kind_check;
alter table public.sc_rewards
  add constraint sc_rewards_kind_check check (kind in ('welcome', 'daily', 'referral', 'referral_day', 'adjustment'));

-- A friend's qualifying wager pays its referrer once, however many times
-- verification is run.
create unique index if not exists sc_rewards_referral_wager_key
  on public.sc_rewards (wager_id)
  where kind = 'referral';

-- 2. What each friend's credit paid, and which wager qualified them (so a run
-- that stopped half way can finish writing the reward).
alter table public.sc_referral_credits
  add column if not exists cents_granted integer not null default 0 check (cents_granted >= 0),
  add column if not exists wager_id uuid references public.sc_wagers(id) on delete set null;
