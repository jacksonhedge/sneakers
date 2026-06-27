# Chrome prompt — apply migration 033 (feature_flags)

Run migration `033_feature_flags.sql` against the production Supabase project. Creates `public.feature_flags` + RLS deny-public + an `updated_at` auto-touch trigger. Idempotent.

Without this, the new `/admin/flags` page renders an empty table and `setFlagAction` upserts will fail.

---

**Required inputs from the user before you start** — same as 032, only needed if not already in the same Supabase session.

If you ran the 032 prompt earlier in the same browser session, skip the login step and go straight to the SQL editor.

---

## Step 1 — Open the Supabase SQL editor (if not already open)

Same as the 032 prompt. Pick the project whose ref matches `NEXT_PUBLIC_SUPABASE_URL`.

## Step 2 — Paste the migration

```sql
create table if not exists public.feature_flags (
  key text primary key,
  value_bool boolean not null default false,
  description text null,
  updated_at timestamptz not null default now(),
  updated_by text null
);

alter table public.feature_flags enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feature_flags'
      and policyname = 'feature_flags_deny_public'
  ) then
    create policy feature_flags_deny_public
      on public.feature_flags
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

create or replace function public.feature_flags_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feature_flags_touch_updated_at on public.feature_flags;
create trigger feature_flags_touch_updated_at
  before update on public.feature_flags
  for each row
  execute function public.feature_flags_touch_updated_at();

comment on table public.feature_flags is
  'Boolean feature flags togglable from /admin/flags. Read via lib/feature-flags.ts -> getFlag(); write via the server action with audit logging.';
```

Click **Run**.

## Step 3 — Verify

```sql
-- 1. table exists with expected columns
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'feature_flags'
order by ordinal_position;

-- 2. RLS policy in place
select policyname, permissive, cmd from pg_policies
where schemaname = 'public' and tablename = 'feature_flags';

-- 3. trigger registered
select trigger_name, event_manipulation
from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'feature_flags';

-- 4. table is empty
select count(*) from public.feature_flags;
```

Expected:
- 5 columns: key, value_bool, description, updated_at, updated_by
- 1 policy: feature_flags_deny_public, RESTRICTIVE, ALL
- 1 trigger: feature_flags_touch_updated_at on UPDATE
- 0 rows

## Step 4 — Final report

```
## Migration 033 — feature_flags
- Table created: yes / no
- Column count: <n>
- RLS policy in place: yes / no
- updated_at trigger registered: yes / no
- Initial row count: <n>
- Any error messages: <verbatim>
```

---

## Boundaries

Same boundaries as 032. Idempotent — running twice is safe.
