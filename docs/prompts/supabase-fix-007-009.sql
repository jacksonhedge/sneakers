-- Fix the two 42703 (undefined_column) errors on prod Supabase
-- Project: ujfgtkebslesepbjrhyr
-- Idempotent — safe to re-run.

-- Migration 007: waitlist Stripe + subscription columns
alter table public.waitlist
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status    text
    check (subscription_status in (
      'active','trialing','past_due','canceled',
      'incomplete','incomplete_expired','unpaid','paused'
    )),
  add column if not exists subscription_current_period_end    timestamptz,
  add column if not exists subscription_cancel_at_period_end  boolean not null default false,
  add column if not exists subscription_price_id  text,
  add column if not exists business_subtype       text
    check (business_subtype in ('standard','fraternity'));

create index if not exists waitlist_stripe_customer_id_idx
  on public.waitlist (stripe_customer_id);
create index if not exists waitlist_stripe_subscription_id_idx
  on public.waitlist (stripe_subscription_id);
create index if not exists waitlist_subscription_status_idx
  on public.waitlist (subscription_status);
create index if not exists waitlist_business_subtype_idx
  on public.waitlist (business_subtype)
  where business_subtype is not null;

-- Migration 009: user_provider_keys missing columns
alter table public.user_provider_keys
  add column if not exists label             text,
  add column if not exists verified_at       timestamptz,
  add column if not exists last_used_at      timestamptz,
  add column if not exists updated_at        timestamptz not null default now(),
  add column if not exists key_preview       text,
  add column if not exists api_key_encrypted text;

-- Verify both fixes
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'waitlist' and column_name = 'subscription_status')
    or (table_name = 'user_provider_keys' and column_name = 'label')
  )
order by table_name, column_name;
