-- Phase 1B follow-up — cooldown + reliability circuit breaker for the
-- O'Toole co-pilot's autotrade gates.
--
-- trade_executions has no win/loss or realized-P&L tracking (positions on
-- arbitrary markets can stay open for days before resolving), so this is
-- NOT a loss-streak breaker like the separate BTC agent's. It trips on
-- consecutive execution FAILURES (status = 'error' | 'rejected') instead —
-- protecting against a broken credential, API outage, or bug repeatedly
-- failing, which IS observable in real time.
--
-- Idempotent.

alter table public.autotrade_settings
  add column if not exists cooldown_seconds numeric(10, 0) not null default 60
    check (cooldown_seconds >= 0 and cooldown_seconds <= 86400),
  add column if not exists max_consecutive_failures int not null default 3
    check (max_consecutive_failures >= 1 and max_consecutive_failures <= 20),
  add column if not exists breaker_tripped_at timestamptz,
  add column if not exists breaker_reason text;

comment on column public.autotrade_settings.cooldown_seconds is
  'Minimum seconds between successfully placed (pending/filled) executions before another is allowed.';
comment on column public.autotrade_settings.max_consecutive_failures is
  'Trips the breaker after this many consecutive error/rejected executions in a row (most-recent-first).';
comment on column public.autotrade_settings.breaker_tripped_at is
  'Set when the reliability breaker trips; execute endpoint short-circuits to rejected while set. Cleared via settings reset.';
