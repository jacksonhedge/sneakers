-- Allow 'moonshot' (Kimi) as a BYO-key provider.
-- The app-side AIProvider union gained 'moonshot' for Kimi K3; without this
-- the upsert in provider-keys.ts violates the CHECK and BYO keys can't save.

alter table public.user_provider_keys
  drop constraint if exists user_provider_keys_provider_check;

alter table public.user_provider_keys
  add constraint user_provider_keys_provider_check
  check (provider in ('anthropic', 'openai', 'google', 'xai', 'moonshot'));
