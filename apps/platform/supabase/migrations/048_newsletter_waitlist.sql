-- apps/platform/supabase/migrations/048_newsletter_waitlist.sql
--
-- People who asked for the "Spare Change Millionaire" newsletter (a daily
-- email of long-shot parlays, 18+ only). A separate table, not new columns
-- on public.waitlist: waitlist is one row per email and is shared with other
-- products, and this keeps the newsletter's age and state data apart and
-- lets someone already on the Sneakers list opt in later.
--
-- A row exists ONLY for someone who gave an age of 18 or older; the check on
-- age_at_signup refuses anything else. name is what they typed (trimmed, 1 to
-- 80 characters, enforced by the route) and age_at_signup is the age they gave
-- on the day they signed up (it is not kept up to date). One row per email
-- (the route upserts and keeps the first row). referred_by_code is the ?ref=
-- code they arrived with, kept as plain text for attribution (no foreign key:
-- the Sneakers waitlist row is where the referral is actually counted).
--
-- The welcome dollar. Each row has an unguessable claim_token (192 random
-- bits, made by the server) that goes in the link in the welcome email;
-- an email already on the list keeps its first token. welcome_sent_at is when
-- the last welcome email went out (null = none has). email_confirmed_at is
-- the first time the claim link was opened, which proves the address is real.
-- Claiming sets venmo_handle (as typed), venmo_handle_key (lower-cased) and
-- claimed_at together, in one UPDATE that only matches while claimed_at is
-- null, so a link can be claimed once. venmo_handle_key is unique: one dollar
-- per Venmo username. paid_at is set by hand after the Friday payout (see
-- docs/launch/spare-change-friday-payouts.md). The cap on total claims is
-- enforced by the route (SPARE_CHANGE_CLAIM_CAP), not here.
--
-- Written by the server only (service role), like the roundup_demo_* tables:
-- RLS on, no policies, so the anon and authenticated keys can read nothing.

create table if not exists public.newsletter_waitlist (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  name              text not null,
  age_at_signup     smallint not null check (age_at_signup >= 18 and age_at_signup <= 120),
  state             text not null check (state ~ '^[A-Z]{2}$'),
  source            text not null default 'spare-change',
  referred_by_code  text,
  created_at        timestamptz not null default now(),
  claim_token        text not null unique check (claim_token ~ '^[A-Za-z0-9_-]{32,}$'),
  welcome_sent_at    timestamptz,
  email_confirmed_at timestamptz,
  claimed_at         timestamptz,
  venmo_handle       text check (venmo_handle ~ '^[A-Za-z0-9_-]{5,30}$'),
  venmo_handle_key   text unique,
  paid_at            timestamptz,
  -- A claim is the username, its key and the time, all three or none.
  constraint newsletter_waitlist_claim_all_or_none check (
    (venmo_handle is null) = (claimed_at is null)
    and (venmo_handle_key is null) = (claimed_at is null)
  ),
  constraint newsletter_waitlist_key_matches check (venmo_handle_key is null or venmo_handle_key = lower(venmo_handle)),
  -- Only a claim can be paid.
  constraint newsletter_waitlist_paid_needs_claim check (paid_at is null or claimed_at is not null)
);

create index if not exists newsletter_waitlist_created_at_idx
  on public.newsletter_waitlist (created_at desc);

-- The Friday payout list and the count for the cap: claimed rows only.
create index if not exists newsletter_waitlist_claimed_at_idx
  on public.newsletter_waitlist (claimed_at)
  where claimed_at is not null;

alter table public.newsletter_waitlist enable row level security;

-- No public policies -- service role only.
