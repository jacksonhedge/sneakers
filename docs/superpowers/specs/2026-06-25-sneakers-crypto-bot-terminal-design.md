# Sneakers Crypto Bot Terminal — Design Spec

**Date:** 2026-06-25
**Status:** Approved design, pre-implementation
**Topic:** Short-interval crypto prediction-market aggregation + paper-trading bot ("the bot is the product")

---

## Vision

Sneakers specializes in **short-interval crypto price prediction markets** (5, 10, 15, 20-minute windows). The headline product is a **per-user trading bot** that automatically trades these markets within the user's risk rules. The markets terminal/dashboard is *supporting background* — it exists to make the bot's behavior legible and trustworthy, not as a standalone product to sell.

> **"The bot is the product."** Everything else (market data, integrations, the terminal view) is infrastructure that makes the bot legible. This raises the bar on safety; it does not lower it.

### Market reality (researched 2026-06-25)

Short-interval crypto markets exist on only a few venues, and most are resellers of one upstream:

| Platform | Intervals | Tradeable API? | Nature |
|---|---|---|---|
| **Polymarket** | 5M, 15M, 1H, 4H | ✅ CLOB API | Independent on-chain exchange, own liquidity. 5-min BTC ~$60M/day volume. |
| **Kalshi** | 15M, hourly, daily+ | ✅ REST + WebSocket | Independent CFTC exchange, own liquidity. Settles on CF Benchmarks. |
| **Robinhood** | 15M+ | ❌ routes to Kalshi | Distribution channel — same orderbook as Kalshi. No automated-execution API. |
| **Coinbase** | 15M–yearly | ❌ powered by Kalshi | Kalshi front-end (launched Jan 2026). Settles same CF Benchmarks index. |
| **Crypto.com** (OG/CDNA) | mostly sports | ❌ no public trading API | Own CFTC arm, sports-led, crypto short-interval thin. |

**Consequences:**
- Only **two real, independently-tradeable APIs exist: Polymarket + Kalshi.** Integrating those two covers essentially the entire market.
- Robinhood and Coinbase add **no independent prices and no execution path** — they *are* Kalshi underneath. Show them as logos with a "via Kalshi" badge for familiarity/optics, but they are not real integrations.
- **Cross-venue arbitrage (a later phase) only genuinely exists between Polymarket ↔ Kalshi** — the two independent liquidity pools. There is no arb between Kalshi and its resellers.
- **Only Polymarket has true 5-minute markets.** Kalshi's shortest is 15-min, and its windows do not align with Polymarket's 5-min windows. The 5-minute game is single-venue (Polymarket); the 15-minute cadence is where both venues overlap.
- 10-minute and 20-minute markets do **not** currently exist on any venue.

---

## v1 Scope — "watch your paper bot earn"

A **returns-first dashboard** backed by a real aggregation foundation and a dry-run trading bot. No real money, no custody, no KYC, no wallet vendor. The bot paper-trades **real live markets** against a **simulated balance**, marking every trade to real settlement — producing a genuine track record that justifies real money later.

### The main screen (single page)

```
┌─ SNEAKERS ──────────────────────────────────────────┐
│  RETURNS   +$248.10   ▲ +12.4%        [today ▼]      │
│  ┌────────────────────────────────────────────────┐ │
│  │        ╱╲      ╱╲╱   ← cumulative P&L over time │ │
│  └────────────────────────────────────────────────┘ │
│  ACTIONS PERFORMED                                   │
│   14:32  BTC 5M   YES .88   → WON   +$12.00          │
│   14:27  ETH 5M   NO  .91   → LOST  −$9.00           │
│   …                                                  │
│  ──────────────────────────────────────────────────  │
│  RULES                                               │
│   Risk ⚖️ Balanced   ·   Loss cap $150/day           │
│   Deposit $2,000 (sim) · Sources: Polymarket·Kalshi  │
│   ◉ DRY-RUN                              [ Edit ]     │
└──────────────────────────────────────────────────────┘
```

- **Returns** — headline P&L $ + %, with a today / all-time toggle. Sourced from the dry-run ledger.
- **Graph** — cumulative P&L over time.
- **Actions performed** — the bot's trade log; each row marked WON/LOST against real settlement.
- **Rules (bottom, editable)** — the bot config: risk preset, loss cap, simulated deposit/liquidity, enabled sources, dry-run flag.

### In scope
1. **Aggregation layer + Window Tracker** (Railway worker) — ingests live Polymarket (5/15M) + Kalshi (15M) windows, streaming prices.
2. **The returns-first dashboard** (`apps/platform`) — returns / graph / actions / rules, read-mostly.
3. **Signal Engine + dry-run execution** — last-second mispricing runs against the simulated balance; "would-have-placed" trades marked to real settlement → real P&L ledger.
4. **Safety rails from day one** — loss-cap circuit breaker, kill switch, stale-feed auto-halt — exercised even in dry-run.

### Explicitly deferred (clean seams in the design)
- Real deposits / custody / KYC / embedded-wallet vendor
- Live trading (real money)
- Cross-venue arbitrage (Polymarket ↔ Kalshi, 15-min)
- Directional micro-model; market-making / spread capture (needs limit orders)
- iOS remote (status + kill switch)
- 10-/20-minute markets (no venue exists yet)

---

## Architecture

The core insight: a short-interval market is a **clock-driven, single-window lifecycle**, and the edge lives in the final seconds. The system is organized around the *window* and runs on a **persistent worker** — NOT Vercel Cron (minute-granularity, cold starts cannot hit a 5-second-before-close window).

```
PERSISTENT WORKER (Railway service — reuses existing Railway infra)
  Window Tracker → Signal Engine → Execution Gate
        │               │                │
   Venue feeds     Spot/oracle      Order router
   (PM CLOB WS,    feed (same       (simulated in v1;
    Kalshi WS)     Chainlink PM      PM CLOB client later)
                   settles on)
        │
        ▼ writes
   Railway Postgres  ◀── reads ──  Next.js app (apps/platform)
   (windows, signals,              returns dashboard, rules editor
    trades, pnl, bot_configs)
```

### Six units (each one job)
1. **Window Tracker** — discovers every live/upcoming short-interval window per venue, normalizes into the per-window model (open T, close T+interval, asset, reference oracle, venue), schedules wake-ups around each close. The clock is the heartbeat.
2. **Venue feeds** — warm websocket/poll connections to Polymarket CLOB (and Kalshi) streaming live YES/NO prices into each tracked window.
3. **Spot/oracle feed** — fast BTC/ETH price feed. **Critical correctness risk:** must reference the *same* Chainlink high-frequency oracle Polymarket settles against, or the bot is adversely selected on basis differences. Treat as an early spike.
4. **Signal Engine** — for each window in its final seconds, computes implied outcome from spot vs market-implied probability; emits a typed signal when the gap clears threshold. Same `Signal` shape as the Autonomous Bots plan so bots consume it identically.
5. **Execution Gate** — applies per-window cap, per-day cap, max-windows-per-hour, cooldown, and layered kill switches; routes to dry-run (simulate) or live.
6. **Order router** — simulated fill in v1; the existing Polymarket CLOB client (market orders only) wires in for live later.

The Next.js app stays read-mostly: returns dashboard + rules editor. All time-critical logic lives in the worker. App ↔ worker communicate only through Railway Postgres (config writes, status reads) — no direct coupling, worker can restart/redeploy independently.

### Surfaces (where it lives)
| Layer | Where | User does |
|---|---|---|
| Decision + execution | Railway worker (headless) | nothing — invisible infra, runs 24/7 |
| Config + monitoring | `apps/platform` (web) — **primary** | view returns, edit rules |
| Glance + kill | `apps/ios` — **secondary, deferred** | status + kill switch |

---

## Data model (Railway Postgres)

```sql
-- One row per discovered market window, per venue
short_windows (
  id, venue, asset, interval_sec,        -- 'polymarket','BTC',300
  opens_at, closes_at, reference_oracle,
  open_ref_price, settle_ref_price,
  outcome,                                -- 'up'|'down'|null until settled
  status                                  -- upcoming|live|settled
)

-- Live signals from the Signal Engine (shared shape w/ Autonomous Bots)
short_signals (
  id, window_id, kind,                    -- 'last_second_mispricing'
  side, edge_bps, market_prob, implied_prob,
  seconds_to_close, created_at
)

-- Every bot decision: dry-run "would have" + live fills
short_trades (
  id, bot_config_id, window_id, signal_id,
  mode,                                   -- 'dry_run'|'live'
  side, size_usdc, entry_price,
  settle_price, pnl_usdc,                 -- marked at settlement
  status, venue_order_id, created_at
)

-- Per-user bot config (reuses Autonomous Bots bot-config shape)
short_bot_configs (
  id, user_id, enabled, mode,             -- dry_run|live
  sim_deposit_usdc, sim_liquidity_usdc,   -- simulated balance in v1
  risk_preset,                            -- bunker|cautious|balanced|aggressive|max
  assets[], enabled_venues[],
  min_edge_bps, act_window_sec, max_size_usdc,
  per_day_cap_usdc,                       -- loss cap → circuit breaker
  max_windows_per_hour, paused, created_at
)
```

### Window lifecycle (the heartbeat)
```
T-∞   Tracker discovers window        → row created, status=upcoming
T+0   Window opens                    → open_ref_price snapshot, status=live
        Venue feed streams YES/NO prices
T+0..close-ε  Signal Engine watches spot vs market
near close  edge clears threshold     → emit short_signal
        Execution Gate checks caps/kill → dry_run: log "would place"
                                          live:    market order (deferred)
close Window closes                   → settle_ref_price, outcome, status=settled
        All trades for window marked   → pnl computed, dashboard updates
```

Key property: **every dry-run trade gets a real settlement and a real P&L**, because the actual close price is recorded. A week of dry-run produces a genuine track record. `short_trades.mode` lets one bot run dry-run and live side by side without separate tables — clean migration to live. `short_windows` is venue-agnostic (the `venue`/`interval_sec` columns) so adding Kalshi 15-min and cross-venue arb later is new rows, not a schema change.

---

## The edge — last-second mispricing

For a live window we know `open_ref_price` (the price "up/down" is measured against). The spot/oracle feed gives current price. With `S` seconds left:

```
1. gap          = current_spot − open_ref_price
2. implied_prob = P(price stays on this side through next S seconds)
                  → function of `gap` vs realistic movement in S seconds
                    (short-horizon volatility estimate). Clear gap near close ⇒ ~0.99.
3. market_prob  = current YES price on Polymarket
4. edge_bps     = (implied_prob − market_prob) × 10000
5. if edge_bps ≥ min_edge_bps AND S ≤ act_window: take the lagging side
```

Intuition: in the final seconds, if BTC is clearly above its open, "up" is nearly certain — but the market sometimes still shows YES at 0.88 instead of 0.98. The bot buys that lag.

**v1 volatility model:** start **simple and conservative** (recent realized vol over the window). Explainable beats clever for the first money; refine from dry-run data. The whole edge depends on (a) a fast feed referencing the **same oracle the venue settles on** and (b) an honest `implied_prob` so we never overpay.

---

## Rules — 5 risk presets

The user's primary dial is a **risk preset** (plus dollar inputs). Each preset expands into the raw thresholds the Execution Gate enforces. Every rung relaxes every knob in the same direction: act earlier, on smaller lags, bigger, more often.

| Knob | 🛡️ Bunker | 🪨 Cautious | ⚖️ Balanced | 🔥 Aggressive | ⚡ Max |
|---|---|---|---|---|---|
| `min_edge_bps` | 1000 | 750 | 500 | 350 | 200 |
| `act_window_sec` (≤ s to close) | 2 | 4 | 7 | 11 | 20 |
| `max_size_usdc` / window | xs | s | m | l | xl |
| `per_day_cap_usdc` (loss cap) | very low | low | med | high | very high |
| `max_windows_per_hour` | 2 | 4 | 8 | 15 | 30 |

User inputs on the dashboard: **simulated deposit, simulated liquidity** (how much of the deposit is live vs held back), **risk preset**, **loss cap**, and **enabled sources** (Polymarket / Kalshi). Names are renameable; actual `max_size`/`per_day_cap` dollar values are tuned in dry-run, not hardcoded.

---

## Safety (carries over the autotrade brief's posture)

- **Kill switches, layered (any one halts):** per-bot `paused`, per-user enable, **admin global kill**, and an **auto-halt circuit breaker** (trips on stale spot feed, venue disconnect, N consecutive losses, or daily-loss-cap breach). Fails **closed**.
- **Dry-run proof gate:** every bot starts in `dry_run`. Live unlocks only after a minimum period **AND** a minimum count of settled dry-run trades (a quiet week must not false-pass). User reviews the ledger, explicitly flips to live. (Live itself is deferred past v1.)
- **Loss cap = hard stop:** `per_day_cap_usdc` breach trips the circuit breaker for the day.
- **Tiering (when live ships):** dry-run = free/low-tier on-ramp (the hook). Live trading = the core paid feature at the bot's own tier (Terminal-level, *not* Business-only) — the bot is the product, so live execution is the product, not a locked corner.
- **Legal/TOS:** extends `docs/autotrade-tos-checklist.md` (high-frequency crypto disclaimer, not investment advice, user is principal) before any live trading.

---

## Testing strategy

- **Window Tracker / Signal Engine** — unit tests with synthetic windows + recorded spot-tick fixtures (deterministic: feed a price path, assert the signal). TDD here.
- **Execution Gate** — unit-test every cap + kill switch exhaustively (protects real money later).
- **Order router** — integration test against Polymarket testnet/dry-run; never live in CI.
- **End-to-end** — replay harness runs a recorded day of windows through the worker in accelerated time, checks dry-run P&L. Doubles as the backtester for the vol model.

---

## Path to live (rungs)

- **Rung 0 — Demo live (~1 day):** deploy the static mockup (`docs/prototypes/sneakers-agent.html`) to a URL (`/agent`) so the vision is showable. No backend.
- **Rung 1 — Paper-live (THIS BUILD):** real market data, simulated balance. **No money, no KYC, no funding checks, and no per-user API keys** — dry-run only *reads* public/house-level market data and *simulates* fills. New infra = the Railway worker; auth/dashboard already exist.
- **Rung 2 — Real-money, non-custodial:** user connects their own Polymarket/Kalshi account (the connect modal); funding check = read their own venue balance via the **existing** `GET /api/balance` adapters + `user_venue_connections` schema (migrations 034–036) + credential wizard. No KYC burden on Sneakers (the venue KYC'd them). Gated behind TOS update + dry-run proof gate + kill switches.
- **Rung 3 — Custodial:** Sneakers holds funds → KYC + custody + money-transmission + counsel. Parked.

### Data access (Rung 1)
Dry-run needs **one Sneakers-level service connection per venue** for ingestion (Kalshi requires an account key even to read market data; Polymarket market data is public) — **not** per-user keys. The connect modal / per-user credentials are a Rung 2 concern.

### Minimal onboarding (Rung 1)
Sign in (existing Supabase magic-link) → pick a risk preset (Bunker → Max) → set simulated deposit + loss cap → bot starts paper-trading. Three taps, zero friction, no payment/KYC surface.

## Open decisions / risks to resolve in planning

1. **Oracle parity (highest technical risk):** confirm the exact Chainlink high-frequency feed Polymarket settles 5-min BTC on, and source a matching low-latency spot feed. Spike this first.
2. **Dry-run proof bar:** exact period + min-settled-trades count before live unlocks (live is post-v1, but define it now).
3. **Risk-preset dollar values:** the `max_size` / `per_day_cap` ladders — set after seeing live data.
4. **Kalshi 5-min absence:** v1 left-panel/markets show Kalshi only at 15M; confirm UX for mixed intervals across venues.
