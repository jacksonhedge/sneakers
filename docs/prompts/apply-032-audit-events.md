# Chrome prompt — apply migration 032 (admin_audit_events)

Run migration `032_admin_audit_events.sql` against the production Supabase project. Creates `public.admin_audit_events` + 4 indexes + RLS deny-public policy. Idempotent (uses `if not exists` and `do $$` guards).

Without this, the `/admin/audit` page renders an empty table and every `logAdminAction()` call silently no-ops.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `supabase_login_method` — Email / GitHub / SSO. Need it so the agent picks the right SSO button on the Supabase login page. Default GitHub.

If missing, STOP and ask.

---

## Step 1 — Open the Supabase SQL editor for this project

1. Open `https://supabase.com/dashboard/sign-in` in a new tab.
2. Click the SSO method matching `supabase_login_method`. Hand off to the user for credential entry.
3. After landing in the dashboard, find the project named (likely) `sneakers-terminal` or whatever matches the `NEXT_PUBLIC_SUPABASE_URL` host (`ujfgtkebslesepbjrhyr...`). Click into it.
4. Left nav → SQL Editor → New query.

If the project list shows multiple Supabase projects, pick the one whose ref ID matches the `NEXT_PUBLIC_SUPABASE_URL` host fragment. STOP and ask the user to confirm if multiple match.

## Step 2 — Paste the migration

The full SQL is below. Paste it into the editor verbatim:

```sql
-- Admin audit log.
--
-- Immutable append-only record of every admin write action: who did it,
-- what they did, to whom (or what), and any action-specific payload. Rows
-- are inserted from server actions (grantAccessAction, issueInviteAction,
-- revokeInviteAction, future trading + billing actions) via
-- lib/admin-audit.ts → logAdminAction().

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  actor_email text not null,
  actor_id uuid null,
  action text not null,
  target_kind text not null default 'user',
  target_email text null,
  target_id text null,
  metadata jsonb null,
  ip text null,
  user_agent text null
);

create index if not exists admin_audit_events_ts_desc_idx
  on public.admin_audit_events (ts desc);

create index if not exists admin_audit_events_actor_ts_idx
  on public.admin_audit_events (actor_email, ts desc);

create index if not exists admin_audit_events_target_ts_idx
  on public.admin_audit_events (target_email, ts desc)
  where target_email is not null;

create index if not exists admin_audit_events_action_ts_idx
  on public.admin_audit_events (action, ts desc);

alter table public.admin_audit_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_events'
      and policyname = 'admin_audit_events_deny_public'
  ) then
    create policy admin_audit_events_deny_public
      on public.admin_audit_events
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

comment on table public.admin_audit_events is
  'Immutable admin action log. Insert via lib/admin-audit.ts -> logAdminAction(); read via /admin/audit and /admin/users/<id>. Never UPDATE or DELETE rows by hand.';
```

Click **Run** (or Cmd+Enter / Ctrl+Enter).

## Step 3 — Verify

Run these probe queries one at a time:

```sql
-- 1. table exists with expected shape
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'admin_audit_events'
order by ordinal_position;
```

Expected: 11 rows (id, ts, actor_email, actor_id, action, target_kind, target_email, target_id, metadata, ip, user_agent).

```sql
-- 2. indexes are in place
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'admin_audit_events';
```

Expected: 5 entries (the pkey + 4 named indexes).

```sql
-- 3. RLS is on and the deny-public policy exists
select policyname, permissive, cmd from pg_policies
where schemaname = 'public' and tablename = 'admin_audit_events';
```

Expected: 1 row, `admin_audit_events_deny_public`, `RESTRICTIVE`, `ALL`.

```sql
-- 4. table is empty (no spurious rows)
select count(*) from public.admin_audit_events;
```

Expected: 0.

## Step 4 — Final report

Return as:

```
## Migration 032 — admin_audit_events
- Table created: yes / no
- Column count: <n>
- Index count: <n>
- RLS enabled with deny-public policy: yes / no
- Initial row count: <n>
- Any error messages from Run: <verbatim>
```

---

## Boundaries

- DO NOT click "Reset database" / "Drop table" / "Run with elevated privileges" or anything destructive.
- DO NOT paste anything other than the SQL above into the editor.
- DO NOT run any other migration files in the same session.
- If the migration fails partially (table created but indexes missing, or vice versa), STOP and report — don't try to clean up by hand.
- If the SQL editor warns about destructive operations, STOP and confirm with the user.
- This migration is idempotent — running it twice is safe. If the user wants to re-verify they can run the probe queries again without re-running the create.
