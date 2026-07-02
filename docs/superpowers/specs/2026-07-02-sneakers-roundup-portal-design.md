# Sneakers Round-Up Portal — Spare-Change Round-Up Demo (Wallet-Move Default, Polymarket Secondary)

**Status:** Approved 2026-07-02, ready for implementation planning.
**Repo:** `sneakers-trading` (moved here from an earlier Hedge-site-scoped draft — see History).
**Delivery:** local dev server first (`pnpm dev` in `apps/platform`), interactive, so you can click
through and decide what's next before anything ships publicly.

## Goal

A true spare-change round-up portal: a user connects their bank, configures a round-up rule, and
from then on their round-ups are tracked and automatically put to work. Three stages, in order:

1. **Connect bank** — real Stripe Financial Connections (test mode).
2. **Round-up tracking** — a rule (round-to, multiplier, threshold — **$5.00 default**, weekly
   cap) applied to transactions; live accrual + activity feed.
3. **Payment facilitation** — once accrued round-ups hit $5, that amount is automatically
   processed. Default: swept into the user's wallet. Secondary mode (not default): routed into a
   Polymarket position that an admin pre-configures, using Sneakers' existing trading
   infrastructure. See "Facilitation" under Screens for the full breakdown.

## Repo / architecture decision (this session)

Originally scoped against the Hedge Payments site (`HedgePayments/website`) with a from-scratch
Privy wallet + Polymarket integration. Moved to `sneakers-trading` instead, because:

- Real, working Polymarket credentials + CLOB client already exist here
  (`apps/platform/src/lib/autotrade/polymarket.ts`, `packages/core/src/polymarket/`) — no need to
  build wallet/trading infra from scratch.
- The repo has an established convention for exactly this kind of thing: public, no-login
  interactive demo pages at the top level (`chance-demo`, `chart-demo`, `horse-race-demo`,
  `leaderboard-demo`, `rolling-demo`), separate from the authed `dashboard/`.
- Stripe is net-new here (no existing Stripe integration in this repo) but that's a contained,
  well-understood piece (Financial Connections, same as the earlier Hedge-site scoping).

New route: `apps/platform/src/app/roundup-demo/` — final route name, matches the repo's `-demo`
convention — public, no Supabase-auth wall, anonymous-session scoped.

## What's real vs. simulated

| Piece | Reality |
|---|---|
| Bank link | **Real** — Stripe Financial Connections, test mode |
| Recent transactions | Real from the linked test account if present; falls back to a seeded deterministic demo feed if the test account has too few transactions |
| Round-up math | Real, pure functions (round-to, multiplier, threshold, weekly-cap clamp) |
| "Wallet" balance | **Demo-scoped** — an anonymous-session balance shown in the portal, credited on facilitation. NOT the real production Sneakers wallet/ledger (`dashboard/wallet`) — this is a no-login demo, so there's no persistent user account to credit. Wiring facilitation into the real wallet is future work if this graduates past demo. |

Polymarket (market data, business credentials, `placeMarketOrder`) is **not used at all in this
build** — wallet-move is the only facilitation mode being shipped. See Non-Goals.

## Screens

1. **Consent/intro** — what this does, in plain language.
2. **Bank link** — Stripe's own hosted Financial Connections UI.
3. **Configure round-up rule** — round-to, multiplier, threshold, weekly cap; live preview.
   **Default threshold: $5.00 aggregated** — once accrued round-ups hit $5, the facilitation step
   fires automatically. User-editable, but $5 is the out-of-the-box default (down from the
   original spec's $10 placeholder).
4. **Activity** — transactions, round-ups accruing, progress bar toward the $5 threshold.
5. **Facilitation** — at the $5 threshold, accrued round-ups automatically sweep into the demo
   wallet balance (see "What's real vs. simulated" above). Confirmation + updated balance shown.
   No market picker, no Polymarket involvement — that's the admin-pre-set-bet mode described under
   Non-Goals, deferred to a later milestone.

## New work

- `apps/platform/src/app/roundup-demo/` (final route name — matches the repo's `-demo` convention) — the interactive page(s), anonymous-session scoped.
- `apps/platform/src/lib/roundup/engine.ts` — round-up math (port from the earlier
  `products/sidebet-roundup/lib/engine.ts` design in the Hedge repo — same pure logic, new home).
- `apps/platform/src/lib/roundup/bank.ts` — Stripe Financial Connections provider (net-new).
- `apps/platform/src/app/api/roundup-demo/*` — session, bank link-token/link-complete,
  transactions, accrue, facilitate (facilitate = credit the demo wallet balance).
- `supabase/migrations/xxxx_roundup_demo.sql` — anonymous-session-scoped: bank link handle,
  round-up rule, accrual state, demo wallet balance.
- `package.json` — add `stripe`.
- Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode, from you).

## Non-Goals (this milestone)

- Polymarket integration of any kind — no market data, no business-credential usage, no
  `placeMarketOrder` calls. The admin-pre-set-bet facilitation mode (round-ups auto-routed into a
  single admin-chosen Polymarket market) is a real, wanted future mode but is explicitly deferred;
  when it's built, the real-vs-simulated order execution question will need an explicit answer
  before any real trade is placed.
- Per-user Privy embedded wallets (dropped — not needed since Polymarket isn't in scope).
- Real ACH pull (round-up "funding" is simulated on the bank side even though the *link* is real).
- Crediting the real production Sneakers wallet/ledger — this demo's "wallet" is session-scoped
  and separate.
- Production KYC/compliance.

## History

- 2026-06-25: original spec, Hedge-site-scoped, multi-site (ProphetX/FanDuel/…) destination model.
- 2026-07-02 (earlier same day): revised to Privy wallet + Polymarket, still Hedge-site-scoped,
  demo-first.
- 2026-07-02 (this doc): moved to `sneakers-trading`, dropped Privy in favor of the existing
  business Polymarket credentials, added the "true portal" 3-stage framing (connect → track →
  facilitate).

---

**Approved 2026-07-02.** Nothing left open for this milestone — Polymarket/admin-preset-bet is a
tracked future mode (see Non-Goals), not a blocker.
