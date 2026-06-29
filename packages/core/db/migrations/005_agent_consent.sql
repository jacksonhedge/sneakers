-- 005_agent_consent.sql — Legal consent tracking for agent execution

CREATE TABLE IF NOT EXISTS agent_consents (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL,
  version         TEXT NOT NULL,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_consents_user_accepted_idx
  ON agent_consents (user_id, accepted_at DESC);

ALTER TABLE short_bot_configs
  ADD COLUMN IF NOT EXISTS live_enabled BOOLEAN NOT NULL DEFAULT false;
