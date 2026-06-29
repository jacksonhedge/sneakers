-- 006_agent_audit.sql — Immutable trade audit log

CREATE TABLE IF NOT EXISTS agent_trade_audit (
  id                BIGSERIAL PRIMARY KEY,
  bot_config_id     BIGINT NOT NULL REFERENCES short_bot_configs(id),
  window_id         BIGINT REFERENCES short_windows(id),
  mode              TEXT NOT NULL CHECK (mode IN ('dry_run','live','blocked')),
  side              TEXT NOT NULL,
  requested_usd     DOUBLE PRECISION NOT NULL,
  size_usd          DOUBLE PRECISION,
  blocked_reason    TEXT,
  venue_order_id    TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  filled_usd        DOUBLE PRECISION,
  avg_price         DOUBLE PRECISION,
  raw               JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_trade_audit_bot_created_idx ON agent_trade_audit (bot_config_id, created_at);
