# Apply Supabase migration 054 (phone + consent columns for the Spare Change signup) in the SQL Editor

Paste everything below the line into the Chrome agent.

---

You're adding three columns to one table in Jackson's Supabase project, using the SQL Editor in the Supabase dashboard. Jackson is signed in to Supabase in this browser. This only **adds** optional columns. It doesn't delete or change any existing data.

## Hard rules

1. **Run only the two SQL blocks below, exactly as written.** Don't edit them, and don't run any other query.
2. Work only in the project named **Sneakers** (project id `ujfgtkebslesepbjrhyr`). If the page shows a different project, stop and tell Jackson.
3. Don't change any setting, table, policy, key, user or billing page. Don't sign in or type a password or code. If Supabase asks for one, stop and tell Jackson.
4. If Supabase shows a warning or a confirmation you don't understand, stop and send Jackson its exact text instead of confirming.

## Steps

1. Open https://supabase.com/dashboard/project/ujfgtkebslesepbjrhyr/sql/new
2. Check the project name at the top says **Sneakers**.
3. Paste this into the editor, replacing anything already there, then click **Run**:

```sql
alter table public.newsletter_waitlist
  add column if not exists phone text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists launch_alerts boolean not null default false;

alter table public.newsletter_waitlist
  add constraint newsletter_waitlist_phone_check check (phone is null or phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$');
```

4. It should say **Success. No rows returned**.
   - If it says the constraint `newsletter_waitlist_phone_check` **already exists**, the change was already made. That's fine: go on to step 5.
   - Any other error: stop and send Jackson the exact error text.
5. Replace the editor's contents with this check, then click **Run**:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'newsletter_waitlist'
  and column_name in ('phone', 'terms_accepted_at', 'launch_alerts')
order by column_name;
```

6. It should return exactly three rows:
   - `launch_alerts`: boolean, NO, default `false`
   - `phone`: text, YES
   - `terms_accepted_at`: timestamp with time zone, YES

   Take a screenshot of the result.

## What to send back

1. One line: "Migration 054 applied, 3 columns confirmed", or exactly what went wrong.
2. The message Supabase showed after step 3.
3. The three rows from step 5 (or the screenshot).

Then stop. Don't run anything else. Jackson will tell Claude Code to deploy.
