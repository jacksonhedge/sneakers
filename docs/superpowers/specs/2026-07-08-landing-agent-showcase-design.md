# Landing Agent Showcase + Auth-Aware Navbar — Design Spec

**Date:** 2026-07-08
**Status:** Approved (design confirmed with Jackson)
**Parent spec:** `docs/superpowers/specs/2026-07-06-agent-experience-design.md`
**Target:** `apps/platform` landing page (`src/app/page.tsx`) + small refactors under `src/app/agent/`

## Goal

Logged-out visitors on sneakersterminal.com can *see and touch* the agent app
without an account; logged-in visitors get a navbar that takes them into the
app instead of marketing links. The signup funnel is untouched for logged-out
users.

## 1. Auth-aware navbar

- `src/app/page.tsx` is already a `force-dynamic` server component. Add a
  `getAuthClient().auth.getUser()` check (same pattern as `dashboard/layout.tsx`;
  fail-soft: any auth error renders the logged-out nav).
- **Logged out:** exactly today's nav — LOG IN + `LandingSignupButton` +
  `LandingMobileNav`. Zero change.
- **Logged in (desktop):** replace with two buttons, same visual language as the
  existing pills: `Dashboard` (ghost ring style, → `/dashboard`) and
  `Open App →` (solid/primary, → `/agent`).
- **Logged in (mobile):** `LandingMobileNav` gains an `authed` variant with the
  same two links in the slide-down panel.
- No balance chip in Phase 1 — the balance is mock data; it joins the navbar in
  Phase 2 when real.
- The hero CTA block: when logged in, the waitlist/signup CTAs are replaced by a
  single `Open App →` button (marketing copy stays).

## 2. "Meet your Agent" section (logged-out AND logged-in)

Placed directly below the hero CTA block, above the existing stats strip.

- **Layout:** two columns ≥900px (copy left, phone right), stacked below
  (copy, then centered phone ~340px wide).
- **Copy (left):**
  - Eyebrow: `MEET YOUR AGENT` (small caps, green `#2FD37A` accent)
  - Headline: `It trades. You watch.`
  - Three one-liners:
    - `Works Bitcoin & crypto up/down markets around the clock — 5 and 15-minute windows on Kalshi and Polymarket.`
    - `Subscribe to better models — or build your own with a plain-English prompt.`
    - `Every trade explained: the signal it saw, or the gate that stopped it.`
  - CTA mirrors auth state: logged out → the existing signup entry
    (`LandingAccess` variant) with `Try the demo →` anchor as secondary;
    logged in → `Open App →` (to `/agent`).
- **Phone (right): live demo of the real app.**
  - iPhone-style frame (rounded ~40px, dark bezel, dynamic-island notch),
    interior = the real agent UI at `#0B0D10`.
  - Badge reads `LIVE DEMO` (green pill, same slot where the app shows PAPER).
  - Tabs: Agent / Models / Balance (Profile excluded — account data is
    meaningless in a demo). In-frame tab bar switches LOCAL state, never routes.
  - Fully interactive: swipe/click orbs, equip, subscribe (+ buttons & sheets),
    Add Agent flow, add cash. State is per-page-load (mock reducer), no
    persistence — refresh resets. That is acceptable and expected.
  - The demo does not poll or fetch; it is the same in-browser mock engine the
    app runs on in Phase 1.

## 3. Mechanics (refactors under `src/app/agent/`, no visual change to the app)

- **View extraction:** move each tab page's body into a view component the
  route page wraps:
  - `components/agent-tab-view.tsx` (from `page.tsx`)
  - `components/models-tab-view.tsx` (from `models/page.tsx`)
  - `components/balance-tab-view.tsx` (from `balance/page.tsx`)
  Route pages become 3-line wrappers (`'use client'; import view; export default`).
  Profile stays as-is (not demoed).
- **Navigation override (one mechanism, no context):** an optional prop
  `onNavigate?: (dest: 'agent' | 'models' | 'balance' | 'profile') => void`
  added to `ModelSheet` and `AddAgentSheet` (sheets carry the prop).
  `TabBar` is untouched except exporting `ORB_ICON`/`MODELS_ICON`; the demo
  renders its own 3-tab bar reusing `.ag-tabbar` styles.
  - When ABSENT (the real app): behavior byte-identical to today — the sheets
    keep their `router.push(...)` calls (the `useRouter()` hook may still be
    called unconditionally — hooks rules — it just goes unused).
  - When PRESENT (the demo): the sheets call `onNavigate(...)` instead of
    `router.push(...)`.
  - The tab views pass the prop through to the sheets they render
    (`models-tab-view` → ModelSheet/AddAgentSheet; `agent-tab-view` → ModelSheet).
- **Demo component:** `components/agent-demo.tsx` (client):
  `AgentProvider` + local `tab` state + phone-frame chrome + `LIVE DEMO` badge
  + the three views + in-frame tab bar wired to local state. Exported for the
  landing; imports `../agent.css`.
- **Landing wiring:** `src/app/meet-your-agent.tsx` (server-compatible wrapper
  with the copy; demo itself is client) rendered from `page.tsx`.

## Constraints

- Logged-out funnel unchanged: LOG IN / SIGN UP rendering and all signup-config
  gating exactly as today when `user == null`.
- Real `/agent` app behavior byte-identical after the view extraction (same
  DOM, same classes, same navigation).
- Demo must not import anything server-side (no Supabase) — mock engine only.
- No "scrape/scraper" in any new copy. Money in tabular numerals. Motion
  respects `prefers-reduced-motion` (inherited from agent.css).
- `agent.css` global-class caveat stands (no collisions verified 2026-07-07);
  `.ag-*` prefixing remains a Phase-2 item.

## Testing

- Existing 15 unit tests unchanged and green; `tsc --noEmit` clean; prod build
  gate.
- QA screenshots: landing logged-out (demo section + unchanged nav) at 430/1280px;
  landing logged-in (swapped nav + Open App hero CTA); `/agent` after refactor
  (identical to before); demo interactions (swipe model, subscribe via +,
  add cash updates in-frame balance tab).

## Out of scope

- Balance chip in navbar (Phase 2, real data).
- Landing brand pivot to agent-first hero (separate decision).
- Any change to `/dashboard`.
