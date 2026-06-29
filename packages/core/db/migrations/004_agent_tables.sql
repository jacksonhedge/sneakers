-- 004_agent_tables.sql — Sneakers Agent (dry-run) state

CREATE TABLE IF NOT EXISTS short_windows (
  id              BIGSERIAL PRIMARY KEY,
  venue           TEXT NOT NULL,
  asset           TEXT NOT NULL,
  interval_sec    INTEGER NOT NULL,
  external_id     TEXT NOT NULL,
  opens_at        TIMESTAMPTZ NOT NULL,
  closes_at       TIMESTAMPTZ NOT NULL,
  reference_oracle TEXT NOT NULL,
  open_ref_price  DOUBLE PRECISION,
  settle_ref_price DOUBLE PRECISION,
  outcome         TEXT,                    -- 'up' | 'down' | NULL
  status          TEXT NOT NULL DEFAULT 'upcoming',  -- upcoming|live|settled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue, external_id)
);
CREATE INDEX IF NOT EXISTS short_windows_status_idx ON short_windows (status, closes_at);

CREATE TABLE IF NOT EXISTS short_bot_configs (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  mode                TEXT NOT NULL DEFAULT 'dry_run',   -- dry_run|live
  sim_deposit_usdc    DOUBLE PRECISION NOT NULL DEFAULT 2000,
  sim_liquidity_usdc  DOUBLE PRECISION NOT NULL DEFAULT 500,
  risk_preset         TEXT NOT NULL DEFAULT 'balanced',  -- bunker|cautious|balanced|aggressive|max
  assets              TEXT[] NOT NULL DEFAULT ARRAY['BTC'],
  enabled_venues      TEXT[] NOT NULL DEFAULT ARRAY['polymarket','kalshi'],
  paused              BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS short_signals (
  id              BIGSERIAL PRIMARY KEY,
  window_id       BIGINT NOT NULL REFERENCES short_windows(id),
  kind            TEXT NOT NULL DEFAULT 'last_second_mispricing',
  side            TEXT NOT NULL,            -- YES|NO
  edge_bps        INTEGER NOT NULL,
  market_prob     DOUBLE PRECISION NOT NULL,
  implied_prob    DOUBLE PRECISION NOT NULL,
  seconds_to_close INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS short_trades (
  id              BIGSERIAL PRIMARY KEY,
  bot_config_id   BIGINT NOT NULL REFERENCES short_bot_configs(id),
  window_id       BIGINT NOT NULL REFERENCES short_windows(id),
  signal_id       BIGINT REFERENCES short_signals(id),
  mode            TEXT NOT NULL DEFAULT 'dry_run',
  side            TEXT NOT NULL,            -- YES|NO
  size_usdc       DOUBLE PRECISION NOT NULL,
  entry_price     DOUBLE PRECISION NOT NULL,
  settle_price    DOUBLE PRECISION,
  pnl_usdc        DOUBLE PRECISION,
  status          TEXT NOT NULL DEFAULT 'open',  -- open|won|lost
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_config_id, window_id)         -- one trade per bot per window
);
CREATE INDEX IF NOT EXISTS short_trades_status_idx ON short_trades (status);
