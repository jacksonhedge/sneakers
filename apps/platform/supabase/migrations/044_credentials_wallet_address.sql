-- Add wallet_address column to user_venue_credentials.
--
-- For Polymarket read-only (trio-only) connections: the EOA signer address
-- that owns the CLOB API credentials. Needed to build an address-only signer
-- that satisfies L2 auth (createL2Headers only calls getSignerAddress — no
-- actual wallet signing occurs for L2). Stored plaintext like funder_address
-- since it is not sensitive (it is a public Ethereum address).
--
-- Distinct from funder_address (the proxy/Safe that holds USDC). For most
-- Polymarket users these are different: the EOA (wallet_address) is the
-- owner/controller of the proxy (funder_address).
--
-- Idempotent.

alter table public.user_venue_credentials
  add column if not exists wallet_address text;
