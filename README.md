# Sneakers

**A Bitcoin investment arm — powered by an automatic trading bot.**

Sneakers runs a ~90% automatic **up/down trading bot** on short-interval **Bitcoin** prediction markets (5 / 10 / 15-minute windows). The goal: let anyone grow a portfolio through perpetual, mostly-hands-off exposure to Bitcoin's short-term moves — the bot does the trading, you set the risk.

> **Status:** the deterministic decision core is built and unit-tested (dry-run / paper-trading). Live trading is gated behind a mandatory dry-run proof period. See the design spec and plans under `docs/superpowers/`.

## How it works

- **Markets** — short-interval Bitcoin "up or down" windows (5/10/15-min), aggregated across the only two venues with real trading APIs: **Polymarket** and **Kalshi**. (Coinbase and Robinhood resell Kalshi's orderbook, so integrating Kalshi covers them.)
- **The edge** — a last-second mispricing engine. In the final seconds of a window, if Bitcoin's spot price already implies the outcome but the market hasn't repriced, the bot takes the lagging side.
- **Your dial** — a single **risk preset** (Bunker → Cautious → Balanced → Aggressive → Max) plus a **loss cap**. The bot trades automatically inside those guardrails; layered kill switches and a circuit breaker fail closed.
- **Dry-run first** — every bot paper-trades real live markets against a simulated balance, marked to real settlement, building a genuine track record before any real money.

## Repo layout (pnpm + Turborepo monorepo)

- `apps/platform` — Next.js 16 web app (live at sneakersterminal.com); the Agent dashboard lives here (`/agent`, planned).
- `apps/trader` — market data + analysis scripts.
- `apps/ios` — SwiftUI app.
- `packages/core` — shared core. **The deterministic Agent decision core is at `packages/core/src/agent/`** (window model · 5 risk presets · last-second-mispricing signal · execution gate · dry-run settlement). 44 `node:test` unit tests.
- `docs/superpowers/specs/` — design spec • `docs/superpowers/plans/` — implementation plans • `docs/prototypes/sneakers-agent.html` — interactive UI prototype.

## Develop

```bash
pnpm install
pnpm --filter @sneakers/core test     # Agent-core unit tests (node:test)
pnpm platform                          # run the web app
```

## Roadmap

See `ROADMAP.md`. Immediate next steps: DB schema + live Polymarket/Kalshi/spot feeds + the always-on Railway worker, then the real `/agent` route in `apps/platform`.

---

_Earlier operational tooling (opportunity hunter, market-data logger, calibration analyzers) is documented in `TRACKING_SYSTEM.md` and remains available via the `pnpm` scripts in the root `package.json`._
