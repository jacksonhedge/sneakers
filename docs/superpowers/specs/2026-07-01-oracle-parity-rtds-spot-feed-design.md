# Oracle Parity — RTDS Chainlink Spot Feed for the Sneakers Agent

**Date:** 2026-07-01
**Status:** Approved design, pre-implementation
**Topic:** Fix the highest-risk open item from `2026-06-25-sneakers-crypto-bot-terminal-design.md` — the dry-run agent's spot feed doesn't match Polymarket's actual settlement oracle.

---

## Problem

The Sneakers Agent's paper-trading loop (`apps/agent-worker`) compares a live BTC spot price against Polymarket's market-implied probability to find last-second mispricing on 5/15-min BTC up/down windows. Today, `LiveSpotFeed` (`apps/agent-worker/src/feeds/live.ts`) sources that spot price from **Coinbase's public REST API** (Hyperliquid as fallback), polled every 5 seconds.

That is not what Polymarket actually resolves against. Confirmed directly from a live market's own description via the Gamma API:

> "The resolution source for this market is information from Chainlink, specifically the BTC/USD data stream available at https://data.chain.link/streams/btc-usd."

Chainlink Data Streams is a distinct, low-latency oracle product — not the classic on-chain price feed, and not Coinbase spot. Any mismatch between our feed and this oracle means our simulated P&L reflects a different reality than what Polymarket would actually settle, making the paper track record untrustworthy regardless of how well the signal math performs.

This was flagged as the design's single highest technical risk and left unresolved (design doc, "Open decisions / risks," item 1). This spec resolves it.

---

## Design

### 1. `ChainlinkRtdsSpotFeed` — new spot feed implementation

New file: `apps/agent-worker/src/feeds/rtds-spot-feed.ts`.

Implements the existing `SpotFeed` interface unchanged:
```ts
interface SpotFeed {
  spot(): number
  recentVolPerSec(): number
}
```
No changes needed to `AgentLoop`, `SpotHistorySource`, or the `RefPriceSource` contract — this is a drop-in replacement at the construction site in `run-dryrun.ts`.

Behavior:
- On `prefetch()`/construction, opens a persistent WebSocket connection to `wss://ws-live-data.polymarket.com` (Polymarket's public Real-Time Data Socket — no API key required for crypto prices, per Polymarket's own developer docs).
- Subscribes to / filters incoming messages for the Chainlink-sourced `btc/usd` symbol (Chainlink-source messages use slash-separated symbols per the RTDS docs, distinct from the Binance-sourced `btcusdt` messages on the same socket).
- Updates an internal cached `{ price, receivedAtMs }` on every matching message — push-based, not polled.
- `spot()` returns the cached price synchronously, same contract as today.
- Exact subscribe/message wire format isn't fully documented publicly — confirm empirically by connecting and logging raw frames before finalizing the parser (Step 1 of implementation, not a blocking research task).

This file is kept separate from `live.ts` rather than added to `LiveSpotFeed` because it owns a fundamentally different lifecycle (persistent connection + reconnect/backoff state) versus simple cached REST polling — mixing the two would blur one file's responsibility.

### 2. Fallback — compose, don't replace

`ChainlinkRtdsSpotFeed` wraps an internal `LiveSpotFeed` instance (the existing Coinbase/Hyperliquid implementation) rather than duplicating that logic. If:
- the websocket disconnects, or
- no matching message has arrived within a staleness threshold (10s, matching the existing `SPOT_CACHE_TTL_MS` order of magnitude),

then `spot()` transparently returns the wrapped `LiveSpotFeed`'s value instead, while a background reconnect loop (exponential backoff) tries to restore the websocket.

Every sample handed to `SpotHistorySource.record()` is tagged with its source (`'chainlink-rtds' | 'fallback'`) so degraded periods are visible in logs rather than silently blended into the same series. This tag is for observability only — it does not change `SpotHistorySource`'s stored/returned value shape.

### 3. Live tick visibility (this session's addition)

Today, `run-dryrun.ts` logs discovered window metadata (external ID, countdown, open/close times) and the raw BTC spot price, but never the actual Polymarket market price. Add, per tick, for each live window:
- current YES price and implied NO price (`1 - yesPrice`) — already fetched internally by `AgentLoop.priceTick()` via `feed.latestYesPrice()`, just not surfaced
- seconds-to-close
- the resulting edge/signal state (side, edge_bps) when the gate evaluates one, or "no edge" otherwise
- which spot source (`chainlink-rtds` vs `fallback`) fed that tick's evaluation

This requires threading a small return value out of `AgentLoop.priceTick()` (or an equivalent callback/observer hook) back to `run-dryrun.ts`'s console logging — `priceTick()` currently computes all of this internally but returns `void`. Keep the loop's core logic unchanged; add a lightweight reporting hook so `apps/platform` (or any future consumer) could reuse the same data later without re-deriving it.

### 4. Automated parity self-check

After `settleTick()` records a window's outcome (`up`/`down`), re-fetch that window's now-closed market from the Gamma API and compare Polymarket's actual resolved outcome against what we recorded. Log:
```
[PARITY-CHECK] window=<externalId> ours=up polymarket=up ✅
```
or a `❌ MISMATCH` line. The exact field(s) Gamma exposes for a resolved market's outcome weren't confirmed in this session (no closed `btc-updown-*` market was available to inspect live) — confirming this shape is the first implementation step for this piece, not a blocker to starting.

### Out of scope
- The official sponsored Chainlink Data Streams API (direct, HMAC-authenticated access) — stays parked as a later upgrade if paper results justify tighter parity guarantees before any real-money consideration.
- Any change to `AgentLoop`'s decision logic, risk gates, or ceilings — this spec only touches the spot data source and observability.
- Persisting to Railway Postgres, deploying the worker, or building any `/agent` UI — separate, later pieces of Plan 2/3.

---

## Testing strategy

- Unit test `ChainlinkRtdsSpotFeed` against a fake WebSocket server (or an injectable socket factory) covering: happy-path price updates, staleness-triggered fallback, reconnect-after-drop, and source tagging — mirrors the existing `live.test.ts` style (`feeds/live.test.ts`).
- Manual empirical validation (not automated CI): run `pnpm dryrun` for a live session, confirm the websocket connects and receives `btc/usd` Chainlink-sourced updates at a reasonable cadence, and let at least a couple of windows settle to observe the `[PARITY-CHECK]` output.
- No changes to `packages/core/src/agent/*` — its existing 90+ unit tests are unaffected since the `SpotFeed`/`RefPriceSource` contracts are unchanged.

---

## Self-review notes
- No placeholders beyond the two explicitly-flagged "confirm empirically during implementation" items (RTDS wire format, Gamma resolved-outcome field) — both are scoped as first implementation steps, not open design questions.
- Scope is contained to `apps/agent-worker/src/feeds/` + a small reporting hook in `loop.ts`/`run-dryrun.ts`; no schema, deploy, or UI changes bundled in.
- Consistent with the parent design doc's Rung 1 posture (dry-run only, no money, no credentials).
