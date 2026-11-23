-- apps/platform/supabase/migrations/051_newsletter_referred_by_name.sql
--
-- The Spare Change Millionaire signup form has an optional "Who referred you?"
-- box that takes a person's name. referred_by_name is that name as typed
-- (trimmed, up to 80 characters, enforced by the route). It is a note for a
-- person to match by hand: it credits nobody on its own. A referral is still
-- counted only through a link (referred_by_code / referred_by_member_id).
-- Same access as the rest of the table: server only, RLS on, no policies.

alter table public.newsletter_waitlist
  add column if not exists referred_by_name text
  check (referred_by_name is null or char_length(referred_by_name) between 1 and 80);
