# Apply missing Supabase columns surfaced by 42703 errors

Background: production logs (post Path-A deploy 2026-05-03) show two recurring `code: 42703` (undefined_column) errors against the Supabase project `ujfgtkebslesepbjrhyr`:

1. `[provider-keys] list failed { message: 'column user_provider_keys.label does not exist' }` — fires every ~1m on `/api/settings/api-keys`
2. `[require-tier] waitlist lookup failed — collapsing to free tier { message: 'column waitlist.subscription_status does not exist' }` — fires every ~30s on most authenticated routes; effect is **everyone reads as free tier regardless of actual plan**

Both columns ARE defined in committed migrations (`apps/platform/supabase/migrations/007_stripe_subscriptions.sql` and `009_user_provider_keys.sql`) — they were just never applied to the prod Supabase project. This prompt applies the two specific column adds idempotently.

You're a DB admin doing targeted prod schema work. **Read-only diagnostic first, then ONE targeted write per table.**

## Step 1 — Open the right Supabase project SQL editor

1. Go to `https://supabase.com/dashboard`. Sign in (user handles auth).
2. Project selector → find the project with reference id `ujfgtkebslesepbjrhyr` (NOT Vernacular, SideBet, or CoverPay — those are unrelated Marketplace stores).
3. Left nav → **SQL Editor**. Open a new query tab.

## Step 2 — Diagnostic: confirm columns are missing + check migration drift

Paste and run:

```sql
-- Confirm the two known-missing columns + scan for siblings from the same migrations
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'user_provider_keys' and column_name in ('label', 'verified_at', 'last_used_at', 'updated_at', 'key_preview', 'api_key_encrypted'))
    or (table_name = 'waitlist' and column_name in (
      'subscription_status', 'stripe_customer_id', 'stripe_subscription_id',
      'subscription_current_period_end', 'subscription_cancel_at_period_end',
      'subscription_price_id', 'business_subtype'
    ))
  )
order by table_name, column_name;
```

Report the result rows. Anything present in this list = already applied. Anything missing from the list (compared to the column names in the WHERE clause) = drift from migrations 007 and 009.

If `user_provider_keys` table itself doesn't exist, **stop and report** — that's a bigger problem (migration 009 was never applied at all, not just missing a column).

## Step 3 — Apply migration 007 columns (waitlist Stripe + subscription)

Paste and run:

```sql
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
```

Report:
- Statement count executed (should be 2: ALTER + 4×CREATE INDEX)
- Any errors verbatim
- Time taken

## Step 4 — Apply migration 009 column (user_provider_keys.label)

The full migration 009 creates the table from scratch. If Step 2 confirmed the table exists but is missing `label`, run only the targeted ALTER:

```sql
alter table public.user_provider_keys
  add column if not exists label        text,
  add column if not exists verified_at  timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists key_preview  text,
  add column if not exists api_key_encrypted text;
```

If Step 2 reported the table doesn't exist at all, **stop and ask the user** — running the full migration 009 needs RLS-policy review since it interacts with `auth.uid()`.

Report:
- Statement count executed
- Any errors verbatim

## Step 5 — Verify columns now exist

Re-run the Step 2 query. Confirm the two target columns are now present. Report the new row count.

## Step 6 — Watch for the errors to stop (Vercel logs)

1. Switch to Vercel → sneakers-terminal → Logs → Runtime → filter "42703".
2. Wait 90 seconds (long enough for cron + dashboard polls to fire).
3. Report:
   - Count of `42703` errors in the last 90s — should be **0**
   - Latest 42703 timestamp — should be PRE-step-3 (i.e. older than your migration write)
   - Any NEW error patterns introduced by the schema change

## Report back

```
## Step 2. Diagnostic (pre-fix)
- Rows returned: <N>
- Columns present: <list>
- Columns missing (vs Step 2 WHERE clause): <list>
- Tables exist? user_provider_keys=<y/n>, waitlist=<y/n>

## Step 3. Migration 007 applied
- Statements OK: <count>
- Errors: <NONE | verbatim>

## Step 4. Migration 009 applied
- Statements OK: <count>
- Errors: <NONE | verbatim>

## Step 5. Post-fix diagnostic
- Rows returned: <N>
- subscription_status present: <y/n>
- user_provider_keys.label present: <y/n>

## Step 6. Vercel log silence
- 42703 count in last 90s: <N>
- Latest 42703 timestamp: <…>
- New error patterns: <NONE | list>

## VERDICT
- subscription_status fix: <SUCCESS / FAILED>
- label fix: <SUCCESS / FAILED>
- Migration drift broader concern: <flag if Step 2 showed many missing siblings, suggesting 007/009 weren't the only un-applied migrations>
```
