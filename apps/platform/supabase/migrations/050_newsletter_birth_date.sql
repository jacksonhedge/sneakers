-- apps/platform/supabase/migrations/050_newsletter_birth_date.sql
--
-- The Spare Change Millionaire signup form now asks for a birthday in place of
-- a typed age. birth_date is the date they gave; age_at_signup is still
-- written, worked out by the server from the birthday on the signup day (US
-- Eastern), so everything that reads age_at_signup keeps working unchanged.
--
-- Nullable: rows made before this migration have an age and no birthday.
-- The check only refuses dates that cannot be a birthday at all; the 18+
-- rule stays where it was, on age_at_signup. Same access as the rest of the
-- table: server only (service role), RLS on, no policies.

alter table public.newsletter_waitlist
  add column if not exists birth_date date
  check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= (now() at time zone 'America/New_York')::date));
