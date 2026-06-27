# Plan — API keys / trading auth across every venue

State: 2026-04-28. Phase 1A (O'Toole strategy scaffold) is done. This doc plans **Phase 1B-onward**: actual wallet + API connectivity per venue, in priority order.

The unifying frame: each venue falls into one of three buckets, and the right move is different per bucket.

---

## Bucket 1 — Real trading APIs (build these first)

These have official, production-grade APIs intended for programmatic trading. Build wallet/auth wiring once per family, reuse across N venues.

### Polymarket (PRIORITY 1)
- **Auth model:** Self-custody EVM wallet on Polygon. API keys are *derived* from an EIP-712 signature off your EOA — you don't get a traditional `key/secret` pair.
- **What you need:** An embedded wallet (vendor TBD — user is researching Privy / Dynamic / Coinbase WaaS / Turnkey / Magic before committing), USDC on Polygon, and the derived API creds.
- **What it lets you do:** CLOB orders (limit + market), positions, fills, market data, allowance management.
- **SDK:** `@polymarket/clob-client` (TS). Mature.
- **First-time UX:** Privy onboarding → fund USDC → sign once → derived keys cached → trade.
- **Already half-built:** `propose_trade` tool in O'Toole writes drafts. Phase 1C connects drafts → execution.

### Kalshi (PRIORITY 2)
- **Auth model:** RSA keypair. You generate the public key in Kalshi's dashboard, save the private key locally, sign every request.
- **What you need:** Kalshi account, KYC, ACH-linked bank account (it's USD, not crypto), RSA keypair generated in their UI.
- **SDK:** `@kalshi/api-client` (community) or roll our own — REST is small.
- **First-time UX:** User pastes their RSA private key into our settings. We sign on their behalf server-side OR do it client-side (privacy preference TBD — see open questions).
- **Different from Polymarket:** No wallet, no crypto, no signing dance — just a key the user pastes.

### Limitless (PRIORITY 3)
- **Auth model:** EVM signing on **Base** (different chain than Polymarket's Polygon).
- **What you need:** Same Privy wallet stack, but funded with USDC on Base.
- **API:** REST + EVM tx submit. AMM-style, not orderbook.
- **Note:** We already have a working scraper for Limitless. Trading is the next step.

### Opinion.trade (PRIORITY 4)
- **Auth model:** REST API key, but the unlock is unusual — see `reference_opinion_api_access` memory: **send <0.1 USDT on BNB Chain to `0x0932a1e…f60e`**, then create a contract-wallet in their app, then receive API key.
- **Default rate limit:** 15 TPS.
- **Manual one-time setup**, then it's just a key.

### NoVig / ProphetX / OG (PRIORITY 5)
- **Auth model:** Standard REST + API key/secret per venue.
- All three are smaller-volume than Polymarket/Kalshi — wire them up after the priority venues are working, not before.
- ProphetX is B2B-flavored — may need a partnership ask.

---

## Bucket 2 — Wrappers (don't integrate directly; route through Bucket 1)

These platforms re-sell Kalshi (or each other) under their own UI. Trading "on Coinbase Predict" or "on Robinhood prediction markets" is actually trading on Kalshi behind the scenes.

- **Coinbase Predict** → Kalshi backend. Use Kalshi API.
- **Robinhood prediction markets** → Kalshi backend. Use Kalshi API.
- **Sleeper picks/markets** → mostly Kalshi-rerouted as of 2026.

**Conclusion:** Don't build separate integrations for these. Show them in the UI as venue cards (per the "wrapper venues as trade destinations" memory) and route the actual order to Kalshi with an affiliate-link tag where applicable.

For **spot crypto on Coinbase** (different product — not prediction markets), that's Coinbase Advanced Trade API with HMAC keys. Out of scope for Sneakers Terminal; we're prediction-markets-first.

---

## Bucket 3 — No real API / hostile API (skip or scrape only)

These are the ones to NOT build trading auth for, even if they look attractive.

- **Robinhood (stocks/crypto/options)** — only `robin_stocks` exists, unofficial, ToS-grey, fragile. They actively break it.
- **DraftKings sportsbook / "Predicts"** — no public trading API. Closed.
- **FanDuel sportsbook / "Predicts"** — no public trading API. Closed.
- **PrizePicks / Underdog (pick'em)** — no public API. Their model isn't even orderbook-compatible.
- **Drift BET (Solana)** — dormant per memory; revisit if catalog reawakens.

For these: keep the scrapers we have (read-only price discovery), surface in the dashboard with affiliate-link "open in app" buttons, NEVER promise programmatic trading. Users place orders in the native app themselves.

---

## Recommended sequencing

1. **Phase 1B — wallet + Polymarket** (next session, blocked on user's wallet-vendor decision)
   - Pick embedded-wallet vendor (user doing own deep dive — see open question 6)
   - Add the chosen embedded wallet
   - USDC-on-Polygon onramp via the chosen vendor's onramp partner
   - Derive Polymarket CLOB key from signature, cache in `user_provider_keys` table (encrypted)
   - Read-only positions endpoint first, before any trading
   - **Done when:** logged-in user can see their Polymarket positions in the dashboard.

2. **Phase 1C — Polymarket execution**
   - "Confirm" button on `trade_drafts` from O'Toole proposes
   - Execution router → CLOB place_order → poll fill → update `trades` table
   - Risk gates: per-trade cap, daily loss cap, max slippage
   - **Done when:** O'Toole proposes, user confirms once, order fills, dashboard shows the fill.

3. **Phase 1D — Polymarket autopilot**
   - Alert rule fires → O'Toole sanity-checks → places order under risk gates
   - **Done when:** an alert can fire end-to-end without human input and respect caps.

4. **Phase 2A — Kalshi**
   - Settings page: "Paste your Kalshi RSA private key" (or generate-and-link flow)
   - Same risk gates, same proposal/confirm/autopilot tiers as Polymarket
   - Decide: server-side signing vs. client-side (open question, see below)

5. **Phase 2B — Limitless + Opinion + NoVig + ProphetX + OG**
   - Each is its own settings tab; same proposal/confirm pattern
   - Order: by user demand. Likely Limitless first (we already scrape it; AMM is simple).

---

## Architecture notes

### `user_provider_keys` table (needs migration)
Stores per-user, per-venue credentials. Columns:
- `user_id`
- `venue` ('polymarket' | 'kalshi' | 'limitless' | 'opinion' | 'novig' | 'prophetx' | 'og')
- `payload_encrypted` (jsonb encrypted with `PROVIDER_KEY_ENCRYPTION_KEY` — already in Vercel env)
- `derived_at`, `last_used_at`, `revoked_at`
- RLS: user reads own; service role writes.

### Encryption key
`PROVIDER_KEY_ENCRYPTION_KEY` is already set in Vercel env (saw it in `vercel env ls` today). Use AES-GCM, store nonce + ciphertext + tag together.

### Execution router (single entrypoint)
```
executeTrade(userId, venue, intent) → fillReport
```
Behind it, per-venue adapters that all share the same `TradeIntent` shape (`size_usd`, `side`, `max_price`, `outcome_id`). Phase 1A's `propose_trade` already writes that shape to `trade_drafts`.

### Risk gates (centralized, applied before per-venue adapters)
- per-trade cap (default $100, configurable per user)
- daily loss cap
- max slippage
- venue allowlist
- max-open-position cap

These belong above the adapter layer so a Kalshi bug can't bypass Polymarket's risk envelope.

---

## Open questions (decide before Phase 1B)

1. **Kalshi RSA key custody** — do users paste their private key into our settings (we encrypt + store), or do they keep it client-side and we ship signing to the browser? Server-side is simpler; client-side is more trust-minimized.
2. **Wallet scope** — Privy embedded only, or offer Privy + WalletConnect (so power users with their own wallet can connect Metamask)? Embedded-only is simpler v1.
3. **Funding flow** — direct USDC purchase via Privy, or require user to bridge from existing wallet? Direct purchase is the friendliest but locks us into Privy's onramp partners and their fees.
4. **Single chain or multi?** — Polymarket=Polygon, Limitless=Base, Opinion=BNB. Embedded wallet must support all three, or we surface "switch chain" UX. Privy supports multi-chain; just need to handle gas tokens per chain.
5. **Order routing UX** — when the same market is on Kalshi+Polymarket+wrapper, do we automatically pick the best price, or always ask the user "which venue"? Lean: show both, let user pick first time, remember preference.
6. **Embedded-wallet vendor** — Privy / Dynamic / Coinbase WaaS / Turnkey / Magic / something else. User is doing their own deep dive before committing. Phase 1B is blocked on this.

---

## What NOT to build

- Don't build Robinhood/DraftKings/FanDuel trading. Surface them as scraped read-only with affiliate "open in app" CTAs.
- Don't build a unified "one click trade everywhere" UI before Polymarket alone is solid. Cross-venue arb-execute is a Phase 3 thing.
- Don't roll your own custody. Privy or similar; the engineering cost of custody is a separate company.
