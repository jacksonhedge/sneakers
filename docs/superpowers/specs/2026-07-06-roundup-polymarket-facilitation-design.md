# Round-Up Portal — Polymarket Facilitation Mode (Milestone 2)

**Status:** Draft, pending your review.
**Builds on:** `2026-07-02-sneakers-roundup-portal-design.md` (Milestone 1, shipped — bank connect,
round-up tracking, wallet-move facilitation). This doc covers the **admin-preset-bet mode** that
Milestone 1 explicitly deferred as a Non-Goal.

## Goal

Add a second facilitation mode to the round-up portal: instead of (or alongside) sweeping accrued
round-ups into the demo wallet, route them into a single Polymarket market that an admin
pre-configures — so a user can watch their round-ups accrue and then "check if their round-ups are
going to a winning market" (the original framing for this whole product), with a live
entry-vs-current-price P&L view.

## Decisions made in brainstorming (2026-07-06)

- **Bank connectivity stays test-mode.** Real-bank/live-Stripe connectivity was considered and
  explicitly declined for now — real financial data entering a system built and reviewed under a
  test-mode/simulated assumption is a bigger, separate decision. Not in scope here.
- **Polymarket only** (not a multi-venue Kalshi/etc. picker) — matches the original Milestone 1
  spec's own framing of the deferred mode, and Sneakers already has real, working Polymarket
  integration code (`apps/platform/src/lib/autotrade/polymarket.ts`) to build on for read-only
  price data.
- **Simulated trades, not real ones.** No real Polymarket order is ever placed — round-up sweeps in
  this mode record a simulated position (entry price + size) against live market data, not an
  actual trade against the shared business account. Defaulted to this in the absence of an explicit
  go-ahead on real trade execution, consistent with the "real link, simulated money movement"
  pattern used throughout this feature (Stripe bank-link is real; ACH and wallet crediting are
  simulated) and because real trade execution with shared business funds and no per-user consent
  flow is a materially bigger, separate decision the original Milestone 1 spec flagged as needing
  explicit sign-off before ever happening.
- **One market for everyone, admin-configured, not a per-user picker.** Matches Milestone 1's own
  "Admin pre-set bet" framing: one market routes all users' round-ups until an admin changes it.
- **No admin UI in this pass.** Given the "one market for everyone" simplicity, the admin sets the
  mode and target market via environment variables and restarts the server, rather than building a
  settings page. A proper admin page is a reasonable fast-follow if this needs to change more
  often than a restart allows, but is explicitly out of scope here.

## Architecture

A config switch controls which facilitation mode is active — since it applies globally (not
per-session), this is an environment variable, not a per-user setting:

```
ROUNDUP_FACILITATION_MODE=wallet   # default, Milestone 1 behavior, unchanged
ROUNDUP_FACILITATION_MODE=polymarket
ROUNDUP_POLYMARKET_MARKET_ID=<gamma market id>   # only read when mode=polymarket
```

When `polymarket` mode is active, the existing `/api/roundup-demo/facilitate` route's
threshold/weekly-cap logic (unchanged from Milestone 1 — `thresholdReached`/`transferableCents` from
`@sneakers/core` still gate whether a sweep happens at all) branches at the point where Milestone 1
credits the demo wallet: instead, it fetches the configured market's current live price and records
a simulated position.

**Market data — read-only, no credentials.** Reuses the pattern from
`apps/platform/src/lib/autotrade/polymarket.ts`'s `resolveTokenIds` — a plain, unauthenticated fetch
against the public Polymarket gamma API (`https://gamma-api.polymarket.com/markets/{id}`) for the
current price. No CLOB API trio, no business account credentials, no order placement — this mode
only ever reads public market data.

## Data model

New table, kept separate from Milestone 1's wallet/ledger tables so wallet-mode's data model is
untouched regardless of which mode is active:

```sql
create table roundup_demo_positions (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null references roundup_demo_sessions(session_id) on delete cascade,
  market_id     text not null,
  market_question text,
  entry_price   numeric not null,        -- price (0-1) at the moment of the sweep
  size_cents    integer not null,        -- the swept dollar amount
  opened_at     timestamptz not null default now()
);
```

A session can accumulate multiple positions over time (one per facilitation event), mirroring how
`roundup_demo_ledger` already accumulates multiple wallet-mode sweep events.

## UI change

The Activity screen gains a position card (only rendered when at least one position exists) showing,
per position: the market question, entry price, current live price, size, and unrealized P&L
(`(currentPrice - entryPrice) * size / entryPrice`, signed, colored green/red). The existing
`GET /api/roundup-demo/state` route is extended to include each position's live current price,
fetched server-side against the gamma API at request time (mirroring how `state` already computes
`pendingAccruedCents` fresh on every call) — the client never calls Polymarket directly. This
replaces or sits alongside the existing wallet-balance card depending on which mode was active when
each sweep happened — a session's history could in principle span both modes if the admin flips the
switch mid-flight, so the UI should render whichever event types exist rather than assume one mode
for the whole session.

## Non-Goals

- Real Polymarket order placement or any use of business account trading credentials.
- Real-bank/live-Stripe connectivity (separately declined this session).
- Multi-venue market selection (Kalshi, etc.).
- Per-user market picker or admin settings UI — env-var configuration only.
- Real money movement of any kind, in either facilitation mode.

## Open item

Exact P&L formula sign convention and rounding should be double-checked against
`packages/core`'s existing round-up engine test-style rigor when this is implemented — flagging
here so the implementation plan gives it explicit unit-test coverage rather than leaving it as
inline arithmetic in a route handler.
