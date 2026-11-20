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
  created_at        timestamptz not null default now()
);

create index if not exists newsletter_waitlist_created_at_idx
  on public.newsletter_waitlist (created_at desc);

alter table public.newsletter_waitlist enable row level security;

-- No public policies -- service role only.
