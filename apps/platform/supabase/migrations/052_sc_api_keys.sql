-- apps/platform/supabase/migrations/052_sc_api_keys.sql
--
-- Spare Change Millionaire: API keys for partners (a Whop community, a
-- parlay-builder app, a Discord bot) who pull each day's tickets as JSON from
-- GET /api/spare-change/v1/picks.
--
-- Only a SHA-256 hash of each key is stored. The key itself is shown once, on
-- the admin page that makes it, and can't be read back. A key is never
-- deleted: revoking sets revoked_at, so usage history stays.
--
-- Written by the server only (service role): RLS on, no policies.
-- Apply before deploying the code that uses it. Applying it first is safe:
-- nothing older reads these tables.

create table if not exists public.sc_api_keys (
  id               uuid primary key default gen_random_uuid(),
  -- Who the key is for, as shown on the admin page ("Parlay Pals (Whop)").
  name             text not null check (length(name) between 1 and 120),
  contact_email    text check (contact_email is null or length(contact_email) <= 254),
  note             text check (note is null or length(note) <= 500),
  -- The first characters of the key ("scm_AbC123"), so a partner and the
  -- admin page can tell keys apart. Not enough to use.
  key_prefix       text not null,
  -- Lowercase hex SHA-256 of the whole key.
  key_hash         text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  per_minute_limit integer not null default 60 check (per_minute_limit between 1 and 600),
  daily_limit      integer not null default 2000 check (daily_limit between 1 and 100000),
  created_by       text not null,
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz,
  revoked_by       text
);

alter table public.sc_api_keys enable row level security;

-- Requests per key per day (US Eastern), for the daily limit and the admin page.
create table if not exists public.sc_api_usage (
  key_id    uuid not null references public.sc_api_keys(id) on delete cascade,
  day       date not null,
  requests  integer not null default 0 check (requests >= 0),
  primary key (key_id, day)
);

alter table public.sc_api_usage enable row level security;

-- Count one request and return that day's total, in one statement so two
-- requests at once can't both read the old number. Also stamps last_used_at.
create or replace function public.sc_api_count_request(p_key_id uuid, p_day date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  insert into public.sc_api_usage (key_id, day, requests)
  values (p_key_id, p_day, 1)
  on conflict (key_id, day) do update set requests = public.sc_api_usage.requests + 1
  returning requests into total;

  update public.sc_api_keys set last_used_at = now() where id = p_key_id;
  return total;
end;
$$;

revoke all on function public.sc_api_count_request(uuid, date) from public, anon, authenticated;
grant execute on function public.sc_api_count_request(uuid, date) to service_role;
