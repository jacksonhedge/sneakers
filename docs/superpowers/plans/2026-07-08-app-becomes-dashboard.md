# App Becomes the Dashboard (Redesign Phase 1+2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logging into sneakersterminal.com lands you in the agent app — now with a desktop rail layout and a real-data **Markets** tab (minute strike ladders + cross-venue browser) and a real-data **Profile** — with `/dashboard` redirecting into it and the legacy screens reachable from Profile until fully absorbed.

**Architecture:** The `/agent` app gains an adaptive shell (bottom tab bar <900px, left icon rail ≥900px — scoped by a shell-only modifier class so the landing phone demo is untouched). A new `/agent/markets` route is a SERVER page (valid under the client provider via the layout's children slot) that loads real data through the existing `loadMinuteMarkets` and the just-fixed `loadMarketsPage`, rendered by agent-skinned client views. Profile becomes a server page with real account data plus link-out rows to not-yet-absorbed legacy settings. `/dashboard` (home only) 307s to `/agent`; the old home moves to `/dashboard/legacy`.

**Tech Stack:** Next 16 App Router, React 19, existing `agent.css` token system, `src/lib/minute-markets.ts` + `src/lib/markets-data.ts` (server-only), Supabase auth via `getAuthClient()`.

**Spec:** `docs/superpowers/specs/2026-07-08-app-first-redesign.md` (Phases 1+2 subset; Phase 0 items 2–3 — autotrade chip contradiction + landing polish — are tracked separately in the ledger and NOT in this plan)
**Functional contract:** `docs/audits/2026-07-08-live-site-audit.md`

## Global Constraints

- Branch `feat/sneakers-agent` is SHARED. Stage exact files only — never `git add -A`. Kill only your own dev-server PIDs. If :3000 is busy, let Next pick a port.
- The landing phone demo (`agent-demo.tsx`) must be pixel-unchanged: all new desktop-shell CSS is scoped under `.agent-shell` (added ONLY by `AgentFrame`), never bare `.agent-app`.
- Never "scrape/scraper" in user copy — "live prices", "live data". Money/percent in `.ag-num`. `prefers-reduced-motion` respected. PAPER badge semantics unchanged (agent orb/balance are still mock; Markets/Profile show REAL data and carry NO paper badge — they're live info).
- Tab order everywhere: Agent · Markets · Models · Balance · Profile.
- Server-only data modules (`minute-markets.ts`, `markets-data.ts`, `supabase-auth`) may be imported ONLY in server components (route `page.tsx` files) — never into `'use client'` files.
- Commit prefixes: `feat(agent-web):` for app files, `feat(dashboard):` for the redirect/legacy move.
- Gates per task: `pnpm --filter @sneakers/platform exec tsc --noEmit` clean; `pnpm --filter @sneakers/platform test` (18 tests) green; visual verification = headless-Chrome/standalone-Playwright screenshots at 430px AND 1280px, READ every screenshot. `AGENT_PREVIEW=1 pnpm platform` for authed-route QA. Final task runs the prod build.
- All commands from repo root `/Users/jeremyalbus/sneakers-trading`.

---

### Task 1: Adaptive shell — desktop rail, 5-tab nav, demo untouched

**Files:**
- Modify: `apps/platform/src/app/agent/agent.css` (append shell block)
- Modify: `apps/platform/src/app/agent/components/agent-frame.tsx`
- Modify: `apps/platform/src/app/agent/components/tab-bar.tsx`
- Create: `apps/platform/src/app/agent/components/rail.tsx`

**Interfaces:**
- Consumes: existing `TabBar` (Link-based), `useAgent()` (balance number), icons in `tab-bar.tsx`.
- Produces: `NAV_ITEMS` exported from `tab-bar.tsx` — `{ href: string; label: string; icon: React.ReactNode }[]` of FIVE entries (Agent `/agent`, Markets `/agent/markets`, Models `/agent/models`, Balance `/agent/balance` [icon slot rendered specially], Profile `/agent/profile`) — consumed by both `TabBar` and `Rail`. `<Rail />` component. `AgentFrame` renders `.agent-app.agent-shell` wrapping `<Rail />` + `<main className="agent-main">` + `<TabBar />`.

- [ ] **Step 1: Add a MARKETS icon + export NAV_ITEMS from `tab-bar.tsx`.** Insert after `MODELS_ICON`:

```tsx
export const MARKETS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />
  </svg>
)
```

Replace the `tabs` array construction inside `TabBar` with a module-level export the Rail can share (the Balance entry's live number still needs the hook, so `NAV_ITEMS` carries a `balance: true` marker instead of the icon):

```tsx
export const NAV_ITEMS: { href: string; label: string; icon?: React.ReactNode; balance?: boolean }[] = [
  { href: '/agent', label: 'Agent', icon: ORB_ICON },
  { href: '/agent/markets', label: 'Markets', icon: MARKETS_ICON },
  { href: '/agent/models', label: 'Models', icon: MODELS_ICON },
  { href: '/agent/balance', label: 'Balance', balance: true },
  { href: '/agent/profile', label: 'Profile', icon: PROFILE_ICON },
]
```

Inside `TabBar`, map over `NAV_ITEMS`, rendering for the balance entry `<span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span>` and `t.icon` otherwise. Keep `aria-current`, classes, and Link semantics exactly as today.

- [ ] **Step 2: Create `components/rail.tsx`:**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAgent } from '../lib/store'
import { formatMoneyWhole } from '../lib/format'
import { NAV_ITEMS } from './tab-bar'

// Desktop-only left rail (shown ≥900px via CSS; TabBar shows below).
export function Rail() {
  const path = usePathname()
  const { state } = useAgent()
  return (
    <nav className="ag-rail" aria-label="Primary">
      <div className="ag-rail__brand ag-num">S</div>
      {NAV_ITEMS.map(t => (
        <Link key={t.href} href={t.href}
          aria-current={path === t.href ? 'page' : undefined}
          className={'ag-rail__item' + (path === t.href ? ' ag-rail__item--on' : '')}>
          {t.balance
            ? <span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span>
            : t.icon}
          <span className="ag-rail__label">{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: `agent-frame.tsx`** — add the shell class and the rail:

```tsx
'use client'
import { TabBar } from './tab-bar'
import { Rail } from './rail'

export function AgentFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="agent-app agent-shell">
      <Rail />
      <main className="agent-main">{children}</main>
      <TabBar />
    </div>
  )
}
```

- [ ] **Step 4: Append shell CSS to `agent.css`** (every selector prefixed `.agent-shell` so the demo is untouched; also REMOVE the old bare `@media (min-width: 700px) { .agent-app { max-width: 430px; ... } }` rule and re-add it scoped to `.agent-shell` as shown — the demo neutralizes it inline anyway, but scoping ends that hack's necessity for future consumers):

```css
/* ---- adaptive shell (app only — never the landing demo) ---- */
.agent-shell .ag-rail { display: none; }
@media (min-width: 700px) and (max-width: 899px) {
  .agent-shell { max-width: 430px; margin: 0 auto; border-left: 1px solid var(--ag-border); border-right: 1px solid var(--ag-border); }
}
@media (min-width: 900px) {
  .agent-shell { display: grid; grid-template-columns: 88px 1fr; max-width: none; margin: 0; border: none; }
  .agent-shell .ag-tabbar { display: none; }
  .agent-shell .agent-main { max-width: 1080px; width: 100%; margin: 0 auto; padding: 24px 40px 40px; }
  .agent-shell .ag-rail {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 18px 10px; border-right: 1px solid var(--ag-border);
    position: sticky; top: 0; height: 100dvh;
  }
  .ag-rail__brand {
    width: 40px; height: 40px; border-radius: 12px; background: var(--ag-green);
    color: var(--ag-surface); font-weight: 800; font-size: 18px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 14px;
  }
  .ag-rail__item {
    width: 68px; padding: 10px 0 8px; border-radius: 14px; text-decoration: none;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    color: #fff; font-size: 10px; font-weight: 600; letter-spacing: .01em;
  }
  .ag-rail__item svg { width: 24px; height: 24px; }
  .ag-rail__item:hover { background: #14181d; }
  .ag-rail__item--on { color: var(--ag-green); background: #12161b; }
  .ag-rail__item:focus-visible { outline: 2px solid var(--ag-green); outline-offset: -2px; }
}
```

Also find the EXISTING rule `@media (min-width: 700px) { .agent-app { max-width: 430px; margin: 0 auto; border-left...; border-right...; } }` near the top of the file and DELETE it (its replacement is the scoped 700–899px rule above). Then in `agent-demo.tsx`, the inline `style={{ minHeight: 0, border: 'none', maxWidth: 'none' }}` on the frame div can drop `border`/`maxWidth` (keep `minHeight: 0`) — update it to `style={{ minHeight: 0 }}`.

- [ ] **Step 5: Verify** — tests (18) green, tsc clean. `AGENT_PREVIEW=1 pnpm platform`; screenshots READ: `/agent` at 430px (unchanged: bottom tab bar, now FIVE items — confirm fit; if cramped, labels stay but confirm no overflow), `/agent` at 1280px (rail left with S brand + 5 items, content centered, NO bottom bar), `/` at 1280px (landing demo phone pixel-identical — CRITICAL check), `/agent/markets` 404s for now (route comes in Task 2 — acceptable this task; rail link may 404 until then).

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/agent/agent.css apps/platform/src/app/agent/components/agent-frame.tsx apps/platform/src/app/agent/components/tab-bar.tsx apps/platform/src/app/agent/components/rail.tsx apps/platform/src/app/agent/components/agent-demo.tsx
git commit -m "feat(agent-web): adaptive shell — desktop rail, five-tab nav"
```

---

### Task 2: Markets tab v1 — minute strike ladders (real data)

**Files:**
- Create: `apps/platform/src/app/agent/markets/page.tsx` (server)
- Create: `apps/platform/src/app/agent/components/markets-minute-view.tsx` (client)
- Create: `apps/platform/src/app/agent/components/auto-refresh.tsx` (client)

**Interfaces:**
- Consumes: `loadMinuteMarkets({ within, asset, grouped: true, cryptoOnly: true })` from `@/lib/minute-markets` (server-only; returns `MinuteMarketsResult` with `groups: MinuteGroup[]` — READ `src/lib/minute-markets.ts` lines 46–100 first for the exact `MinuteMarket`/`MinuteGroup` fields and copy the same yes-price derivation the legacy page uses at `src/app/dashboard/minute/page.tsx` ~line 59).
- Produces: `MarketsMinuteView({ groups, within, asset, generatedAt }: { groups: SerializedGroup[]; within: number; asset: string | null; generatedAt: string })` where `SerializedGroup` is the plain-JSON shape passed from the server page (define it in the view file and export it; the page imports the type from the view).

- [ ] **Step 1: `markets/page.tsx`** — server component (auth comes from the agent layout):

```tsx
import { loadMinuteMarkets } from '@/lib/minute-markets'
import { MarketsMinuteView } from '../components/markets-minute-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Markets — Sneakers' }

const WITHINS = [5, 15, 30, 60, 120, 240]

export default async function AgentMarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ within?: string; asset?: string }>
}) {
  const sp = await searchParams
  const within = WITHINS.includes(Number(sp.within)) ? Number(sp.within) : 60
  const asset = sp.asset?.trim() || null
  const result = await loadMinuteMarkets({ within, asset: asset ?? undefined, grouped: true, cryptoOnly: true })
  // Serialize to the plain shape the client view needs (READ the actual
  // MinuteGroup/MinuteMarket fields in src/lib/minute-markets.ts and map
  // 1:1 — group title/asset/resolve time, and per market: platform, strike
  // label/question, direction, yes price, volume, market URL if present).
  return (
    <MarketsMinuteView
      groups={serializeGroups(result)}
      within={within}
      asset={asset}
      generatedAt={new Date().toISOString()}
    />
  )
}
```

(`serializeGroups` lives in this file; write it against the real fields after reading `minute-markets.ts` — every field the view renders must be explicitly mapped, no passing of class instances/Dates: convert dates to ISO strings.)

- [ ] **Step 2: `components/markets-minute-view.tsx`** — agent-skinned client view. Layout: `ag-apphead` with brand `Markets` (NO paper badge — real data; instead a `.ag-badge ag-badge--test`-styled chip reading `LIVE` in green tint `rgba(47,211,122,.14)`/`#2FD37A` — add a tiny `.ag-badge--live` rule to agent.css in this task); window chips row (5m/15m/30m/1h/2h/4h as `mchip`s, active = `mchip--on`, each a `<Link href={...?within=N}>`); asset filter chips from the groups present (All + each asset); one `.ag-card` per group: header row (asset + group title + resolve countdown via `generatedAt`-anchored client countdown), then strike rows (`.ag-row` per market: platform tile reusing `VENUE_META`-style colored square [Kalshi/Polymarket colors; for other sources render a neutral `#3a444d` tile with 2-letter abbr], strike/question text, direction, YES price in `.ag-num` green, volume subdued). Footer line: `Updated <relative time> · refreshes every 30s`. Empty state: card with `No {asset ?? 'crypto'} markets in the next {within} minutes.` Include the full component code in the implementation — build it from these requirements; every datum listed in the audit for /dashboard/minute (platform/strike/direction/yes-price/volume, group resolve countdown, window+asset filters, summary counts) must render. Δ5m column may be omitted ONLY if the serialized data lacks it — check `minute-markets.ts`; if the field exists, render it sign-colored (`ag-pos`/`ag-neg`).
- [ ] **Step 3: `components/auto-refresh.tsx`** — honest refresh (fixes the audit's staleness bug class for this surface):

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, everyMs)
    return () => clearInterval(id)
  }, [router, everyMs])
  return null
}
```

Render `<AutoRefresh />` from the view.

- [ ] **Step 4: Verify** — tsc + 18 tests green. Dev server (`AGENT_PREVIEW=1`): screenshot `/agent/markets` at 430px and 1280px, READ: chips row, ≥1 group card with strike rows and live YES prices (real DB data — if the local env lacks POSTGRES_URL the loader falls back; note honestly what data source rendered), rail/tab-bar highlights Markets. Click a window chip (screenshot URL changes to ?within=15 and content updates).
- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/agent/markets apps/platform/src/app/agent/components/markets-minute-view.tsx apps/platform/src/app/agent/components/auto-refresh.tsx apps/platform/src/app/agent/agent.css
git commit -m "feat(agent-web): Markets tab v1 — minute strike ladders on live data"
```

---

### Task 3: Markets tab v2 — cross-venue browser segment

**Files:**
- Modify: `apps/platform/src/app/agent/markets/page.tsx`
- Create: `apps/platform/src/app/agent/components/markets-all-view.tsx` (client)

**Interfaces:**
- Consumes: `loadMarketsPage(filter)` from `@/lib/markets-data` (server-only; JUST FIXED — see `marketsPageOrderBy`; returns `{ markets: MarketSnapshot[]; total; availablePlatforms; perBook; dataDate; fromDb }`). READ the `MarketSnapshot` shape in `src/lib/markets-data.ts` (top of file) before writing the serializer.
- Produces: `MarketsAllView({ rows, total, page, sort, platform, platforms }: …)` — same serialize-in-page pattern as Task 2.

- [ ] **Step 1: Extend `markets/page.tsx`** with a `view` search param: `?view=all` renders the cross-venue browser, default renders the minute view. For `all`: parse `page` (int ≥1), `sort` (`volume|overround|resolves_at|updated`), `platform`; call `loadMarketsPage({ page, pageSize: 50, sort, platform })`; serialize rows to `{ id, question, platform, yesPrice (from the market's first/YES outcome — reuse the derivation pattern in markets-listing-body.tsx / market-card.tsx, read them), volume, resolvesAt, overround }`.
- [ ] **Step 2: Both views get a shared segmented control** (reuse `.ag-seg` classes) at the top of the Markets tab: `Minute | All markets` — each side a `<Link>` (`/agent/markets` vs `/agent/markets?view=all`).
- [ ] **Step 3: `markets-all-view.tsx`** — sort chips (Volume/Overround/Resolves/Updated as Links), platform filter chips from `platforms`, list of `.ag-card` rows (venue tile, question 2-line clamp, YES price `.ag-num`, volume, resolves-in), pagination footer (`Prev`/`Next` Links preserving params, `Page X of ceil(total/50)` in `.ag-num`). Empty + `fromDb:false` states render an honest notice (`Live database unavailable — showing cached data` when fromDb is false and rows exist; empty card otherwise).
- [ ] **Step 4: Verify** — tsc/tests; screenshots of `/agent/markets?view=all` both widths READ (rows with real questions/prices, sort chip toggles order, pagination present when total>50). Confirm in dev logs that no `[db] query failed` line with `missing FROM-clause` appears (regression proof for the 6e6dce8 fix on the exact production query path).
- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/agent/markets/page.tsx apps/platform/src/app/agent/components/markets-all-view.tsx
git commit -m "feat(agent-web): Markets tab v2 — cross-venue browser on the fixed page query"
```

---

### Task 4: Profile with real account data + legacy link-outs

**Files:**
- Rewrite: `apps/platform/src/app/agent/profile/page.tsx` (becomes a SERVER component)
- Create: `apps/platform/src/app/agent/components/profile-view.tsx` (client, presentational)

**Interfaces:**
- Consumes: `getAuthClient()` from `@/lib/supabase-auth` (server). Plan/subscription: READ `src/app/dashboard/profile/page.tsx` first and reuse EXACTLY its data-fetch pattern for plan/verification/referrals (whatever helpers it calls — mirror them; do not invent new queries). Sign-out: find the dashboard's existing sign-out control (grep `signout|signOut` under `src/app/dashboard` and `src/app/auth`) and reuse the same route/action.
- Produces: `ProfileView({ email, name, plan, sections })` — client component; `sections` is data-driven rows so the server page owns all copy.

- [ ] **Step 1:** Server page fetches: user email/name (auth), plan line, verification status, referral counts — mirroring `dashboard/profile`'s fetches. Compose `sections`:
  - `Your plan` → current plan + `Manage → /dashboard/billing`
  - `Trading venues` → keep the current three-venue status rows (Kalshi/Polymarket connected, ProphetX soon) PLUS a row `All connections (44 venues) → /dashboard/connections`
  - `Trading controls` → rows linking `/dashboard/legacy` (`Master switch & autotrade`, note: route exists after Task 5 — coordinate: this task may land the link pointing at `/dashboard` which Task 5 turns into `/dashboard/legacy`; use `/dashboard/legacy` and note it 404s until Task 5 merges, acceptable within the same plan), `/dashboard/settings/autotrade` (`Wallet & execution`), `/dashboard/strategies`, `/dashboard/alerts`
  - `AI` → `/dashboard/settings/otoole` (`O'Toole co-pilot`), `/dashboard/settings/api-keys` (`API keys`)
  - `Student` → verification status + `/dashboard/profile` (`Classic profile`)
  - Sign out (real, reusing the found mechanism).
- [ ] **Step 2:** `ProfileView` renders the account card (initials from email/name — no hardcoded identity: audit bug list), plan card, then `sections` as `.ag-card`s of `.conn`-style rows with `→` affordances (external-feeling rows get `ag-linkish` "Open" buttons). All rows are `<Link>`s. Demo/PAPER caveat line under the plan card: `Agent balance and trades are demo data until live trading opens.` (resolves audit bug 3's messaging at the account surface).
- [ ] **Step 3: Verify** — tsc/tests; `AGENT_PREVIEW=1` screenshots both widths READ: real email rendering (in preview mode auth is bypassed — the page must handle `user == null` by rendering `Not signed in` placeholders rather than crashing; verify that state renders), every link row navigates (spot-check two).
- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/agent/profile apps/platform/src/app/agent/components/profile-view.tsx
git commit -m "feat(agent-web): Profile — real account data + legacy settings link-outs"
```

---

### Task 5: /dashboard → app redirect; legacy home preserved

**Files:**
- Create: `apps/platform/src/app/dashboard/legacy/page.tsx` (receives the old home's content)
- Modify: `apps/platform/src/app/dashboard/page.tsx` (becomes a redirect)

**Interfaces:**
- Consumes: the CURRENT contents of `src/app/dashboard/page.tsx` (the old home — master switch, autotrade panel, strike ladders, perps). READ it fully first; it stays inside the dashboard layout either way.

- [ ] **Step 1:** Move the old home: copy `dashboard/page.tsx`'s entire component (and any colocated imports that are relative to the route dir — check for `./` imports; they resolve from `dashboard/` so the moved file's relative imports must be adjusted `../`) into `dashboard/legacy/page.tsx`, title `Classic dashboard — Sneakers Terminal`.
- [ ] **Step 2:** Replace `dashboard/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

// The app IS the dashboard now (spec: 2026-07-08-app-first-redesign.md).
// The classic home lives at /dashboard/legacy until its remaining jobs
// (master switch, autotrade panel) are absorbed into the app.
export default function DashboardHome() {
  redirect('/agent')
}
```

- [ ] **Step 3:** Sub-route survival check: `/dashboard/minute`, `/dashboard/markets`, `/dashboard/settings/*`, `/dashboard/connections`, `/dashboard/billing`, `/dashboard/strategies`, `/dashboard/alerts`, `/dashboard/profile`, `/dashboard/legacy` must all still render (they live under the dashboard layout, unaffected by the home redirect). Screenshot `/dashboard/legacy` and two sub-routes to confirm; screenshot that hitting `/dashboard` lands on `/agent`.
- [ ] **Step 4:** Landing navbar: in `src/app/page.tsx` the authed `DASHBOARD` pill now duplicates `OPEN APP →`. Change its href to `/dashboard/legacy` and label to `CLASSIC` (keep styling) — the app is the primary destination, classic stays one click away.
- [ ] **Step 5: Verify** — tsc/tests; screenshots READ per Step 3; confirm no dashboard sub-route regressed.
- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/dashboard/page.tsx apps/platform/src/app/dashboard/legacy apps/platform/src/app/page.tsx
git commit -m "feat(dashboard): /dashboard redirects to the app; classic home at /dashboard/legacy"
```

---

### Task 6: Living orb v2 — ChatGPT-voice-grade aliveness

**Files:**
- Modify: `apps/platform/src/app/agent/agent.css` (rework the `.orb` motion block)
- Modify: `apps/platform/src/app/agent/components/orb.tsx` (only if extra layer divs are needed)

**Direct user requirement (verbatim intent):** "I want the ball of the agent to look like the ball that ChatGPT's voice is — a lot looking alive." The current orb (two counter-rotating blurred radial layers + scale breathing) reads as a textured sphere; the target reads as a living, billowing blob.

**Design requirements:**
1. **Morphing silhouette** for emoji/plain orbs: animate `border-radius` through organic asymmetric values (e.g. `58% 42% 55% 45% / 52% 60% 40% 48%` → several keyframes → back), slow (9–14s), applied to blob+swirl+sheen wrappers together so the whole ball undulates. LOGO orbs (`orb--oddsjam`, `orb--gambly`) KEEP a perfect circle silhouette (a morphing logo looks broken) — inner motion only.
2. **Billowing light, not rotation**: replace/augment the rotating swirl with 3 independent light pools that WANDER (keyframed translate+scale drift on different durations/easings, e.g. 7s/11s/17s alternating directions) so no repeating rotational pattern is perceivable; use the per-color `--o1`/`--o2` vars; blur + `mix-blend-mode` as today.
3. **Life pulse**: gentle saturation/brightness oscillation (`filter: saturate()/brightness()` keyframes ±8%, ~6s) layered with the existing breathing scale when `.orb--live`; non-live orbs still morph/billow but slower and dimmer (multiply durations ~1.6× via a `--orb-tempo` custom property rather than duplicate keyframes).
4. **States preserved**: `.orb--paused` freezes ALL new animations + grayscale (extend the existing paused selector list); `state-entering` quickens tempo (shorter durations via `--orb-tempo`), `state-holding` slows; `prefers-reduced-motion` disables every new animation (extend the existing media block).
5. **Performance budget**: CSS transforms/filter/border-radius only (GPU-composited), no JS rAF, no canvas/WebGL, max 4 animated layers per orb — the landing page renders ~7 orbs simultaneously (carousel + grid in demo) and must stay smooth; verify no jank by eye in the recording (below).
6. Everywhere automatically: carousel, grid cells, sheets, landing demo all reuse the same component/classes — zero call-site changes expected.

- [ ] **Step 1:** Implement per the six requirements (author the keyframes; use `--orb-tempo: 1` on `.orb`, `.75` on `state-entering`, `1.5` on `state-holding`, and `calc()`-multiplied `animation-duration`s).
- [ ] **Step 2:** tsc + tests green (no TS surface expected unless layer divs added).
- [ ] **Step 3: Visual verify like you mean it** — dev server; RECORD the orb: capture 6–8 sequential screenshots of `/agent` at ~1.5s intervals and READ them side by side — the silhouette and inner light must be visibly DIFFERENT across frames (that's the aliveness test); repeat once for a grid orb on `/agent/models` and once inside the landing demo; confirm logo orbs stay circular; confirm paused freezes (toggle Pause, take 2 frames, identical).
- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/agent/agent.css apps/platform/src/app/agent/components/orb.tsx
git commit -m "feat(agent-web): living orb v2 — morphing silhouette + billowing light"
```

---

### Task 7: Full QA + build gate (fixes only)

- [ ] **Step 1:** `pnpm --filter @sneakers/platform test` (18) green; `tsc --noEmit` clean; `pnpm --filter @sneakers/platform build` exit 0 (judge only errors touching files in this plan).
- [ ] **Step 2: Flow QA** (dev server, both widths, READ screenshots):
  1. `/agent` desktop: rail nav, all five items route correctly, active states.
  2. `/agent` 430px: five-item tab bar fits; app flows from prior phases still work (equip, sheets, add cash).
  3. `/agent/markets`: minute groups render real data; window/asset chips; segmented → All markets; sort + pagination; no `missing FROM-clause` in dev logs.
  4. `/agent/profile`: sections render; links to legacy routes work; null-user state doesn't crash under AGENT_PREVIEW.
  5. `/dashboard` → lands on `/agent`; `/dashboard/legacy` renders old home; `/dashboard/minute` & `/dashboard/settings/autotrade` unaffected.
  6. Landing `/`: phone demo pixel-unchanged (compare against a pre-Task-1 screenshot); authed nav shows CLASSIC + OPEN APP →.
- [ ] **Step 3:** Fix findings (smallest change), re-run gates, commit `feat(agent-web): phase-1+2 QA fixes — app is the dashboard`.
