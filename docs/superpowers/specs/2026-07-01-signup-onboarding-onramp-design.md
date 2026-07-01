# Sign-up / Login On-Ramp — 5-Panel Premium Onboarding (Design)

**Date:** 2026-07-01
**Status:** Approved design, ready for implementation plan.
**Scope:** Phase 1 of the paper-first onboarding vision — the polished auth on-ramp only.
**Deferred to later specs:** Phase 2 (browsable read-only terminal), Phase 3 (guest paper quick-bet engine + migrate-on-signup).

---

## Vision (context)

Sneakers is **O'Toole-powered micro-betting**: fund a little, place quick/small/frequent bets on short-interval crypto (5/15-min up/down), get fast results, with O'Toole as the edge. The onboarding is the **on-ramp** to that loop — it must be **fast, premium, and minimal-friction**, and its copy should sell the model, not read as a generic form.

## Goal

Replace the current `/signup` + `/login` pages with a single **email-first, 5-panel, dark-premium onboarding** on the existing Supabase auth. Login and signup share one door. Fewer keystrokes to a created account than today, but a dramatically more premium feel.

## Non-goals (this spec)

- No compliance data (US state / geo-check) at signup — it moves to the future **fund / go-real** step where it's legally required.
- No invite-friends / affiliate CTAs / location step (the rest of `ONBOARDING_V2_PLAN.md`) — deferred.
- No read-only browsable terminal or paper-trading engine — separate specs.

---

## The flow

**Unified email-first door.** One full-height dark canvas rendered at **both `/login` and `/signup`** (shared component; the URL only tweaks a hint line). Also reachable at a neutral `/join` alias. The flow:

```
PANEL 1 · EMAIL (shared)
  "Your email"  → Continue
     │  POST /api/auth/exists (rate-limited)
     ▼
  ┌── RETURNING (account exists) ──┐   ┌── NEW (no account) ─────────────┐
  │ PANEL 2R · PASSWORD            │   │ PANEL 2 · CREATE PASSWORD       │
  │  → signInWithPassword          │   │ PANEL 3 · NAME / @handle        │
  │  → /dashboard                  │   │ PANEL 4 · WHAT YOU TRADE (opt)  │
  │  (secondary: "email me a link")│   │ PANEL 5 · CONFIRM & ENTER       │
  └────────────────────────────────┘   │  → create account → /dashboard  │
                                        └─────────────────────────────────┘
```

- **Signup = 5 panels:** email → create password → name/@handle → what you trade → confirm & enter.
- **Login = 2 panels:** email → password (branches after the shared email step).

## The 5 signup panels

1. **Email** — single field. Validate format. On Continue: existence check → branch.
2. **Create password** — single field + inline strength (reuse existing `PASSWORD_MIN`). Show/hide toggle. `type=password` (secure; no spell-jack/masking hacks — see the security lesson from the credentials wizard).
3. **Name / @handle** — display name (and optional handle). Required: name.
4. **What you trade** — chips for the live venues (Polymarket, Kalshi, Limitless, …). **Optional/skippable** — Continue works with zero selected. Persists as venue *interest* (pre-seeds which venues to surface/suggest connecting later). Light version of onboarding-v2 `/platforms`; no affiliate CTAs here.
5. **Confirm & enter** — compact review (email, name, chosen venues) + a single primary CTA "Create account & enter →". On success → `/dashboard`.

## Interaction model — guided auto-advance

- Continue / **Enter** validates the current field → smooth **snap-scroll** to the next panel.
- **Progress rail** (●●●○○) shows position; **back allowed** (click a completed dot or scroll up to edit); **cannot advance past an invalid/empty required field**. Panel 4 is optional, so Continue always works there.
- `prefers-reduced-motion`: disable snap-scroll animation; present the active panel with a simple fade, keep the same step logic.

## Aesthetic — dark premium (Mercury / Linear)

- Deep near-black background, **glassy panel** for the active step, a **subtle blue gradient accent**, crisp sans type scale, restrained motion.
- The Sneakers **disc/coin logo** top-left; a **quiet ambient live-ticker** (BTC 5m ▲/▼ …) in the periphery to reinforce "this is a live-markets product" without distracting.
- One panel visible at a time, vertically centered; the progress rail pinned to the side. Fully responsive down to mobile (panels stack, rail becomes a top bar). Visible keyboard focus; the flow is fully keyboard-operable (Tab + Enter).

## Copy (sells the vision)

Micro-copy carries the story — e.g. Panel 1: *"Let's get you into the markets."* · Password: *"Lock it down."* · What-you-trade: *"Where do you want to play?"* · Confirm: *"You're in — O'Toole's ready."* Voice: fast, confident, a little playful; never generic "Enter your credentials."

---

## Technical shape

- **Routing:** a shared `AuthShell` client component rendered by `/login`, `/signup`, and `/join` (all three point to it; the entry URL sets an initial hint only). Old page bodies replaced/redirected.
- **Components:** `app/(auth)/auth-shell.tsx` (dark canvas + progress rail + snap-scroll panel container + advance/back logic + reduced-motion) and one lean component per panel (`EmailPanel`, `PasswordPanel`, `NamePanel`, `VenuesPanel`, `ConfirmPanel`, plus `LoginPasswordPanel`). Keep each panel focused (own file if it grows).
- **Existence check:** `GET /api/auth/exists?email=` → `{ exists: boolean }`, **rate-limited**. This enables the new/returning branch. *Tradeoff accepted per the chosen "email-first door" model (reveals whether an email is registered); mitigate with rate-limiting + generic errors elsewhere.*
- **Auth (reuse existing Supabase):**
  - Signup: create the user + set password + stamp the `waitlist` row (`invite_used_at`, referral/invite cookie carried into the create call — preserve current behavior). Then session → `/dashboard`.
  - Login: `signInWithPassword`. Secondary "email me a magic link" on the password panel as a fallback (note: magic-link still depends on Resend; **password is the primary reliable path** — this design removes the hard Resend-for-login dependency `PLAN_SIGNUP_LOGIN.md` flagged).
  - Existing session on load → skip straight to `/dashboard`.
- **"What you trade" persistence:** store selected venue IDs as interest on the account at creation (reuse the existing venue id set / a lightweight profile field). Held in component state through the flow, written on account create. No new heavy schema.
- **Navbar:** add **[Log in] [Sign up]** buttons for logged-out state (both → the unified door). (The broader logged-out browsable-terminal work is Phase 2 — this spec only adds the buttons.)

## Edge cases

- Invalid email format (block Continue with inline error).
- Email exists → returning branch (password); doesn't exist → signup branch.
- Password below min length (inline strength, block Continue).
- Back-navigation preserves already-entered values.
- Referral / invite cookie carried into account creation (existing `/r/[code]` cookie).
- Already-authenticated user hitting `/login` or `/signup` → redirect to `/dashboard`.
- Reduced-motion path (fade instead of scroll).
- Wrong password on login → clear inline error, stay on the password panel.

## Testing

- **Happy path (new):** all 5 panels → account created → lands on `/dashboard`.
- **Happy path (returning):** email → password → `/dashboard`.
- **Validation:** cannot advance past an empty/invalid required field; panel 4 advances with zero selected.
- **Back + value preservation** across panels.
- **Referral cookie** carried to the created account.
- **Reduced-motion** rendering.
- **Chrome-agent E2E** prompt saved to `docs/prompts/` (not inline).

## Files (anticipated)

- New: `app/(auth)/auth-shell.tsx` + panel components; `app/api/auth/exists/route.ts`; `/join` route.
- Modified: `app/login/page.tsx`, `app/signup/page.tsx` (render the shell / redirect), the navbar component (add logged-out Log in / Sign up), account-creation call site (carry venue interest).
- Reuse: Supabase auth helpers, `waitlist` model, referral cookie, `PASSWORD_MIN`.
