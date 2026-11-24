-- apps/platform/supabase/migrations/054_newsletter_phone_consent.sql
--
-- The Spare Change signup form (/spare-change and /waitlist) asks for three more things:
--   phone             optional, a US number stored as +1 and ten digits (lib/spare-change.ts parsePhone)
--   terms_accepted_at when the person ticked "I agree to the Terms of Service and Privacy Policy"
--                     (null for rows from forms that don't ask, like the Launching soon opt-in)
--   launch_alerts     they ticked "Tell me when the Sneakers app launches"
-- Stored only when a row is new, like the rest of the row.
--
-- Apply before deploying the code that writes them. Safe for the old code: nullable columns and a column
-- with a default.

alter table public.newsletter_waitlist
  add column if not exists phone text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists launch_alerts boolean not null default false;

alter table public.newsletter_waitlist drop constraint if exists newsletter_waitlist_phone_check;
alter table public.newsletter_waitlist
  add constraint newsletter_waitlist_phone_check check (phone is null or phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$');
