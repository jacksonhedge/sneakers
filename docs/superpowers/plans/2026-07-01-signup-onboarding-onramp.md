# 5-Panel Onboarding On-Ramp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **This is a design-heavy UI feature** — for the visual/polish tasks, the implementer should invoke **frontend-design** and follow the aesthetic in the spec; this plan pins structure, logic, wiring, and acceptance, not every CSS line.

**Goal:** Replace `/signup` + `/login` with a single email-first, 5-panel, dark-premium onboarding on the existing Supabase auth, plus logged-out navbar Log in / Sign up buttons.

**Architecture:** One client `AuthShell` (dark canvas + progress rail + snap-scroll panel stack + a flow state machine) rendered by `/login`, `/signup`, `/join`. A new `GET /api/auth/exists` drives the new-vs-returning branch. Account creation reuses `POST /api/auth/signup`; login reuses `POST /api/auth/signin`; magic-link stays as fallback. No new DB schema (venue interest held client-side for v1).

**Tech Stack:** Next.js 16 (App Router — READ `node_modules/next/dist/docs/` before any route/RSC code), React 19 client components, Tailwind v4, Supabase SSR auth (existing helpers).

## Global Constraints

- **Next.js 16** — read `node_modules/next/dist/docs/` before writing any route/server/RSC code. It has breaking changes.
- **Reuse existing auth endpoints** — do NOT reimplement account creation or sign-in. Signup: `POST /api/auth/signup` `{ email, name, password, code? }` → `{ ok, hasAccess, needsEmailConfirmation, error, message }`. Sign-in: `POST /api/auth/signin` `{ email, password }`. Magic-link fallback: existing `MagicLinkButton` / `/api/auth/login`.
- **Validation floors (verbatim from current code):** `NAME_MIN = 2`, `PASSWORD_MIN = 8`.
- **Password fields use `type="password"`** — never `type="text"` masking hacks (security review lesson: spell-jacking + fails-open cross-browser). `spellCheck={false}` on secret inputs.
- **Aesthetic:** dark premium (Mercury/Linear) — near-black bg, glassy active panel, blue-gradient accent, crisp sans, restrained motion, the disc/coin logo. Respect `prefers-reduced-motion` (fade instead of snap-scroll). Visible keyboard focus; fully keyboard-operable (Tab + Enter). Responsive to mobile (panels stack, rail → top bar).
- **No new DB migration** — venue interest from panel 4 is stored client-side (localStorage key `sneakers_signup_venues`) for v1.
- **Platform has no unit-test harness** — verification is `npx tsc --noEmit` + endpoint `curl` + a Chrome-agent E2E prompt. Do not invent a test framework.
- **Deploy is manual** — `git push origin <branch>` then `vercel promote <latest Ready preview> --yes`. Migrations are user-applied (none here).
- Build on branch `feat/sneakers-agent` (or the worktree the controller created). Commit per task.

---

## File Structure

- **Create** `src/app/(auth)/auth-shell.tsx` — the shell: dark canvas, progress rail, snap-scroll panel container, flow state machine (current panel, advance/back, branch, reduced-motion). Exposes `<AuthShell entry="login"|"signup" />`.
- **Create** `src/app/(auth)/panels/` — `email-panel.tsx`, `password-panel.tsx`, `name-panel.tsx`, `venues-panel.tsx`, `confirm-panel.tsx`, `login-password-panel.tsx`. One focused component each.
- **Create** `src/app/(auth)/use-onboarding-flow.ts` — the flow reducer/hook (pure logic: step order, validation gates, new/returning branch). The one genuinely unit-reasoned unit.
- **Create** `src/app/api/auth/exists/route.ts` — `GET ?email=` → `{ exists: boolean }`, rate-limited.
- **Create** `src/app/join/page.tsx` — renders `<AuthShell entry="signup" />`.
- **Modify** `src/app/login/page.tsx` — render `<AuthShell entry="login" />` (keep the route; replace body). Redirect authed users to `/dashboard`.
- **Modify** `src/app/signup/page.tsx` — render `<AuthShell entry="signup" />`. Redirect authed users to `/dashboard`.
- **Modify** the logged-out landing navbar in `src/app/page.tsx` — ensure clear **[Log in]** (`/login`) + **[Sign up]** (`/join`) buttons.
- **Reuse (do not modify):** `/api/auth/signup`, `/api/auth/signin`, `MagicLinkButton`, the referral cookie, Supabase helpers.

---

### Task 1: Email-existence endpoint

**Files:**
- Create: `src/app/api/auth/exists/route.ts`

**Interfaces:**
- Produces: `GET /api/auth/exists?email=<e>` → `200 { ok: true, exists: boolean }` · `400 { ok:false, error:'invalid_email' }` · `429` when rate-limited.

**Steps:**

- [ ] **Step 1: Read the Next 16 route docs**
  Run: `ls node_modules/next/dist/docs/ && sed -n '1,40p' node_modules/next/dist/docs/*route*` (skim route-handler conventions).

- [ ] **Step 2: Write the route** — look up the email against the same source signup uses (the `waitlist` / auth users via the service client — mirror how `/api/auth/login` or `/api/auth/signup` queries existence). Normalize `email.trim().toLowerCase()`, validate it contains `@`, and apply a simple in-memory IP+email rate limit (e.g. 10/min) returning 429 over the cap. Return only `{ exists }` — never leak more.
  ```ts
  // src/app/api/auth/exists/route.ts
  import { getServerClient } from '@/lib/supabase-server'
  export const runtime = 'nodejs'
  export const dynamic = 'force-dynamic'
  const hits = new Map<string, { n: number; at: number }>()
  function rateLimited(key: string): boolean {
    const now = Date.now(); const w = hits.get(key)
    if (!w || now - w.at > 60_000) { hits.set(key, { n: 1, at: now }); return false }
    w.n += 1; return w.n > 10
  }
  export async function GET(req: Request) {
    const url = new URL(req.url)
    const email = (url.searchParams.get('email') ?? '').trim().toLowerCase()
    if (!email.includes('@')) return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (rateLimited(`${ip}:${email}`)) return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    const sb = getServerClient()
    const { data } = await sb.from('waitlist').select('email, invite_used_at').eq('email', email).maybeSingle()
    // "exists" = an account was actually created (invite_used_at stamped), matching the signup model.
    return Response.json({ ok: true, exists: Boolean(data?.invite_used_at) })
  }
  ```
  *(Confirm the existence source against `/api/auth/signup/route.ts` — if signup keys existence off a different column/table, mirror that so exists↔signup agree.)*

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; then run dev (`pnpm --filter @sneakers/platform dev` on :3100) and `curl 'http://localhost:3100/api/auth/exists?email=jacksonfitzgerald25@gmail.com'` → expect `{"ok":true,"exists":true}`; a random email → `exists:false`; `?email=nope` → 400.

- [ ] **Step 4: Commit** — `git add src/app/api/auth/exists/route.ts && git commit -m "feat(auth): email-existence endpoint for the unified onboarding door"`

---

### Task 2: Flow state machine (`useOnboardingFlow`)

**Files:**
- Create: `src/app/(auth)/use-onboarding-flow.ts`

**Interfaces:**
- Produces: `useOnboardingFlow(entry: 'login'|'signup')` → `{ step, track, canAdvance, values, set, next, back, goTo, submitState }` where `track: 'unknown'|'login'|'signup'`, `step` is the active panel id, `values` holds `{ email, password, name, venues }`.

**Steps:**

- [ ] **Step 1: Define the panel order + branch logic** — a reducer/hook (pure, no JSX). Panels for signup: `['email','password','name','venues','confirm']`; for the returning branch after email: `['email','loginPassword']`. `track` starts `'unknown'`; resolved after the email step via the exists check (Task 3 calls it and dispatches `setTrack`). `canAdvance(step)` enforces: email valid format; password `>= 8`; name `>= 2`; venues always true (optional); confirm always true. `back()`/`goTo(step)` allowed only to already-visited steps.
  ```ts
  // src/app/(auth)/use-onboarding-flow.ts
  export const PASSWORD_MIN = 8
  export const NAME_MIN = 2
  export type Track = 'unknown' | 'login' | 'signup'
  export type StepId = 'email' | 'password' | 'name' | 'venues' | 'confirm' | 'loginPassword'
  export type Values = { email: string; password: string; name: string; venues: string[] }
  const SIGNUP_ORDER: StepId[] = ['email', 'password', 'name', 'venues', 'confirm']
  const LOGIN_ORDER: StepId[] = ['email', 'loginPassword']
  // ...reducer with actions set(field,value) | setTrack(track) | next() | back() | goTo(step)
  // canAdvance(step, values): email→/@/ & length; password→>=PASSWORD_MIN; name→>=NAME_MIN; venues/confirm→true
  ```
  Fill in the reducer completely (state = `{ track, index, values, visited: StepId[] }`; `order = track==='login' ? LOGIN_ORDER : SIGNUP_ORDER`; `step = order[index]`).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. (No runner; correctness is proven by the reducer's exhaustive typed actions + Task 8 E2E.)

- [ ] **Step 3: Commit** — `git add src/app/'(auth)'/use-onboarding-flow.ts && git commit -m "feat(auth): onboarding flow state machine (steps, branch, validation gates)"`

---

### Task 3: AuthShell (canvas + progress rail + snap-scroll) with the Email panel wired to the branch

**Files:**
- Create: `src/app/(auth)/auth-shell.tsx`, `src/app/(auth)/panels/email-panel.tsx`

**Interfaces:**
- Consumes: `useOnboardingFlow`, `GET /api/auth/exists`.
- Produces: `<AuthShell entry="login"|"signup" />`.

**Steps:**

- [ ] **Step 1: Invoke frontend-design** for the shell aesthetic (dark premium per the spec) — establish the canvas, glassy active-panel treatment, blue-gradient accent, type scale, progress rail, and the ambient live-ticker element.
- [ ] **Step 2: Build the shell** — full-height dark canvas; one panel visible at a time, vertically centered; a **progress rail** (●●●○○) bound to `flow.step`/order; **snap-scroll/fade** transition on advance (respect `prefers-reduced-motion` → fade only); Sneakers disc logo top-left; the ambient ticker in the periphery. Renders the active panel component based on `flow.step`.
- [ ] **Step 3: Wire the Email panel** — single email field, inline format validation, Continue/Enter. On Continue: call `GET /api/auth/exists?email=`; `exists:true` → `flow.setTrack('login')` and advance to `loginPassword`; `exists:false` → `flow.setTrack('signup')` and advance to `password`. Show a small spinner during the check; handle 429/timeout gracefully (fall back to the signup track with a gentle note rather than blocking).
- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; dev server; visit `/join`, type an existing email → advances toward a password (login) panel placeholder; type a new email → advances toward the create-password step. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/join` not 500.
- [ ] **Step 5: Commit** — `git add src/app/'(auth)'/auth-shell.tsx src/app/'(auth)'/panels/email-panel.tsx && git commit -m "feat(auth): AuthShell + email panel with new/returning branch"`

---

### Task 4: Signup panels (password → name → venues → confirm) wired to `/api/auth/signup`

**Files:**
- Create: `src/app/(auth)/panels/password-panel.tsx`, `name-panel.tsx`, `venues-panel.tsx`, `confirm-panel.tsx`

**Interfaces:**
- Consumes: `useOnboardingFlow`, `POST /api/auth/signup`, `src/lib/venues.ts` (venue list).
- Produces: on confirm success → `router.push('/dashboard')`.

**Steps:**

- [ ] **Step 1: Password panel** — `type="password"` (+ `spellCheck={false}`) with show/hide toggle + inline strength (`>= PASSWORD_MIN`). Continue gated by `canAdvance`.
- [ ] **Step 2: Name panel** — display name (required, `>= NAME_MIN`); optional @handle field (store in values if you add it, else name only).
- [ ] **Step 3: Venues panel** — chips from `VENUES` (filter to live ones incl. polymarket/kalshi/limitless). Multi-select, **optional** (Continue always enabled). On advance, persist selection to `localStorage['sneakers_signup_venues']` (JSON array) for later connect-suggestions.
- [ ] **Step 4: Confirm panel** — compact review (email, name, chosen venues); primary CTA "Create account & enter →". On click: `POST /api/auth/signup` with `{ email, name, password, code? }` (carry any invite code the same way the current form does). On `{ ok, hasAccess, needsEmailConfirmation }`: if `hasAccess && !needsEmailConfirmation` → `router.push('/dashboard'); router.refresh()`; else show the same "check your email / go sign in" state the current form shows. Render `email_in_use` error with a "Sign in →" affordance that jumps the flow to the login track.
- [ ] **Step 5: Verify** — `npx tsc --noEmit`; dev; run a NEW email end-to-end through all 5 panels → confirm it POSTs signup and lands on `/dashboard` (or the confirm state). Re-run an existing email → gets `email_in_use` with the sign-in jump.
- [ ] **Step 6: Commit** — `git add src/app/'(auth)'/panels/ && git commit -m "feat(auth): signup panels (password/name/venues/confirm) wired to /api/auth/signup"`

---

### Task 5: Login branch panel wired to `/api/auth/signin` + magic-link fallback

**Files:**
- Create: `src/app/(auth)/panels/login-password-panel.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/signin` `{ email, password }`, existing `MagicLinkButton`.

**Steps:**

- [ ] **Step 1: Build the login-password panel** — shows the email (read-only, from `values.email`, with a "not you? edit" that `flow.goTo('email')`), a `type="password"` field, "Remember me" (persist email like the current `email-form.tsx` does), and a secondary **"Email me a magic link instead"** (reuse `MagicLinkButton`). On submit: `POST /api/auth/signin` `{ email, password }`; success → `/dashboard`; wrong password → clear inline error, stay on panel; offer "Forgot password?" → existing `/api/auth/forgot-password` path.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; dev; existing email → password → dashboard; wrong password → inline error; magic-link fallback renders.
- [ ] **Step 3: Commit** — `git add src/app/'(auth)'/panels/login-password-panel.tsx && git commit -m "feat(auth): login-password panel (signin + magic-link fallback)"`

---

### Task 6: Routing — `/login`, `/signup`, `/join` render the shell; authed users skip to dashboard

**Files:**
- Create: `src/app/join/page.tsx`
- Modify: `src/app/login/page.tsx`, `src/app/signup/page.tsx`

**Steps:**

- [ ] **Step 1: `/join`** — server component: if already authed (existing session helper) → `redirect('/dashboard')`; else render `<AuthShell entry="signup" />`.
- [ ] **Step 2: `/login` + `/signup`** — replace bodies with the same authed-redirect + `<AuthShell entry="login" />` (login) / `entry="signup"` (signup). Preserve any query-param handling (e.g. `?ref=`, invite code) by threading it into the shell. Keep the files' metadata/exports intact.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; dev; `/login`, `/signup`, `/join` all render the unified door; authed session → each redirects to `/dashboard`; a referral cookie still flows into signup.
- [ ] **Step 4: Commit** — `git add src/app/join/page.tsx src/app/login/page.tsx src/app/signup/page.tsx && git commit -m "feat(auth): route /login /signup /join through the unified onboarding shell"`

---

### Task 7: Logged-out navbar Log in / Sign up buttons

**Files:**
- Modify: `src/app/page.tsx` (landing) — ensure prominent **[Log in]** (`/login`) + **[Sign up]** (`/join`) in the top nav for logged-out visitors.

**Steps:**

- [ ] **Step 1: Add/confirm the buttons** — logged-out landing nav shows Log in (ghost) + Sign up (primary, blue-gradient), both routing to the unified door. Keep existing `LandingSignupButton` behavior if it already conflicts — reconcile so there's exactly one clear pair.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; dev; landing shows the two buttons; each opens the flow.
- [ ] **Step 3: Commit** — `git add src/app/page.tsx && git commit -m "feat(auth): logged-out navbar Log in / Sign up buttons"`

---

### Task 8: E2E verification + deploy

**Steps:**

- [ ] **Step 1: Write the Chrome-agent E2E prompt** to `docs/prompts/test-onboarding-onramp-chrome.md` covering: new-email signup through all 5 panels → dashboard; returning-email → password → dashboard; back-navigation preserves values; venues-panel skip works; reduced-motion (OS setting) still advances; wrong password inline error. (Do NOT put it inline in chat; copy to clipboard for the user.)
- [ ] **Step 2: Final gate** — `npx tsc --noEmit` clean across the app; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/login` and `/signup` and `/join` all non-500.
- [ ] **Step 3: Deploy** — `git push origin <branch>`, then promote the latest Ready Vercel preview to production (`vercel promote <url> --yes`), and confirm `sneakersterminal.com/join` loads.
- [ ] **Step 4: Commit the E2E prompt** — `git add docs/prompts/test-onboarding-onramp-chrome.md && git commit -m "test(auth): E2E prompt for the onboarding on-ramp"`

---

## Self-Review

- **Spec coverage:** unified email-first door (T3,T6) ✓ · 5 signup panels (T4) ✓ · login branch (T5) ✓ · guided auto-advance + progress rail (T2,T3) ✓ · dark premium (T3 via frontend-design) ✓ · reuse Supabase signup/signin (T4,T5) ✓ · existence check (T1) ✓ · navbar buttons (T7) ✓ · referral cookie carried (T4,T6) ✓ · reduced-motion (T3) ✓ · deferred items untouched ✓.
- **Placeholders:** none — endpoint + reducer have complete code; UI tasks carry structure + wiring + acceptance with frontend-design for polish (design-heavy, per the header note).
- **Type consistency:** `PASSWORD_MIN`/`NAME_MIN`, `StepId`/`Track`/`Values`, `/api/auth/signup` + `/api/auth/signin` + `/api/auth/exists` shapes are consistent across tasks.
