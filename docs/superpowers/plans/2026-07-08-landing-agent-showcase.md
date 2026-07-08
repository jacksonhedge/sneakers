# Landing Agent Showcase + Auth-Aware Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public landing page gets a live, interactive phone-frame demo of the agent app plus agent-story copy; the navbar and hero CTAs become auth-aware (logged-in users get Dashboard / Open App → instead of LOG IN / SIGN UP).

**Architecture:** Extract the three demoable tab bodies (`/agent`, `/agent/models`, `/agent/balance`) into view components the route pages wrap, add an optional `onNavigate` escape hatch to the two sheets, then compose those views inside a new `AgentDemo` client component (own provider, local tab state, phone chrome). The landing renders `AgentDemo` in a new "Meet your Agent" section and reads Supabase auth server-side to swap nav/CTAs.

**Tech Stack:** Next 16 App Router, React 19, existing agent mock engine (`src/app/agent/lib/engine.ts` — no changes), Tailwind (landing) + `agent.css` (demo interior).

**Spec:** `docs/superpowers/specs/2026-07-08-landing-agent-showcase-design.md`

## Global Constraints

- Logged-out funnel unchanged: LOG IN / `LandingSignupButton` / `LandingMobileNav` render exactly as today when there is no user; all `signupCfg` gating preserved.
- Real `/agent` app behavior byte-identical after refactors: same DOM, same classes, same navigation (the `onNavigate` prop is ABSENT in the app).
- Demo imports nothing server-side — mock engine only; state resets per page load (expected).
- Badges: demo Agent/Models views show `LIVE DEMO` (green pill, PAPER's slot); Balance keeps `STRIPE TEST`. The real app keeps `PAPER`.
- No "scrape"/"scraper" in new copy. Money in `.ag-num` tabular numerals. Motion respects `prefers-reduced-motion`.
- Copy for the section (verbatim): eyebrow `MEET YOUR AGENT`; headline `It trades. You watch.`; bullets: `Works Bitcoin & crypto up/down markets around the clock — 5 and 15-minute windows on Kalshi and Polymarket.` / `Subscribe to better models — or build your own with a plain-English prompt.` / `Every trade explained: the signal it saw, or the gate that stopped it.`
- `AGENT_PREVIEW=1` (server env, local only) forces the authed landing nav for QA, in addition to its existing /agent auth bypass.
- Commit prefix `feat(landing):` for landing files, `feat(agent-web):` for files under `src/app/agent/`.
- Repo has foreign untracked files and a shared branch — stage only the exact files listed per task; never `git add -A`. Another session works in a worktree of this repo; kill only your own dev-server PIDs, never broad pkill.
- All commands from repo root `/Users/jeremyalbus/sneakers-trading`. Tests: `pnpm --filter @sneakers/platform test` (15 pass). Types: `pnpm --filter @sneakers/platform exec tsc --noEmit`.

---

### Task 1: Extract tab views (`/agent` byte-identical)

**Files:**
- Create: `apps/platform/src/app/agent/components/agent-tab-view.tsx`
- Create: `apps/platform/src/app/agent/components/models-tab-view.tsx`
- Create: `apps/platform/src/app/agent/components/balance-tab-view.tsx`
- Modify: `apps/platform/src/app/agent/page.tsx` (becomes a thin route wrapper)
- Modify: `apps/platform/src/app/agent/models/page.tsx` (3-line wrapper)
- Modify: `apps/platform/src/app/agent/balance/page.tsx` (3-line wrapper)

**Interfaces:**
- Consumes: existing `useAgent()`, components, formatters — unchanged.
- Produces (Tasks 3 depends on these exact signatures):
  - `AgentTabView({ startAtEnd?: boolean, badge?: string })` — default badge `'PAPER'`
  - `ModelsTabView({ badge?: string })` — default `'PAPER'`
  - `BalanceTabView()` — badge stays `STRIPE TEST` internally

- [ ] **Step 1: Create `agent-tab-view.tsx`** — move the ENTIRE body of the current `AgentTabInner` from `apps/platform/src/app/agent/page.tsx` into it, with three mechanical changes: (1) the search-params/router logic stays behind in the page — the view receives `startAtEnd` instead; (2) the hardcoded `PAPER` badge becomes the `badge` prop; (3) imports adjust from `./lib/...`→`../lib/...` and `./components/...`→`./...`.

```tsx
'use client'
import { useState } from 'react'
import { useAgent } from '../lib/store'
import { CoverFlow } from './cover-flow'
import { ActivityFeed } from './activity-feed'
import { ModelSheet } from './model-sheet'
import { formatMoney, formatPerf, formatSigned } from '../lib/format'
import type { AgentModel } from '../lib/types'

export function AgentTabView({ startAtEnd, badge = 'PAPER' }: { startAtEnd?: boolean; badge?: string }) {
  const { state, status, todayPnl, owned, dispatch } = useAgent()
  const [centerIndex, setCenterIndex] = useState(() => (startAtEnd ? state.models.length - 1 : 0))
  const [sheetModel, setSheetModel] = useState<AgentModel | null>(null)

  const m = state.models[centerIndex]
  const isEquipped = m.id === state.equippedId

  let equipLabel = 'Equipped ✓'
  if (!isEquipped) {
    if (m.status === 'review') equipLabel = 'In review'
    else if (owned(m.id)) equipLabel = 'Equip'
    else equipLabel = 'Subscribe · ' + (m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo')
  }

  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Sneakers</span>
        <span className="ag-badge ag-badge--paper">{badge}</span>
      </div>

      <CoverFlow
        models={state.models}
        centerIndex={centerIndex}
        equippedId={state.equippedId}
        paused={state.paused}
        phase={status.phase}
        onCenter={setCenterIndex}
        onOpen={setSheetModel}
      />
      <div className="cf-name">{m.name}</div>
      {isEquipped ? (
        <>
          <div className="ag-status">
            <span className={'ag-status__dot' + (state.paused ? ' ag-status__dot--off' : '')} />
            {status.title}
          </div>
          <div className="ag-statussub">{status.sub}</div>
        </>
      ) : (
        <>
          <div className="ag-status">{m.tagline ?? formatPerf(m.perf30d) + ' · 30d paper'}</div>
          <div className="ag-statussub">
            by {m.by}{m.runners > 1 ? ` · ${m.runners.toLocaleString('en-US')} running` : ''}
          </div>
        </>
      )}
      <div className="cf-dots">
        {state.models.map((x, i) => <span key={x.id} className={i === centerIndex ? 'on' : ''} />)}
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '14px 0 12px' }}>
        <button
          className={'ag-pill ag-num ' + (isEquipped ? 'ag-pill--ghost' : 'ag-pill--primary')}
          disabled={equipLabel === 'In review'}
          onClick={() => dispatch({ type: 'equip', id: m.id })}
        >
          {equipLabel}
        </button>
        <button className="ag-pill ag-pill--ghost" onClick={() => dispatch({ type: 'togglePaused' })}>
          {state.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div className="ag-balrow">
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Balance</div>
          <div className="ag-balcell__val ag-num">{formatMoney(state.balanceCents)}</div>
        </div>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Today</div>
          <div className={'ag-balcell__val ag-num ' + (todayPnl < 0 ? 'ag-neg' : 'ag-pos')}>{formatSigned(todayPnl)}</div>
        </div>
      </div>

      <div className="ag-sechead">Activity</div>
      <ActivityFeed decisions={state.decisions} />

      <ModelSheet model={sheetModel} onClose={() => setSheetModel(null)} />
    </>
  )
}
```

- [ ] **Step 2: Rewrite `apps/platform/src/app/agent/page.tsx`** as the thin route wrapper (keeps Suspense + `?center=new` consumption + param strip — route concerns stay at the route):

```tsx
'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AgentTabView } from './components/agent-tab-view'

function AgentTabInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const startAtEnd = searchParams.get('center') === 'new'

  useEffect(() => {
    if (startAtEnd) router.replace('/agent', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AgentTabView startAtEnd={startAtEnd} />
}

export default function AgentTab() {
  return (
    <Suspense fallback={null}>
      <AgentTabInner />
    </Suspense>
  )
}
```

(Note: `startAtEnd` flips to `false` after the `router.replace`, but `AgentTabView` only reads it in a lazy `useState` initializer, so the centered index is unaffected — same semantics as today.)

- [ ] **Step 3: Create `models-tab-view.tsx`** — move the ENTIRE body of the default export of `apps/platform/src/app/agent/models/page.tsx` into `export function ModelsTabView({ badge = 'PAPER' }: { badge?: string })`, changing only: import paths (`../lib/...` stays the same depth-wise — verify each), the `PAPER` badge text → `{badge}`, and nothing else. Then rewrite `models/page.tsx`:

```tsx
'use client'
import { ModelsTabView } from '../components/models-tab-view'
export default function ModelsTab() {
  return <ModelsTabView />
}
```

- [ ] **Step 4: Create `balance-tab-view.tsx`** — same mechanical move from `balance/page.tsx` into `export function BalanceTabView()` (no badge prop; STRIPE TEST stays hardcoded), and rewrite `balance/page.tsx`:

```tsx
'use client'
import { BalanceTabView } from '../components/balance-tab-view'
export default function BalanceTab() {
  return <BalanceTabView />
}
```

- [ ] **Step 5: Verify** — `pnpm --filter @sneakers/platform exec tsc --noEmit` clean; `pnpm --filter @sneakers/platform test` 15 pass. Then `AGENT_PREVIEW=1 pnpm platform` + headless-Chrome screenshots of `/agent`, `/agent/models`, `/agent/balance` at 430px — READ them and confirm identical to pre-refactor (same layout, badges, tab bar). Kill your own dev server by PID.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/agent/components/agent-tab-view.tsx apps/platform/src/app/agent/components/models-tab-view.tsx apps/platform/src/app/agent/components/balance-tab-view.tsx apps/platform/src/app/agent/page.tsx apps/platform/src/app/agent/models/page.tsx apps/platform/src/app/agent/balance/page.tsx
git commit -m "feat(agent-web): extract tab views for reuse (routes now thin wrappers)"
```

---

### Task 2: `onNavigate` escape hatch on the sheets + exported tab icons

**Files:**
- Modify: `apps/platform/src/app/agent/components/model-sheet.tsx`
- Modify: `apps/platform/src/app/agent/components/add-agent-sheet.tsx`
- Modify: `apps/platform/src/app/agent/components/tab-bar.tsx` (export icons only)
- Modify: `apps/platform/src/app/agent/components/agent-tab-view.tsx` (thread prop)
- Modify: `apps/platform/src/app/agent/components/models-tab-view.tsx` (thread prop)
- Modify: `apps/platform/src/app/agent/lib/types.ts` (add `AgentDest`)
- Modify: `docs/superpowers/specs/2026-07-08-landing-agent-showcase-design.md` (record deviation)

**Interfaces:**
- Produces (Task 3 depends on): `type AgentDest = 'agent' | 'models' | 'balance' | 'profile'` (in `lib/types.ts`);
  `ModelSheet({ model, onClose, onNavigate? })` and `AddAgentSheet({ open, onClose, onNavigate? })` where `onNavigate?: (dest: AgentDest) => void`;
  `AgentTabView({ startAtEnd?, badge?, onNavigate? })`, `ModelsTabView({ badge?, onNavigate? })`;
  `ORB_ICON`, `MODELS_ICON` exported from `tab-bar.tsx`.
- DEVIATION FROM SPEC (record it): `TabBar` itself gets NO `onNavigate` — the demo builds its own 3-tab bar (Task 3) reusing the exported icons and `.ag-tabbar` CSS. The app's TabBar keeps pure `<Link>` semantics with zero branching. Update the spec's "Navigation override" bullet to say TabBar is untouched apart from exporting `ORB_ICON`/`MODELS_ICON`; sheets carry the prop.

- [ ] **Step 1: Add `AgentDest` to `lib/types.ts`** (append at end):

```ts
export type AgentDest = 'agent' | 'models' | 'balance' | 'profile'
```

- [ ] **Step 2: `model-sheet.tsx`** — signature and the two `router.push` sites change; everything else identical:

```tsx
export function ModelSheet({ model, onClose, onNavigate }: {
  model: AgentModel | null
  onClose: () => void
  onNavigate?: (dest: AgentDest) => void
}) {
```
(import `AgentDest` type from `../lib/types`). In `onAction()`:
- `router.push('/agent/models')` becomes `onNavigate ? onNavigate('models') : router.push('/agent/models')`
- `router.push('/agent')` becomes `onNavigate ? onNavigate('agent') : router.push('/agent')`
`useRouter()` stays called unconditionally (hooks rules).

- [ ] **Step 3: `add-agent-sheet.tsx`** — same pattern:

```tsx
export function AddAgentSheet({ open, onClose, onNavigate }: {
  open: boolean
  onClose: () => void
  onNavigate?: (dest: AgentDest) => void
}) {
```
In `create()`: `router.push('/agent?center=new')` becomes
`onNavigate ? onNavigate('agent') : router.push('/agent?center=new')`.
(The demo handles "center the new orb" itself in Task 3 — the demo's `onNavigate` closure sets its own flag; nothing more is needed here.)

- [ ] **Step 4: `tab-bar.tsx`** — change `const ORB_ICON = (` → `export const ORB_ICON = (` and `const MODELS_ICON = (` → `export const MODELS_ICON = (`. Nothing else changes.

- [ ] **Step 5: Thread the prop through the views.**
  - `agent-tab-view.tsx`: signature becomes `{ startAtEnd, badge = 'PAPER', onNavigate }: { startAtEnd?: boolean; badge?: string; onNavigate?: (dest: AgentDest) => void }` (import the type) and its `<ModelSheet model={sheetModel} onClose={...} />` gains `onNavigate={onNavigate}`.
  - `models-tab-view.tsx`: signature becomes `{ badge = 'PAPER', onNavigate }: { badge?: string; onNavigate?: (dest: AgentDest) => void }`; its `<ModelSheet ... />` and `<AddAgentSheet ... />` both gain `onNavigate={onNavigate}`.

- [ ] **Step 6: Update the spec** — in `docs/superpowers/specs/2026-07-08-landing-agent-showcase-design.md`, replace the TabBar bullet under "Navigation override" with: `TabBar is untouched except exporting ORB_ICON/MODELS_ICON; the demo renders its own 3-tab bar reusing .ag-tabbar styles. Sheets carry the onNavigate prop.`

- [ ] **Step 7: Verify** — tsc clean; 15 tests pass. Quick behavioral check that the APP still routes: dev server, click a subscribed model's "Equip now" in the sheet on `/agent/models` → lands on `/agent` (screenshot). Kill own PID.

- [ ] **Step 8: Commit**

```bash
git add apps/platform/src/app/agent/components/model-sheet.tsx apps/platform/src/app/agent/components/add-agent-sheet.tsx apps/platform/src/app/agent/components/tab-bar.tsx apps/platform/src/app/agent/components/agent-tab-view.tsx apps/platform/src/app/agent/components/models-tab-view.tsx apps/platform/src/app/agent/lib/types.ts docs/superpowers/specs/2026-07-08-landing-agent-showcase-design.md
git commit -m "feat(agent-web): optional onNavigate on sheets; export tab icons for demo"
```

---

### Task 3: `AgentDemo` — phone-frame live demo component

**Files:**
- Create: `apps/platform/src/app/agent/components/agent-demo.tsx`
- Modify: `apps/platform/src/app/agent/agent.css` (append `.agdemo-*` chrome rules)
- Modify: `apps/platform/src/app/agent/components/models-tab-view.tsx` (add `onCreateNavigate` — see Step 2 notes)

**Interfaces:**
- Consumes: `AgentProvider` (`../lib/store`), `AgentTabView`/`ModelsTabView`/`BalanceTabView`, `ORB_ICON`/`MODELS_ICON`, `useAgent`, `formatMoneyWhole`, `AgentDest`.
- Produces: `export function AgentDemo()` — self-contained client component; Task 4 renders it on the landing. Also: `ModelsTabView` gains `onCreateNavigate?: (dest: AgentDest) => void`, passed only to `AddAgentSheet` as `onNavigate={onCreateNavigate ?? onNavigate}` (app passes neither — unchanged).

- [ ] **Step 1: Append demo chrome CSS to `agent.css`:**

```css
/* ---- landing demo phone frame ---- */
.agdemo-frame {
  width: 350px; max-width: 92vw; height: 700px; border-radius: 48px;
  background: #000; padding: 9px; position: relative; flex-shrink: 0;
  box-shadow: 0 0 0 2px #2a2f33, 0 28px 70px rgba(0,0,0,.5);
}
.agdemo-screen {
  position: relative; width: 100%; height: 100%; border-radius: 40px; overflow: hidden;
  background: var(--ag-surface, #0B0D10); display: flex; flex-direction: column;
}
.agdemo-island {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: 104px; height: 28px; border-radius: 16px; background: #000; z-index: 40;
}
.agdemo-main { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 42px 16px 14px; scrollbar-width: none; }
.agdemo-main::-webkit-scrollbar { display: none; }
/* sheets inside the demo must stay inside the phone, not cover the page */
.agdemo-screen .sheet-veil, .agdemo-screen .sheet { position: absolute; }
```

- [ ] **Step 2: Create `agent-demo.tsx`:**

```tsx
'use client'
import { useState } from 'react'
import { AgentProvider, useAgent } from '../lib/store'
import { AgentTabView } from './agent-tab-view'
import { ModelsTabView } from './models-tab-view'
import { BalanceTabView } from './balance-tab-view'
import { ORB_ICON, MODELS_ICON } from './tab-bar'
import { formatMoneyWhole } from '../lib/format'
import type { AgentDest } from '../lib/types'
import '../agent.css'

type DemoTab = 'agent' | 'models' | 'balance'

function DemoTabBar({ tab, onTab }: { tab: DemoTab; onTab: (t: DemoTab) => void }) {
  const { state } = useAgent()
  const tabs: { key: DemoTab; label: string; icon: React.ReactNode }[] = [
    { key: 'agent', label: 'Agent', icon: ORB_ICON },
    { key: 'models', label: 'Models', icon: MODELS_ICON },
    { key: 'balance', label: 'Balance', icon: <span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span> },
  ]
  return (
    <nav className="ag-tabbar" style={{ position: 'relative', paddingBottom: 10 }}>
      {tabs.map(t => (
        <button key={t.key} type="button"
          aria-current={tab === t.key ? 'page' : undefined}
          className={'ag-tabbtn' + (tab === t.key ? ' ag-tabbtn--on' : '')}
          onClick={() => onTab(t.key)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function DemoInner() {
  const [tab, setTab] = useState<DemoTab>('agent')
  const [centerNew, setCenterNew] = useState(false)

  function go(dest: AgentDest) {
    if (dest === 'profile') return // not in the demo
    setCenterNew(false)
    setTab(dest)
  }

  // AddAgentSheet's navigate means "a new agent was just created" — center it.
  function goAfterCreate() {
    setCenterNew(true)
    setTab('agent')
  }

  return (
    <div className="agdemo-screen">
      <div className="agdemo-island" />
      <div className="agdemo-main">
        {tab === 'agent' && <AgentTabView startAtEnd={centerNew} badge="LIVE DEMO" onNavigate={go} />}
        {tab === 'models' && <ModelsTabView badge="LIVE DEMO" onNavigate={go} onCreateNavigate={goAfterCreate} />}
        {tab === 'balance' && <BalanceTabView />}
      </div>
      <DemoTabBar tab={tab} onTab={t => { setCenterNew(false); setTab(t) }} />
    </div>
  )
}

export function AgentDemo() {
  return (
    <div className="agdemo-frame agent-app" style={{ minHeight: 0 }}>
      <AgentProvider>
        <DemoInner />
      </AgentProvider>
    </div>
  )
}
```

Notes for the implementer: (a) `ModelsTabView` needs TWO navigation props because ModelSheet's "Equip now" (→ `'agent'`, must NOT center the last orb) and AddAgentSheet's create (→ `'agent'`, MUST center the just-created last orb) both land on the agent tab: add `onCreateNavigate?: (dest: AgentDest) => void` to `ModelsTabView`, passed only to `AddAgentSheet` as `onNavigate={onCreateNavigate ?? onNavigate}`; `ModelSheet` keeps plain `onNavigate`. The app passes neither prop, so app behavior is unchanged.
(b) `.agent-app` class on the frame wrapper scopes the design tokens; `minHeight: 0` inline overrides `.agent-app`'s `min-height: 100dvh` so the frame doesn't stretch (`.agdemo-frame` fixes the height). The `@media (min-width: 700px)` rule on `.agent-app` adds max-width/borders — 430px max-width is fine (frame is 350px) but the side borders are not wanted: neutralize with inline `style={{ minHeight: 0, border: 'none', maxWidth: 'none' }}` on the frame div. Use exactly that.

- [ ] **Step 3: Verify in isolation** — temporarily render `<AgentDemo />` on a scratch route (`apps/platform/src/app/demo-check/page.tsx` with just the import + component), dev server, screenshot at 1280px, READ it: phone frame with island, orb carousel with LIVE DEMO badge, working tab bar with balance number; click Models tab (screenshot) → grid renders inside frame; open a model sheet → sheet stays INSIDE the phone (absolute, not fixed over the page). Delete the scratch route after. tsc clean; 15 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/agent/components/agent-demo.tsx apps/platform/src/app/agent/components/models-tab-view.tsx apps/platform/src/app/agent/agent.css
git commit -m "feat(agent-web): AgentDemo — phone-framed live demo composing the tab views"
```

---

### Task 4: "Meet your Agent" landing section

**Files:**
- Create: `apps/platform/src/app/meet-your-agent.tsx`
- Modify: `apps/platform/src/app/page.tsx` (render the section below the hero CTA block)

**Interfaces:**
- Consumes: `AgentDemo` from `@/app/agent/components/agent-demo`; `LandingAccess` (existing, props: `referralCode`, `variant`, `mode`, `tone`, `label`).
- Produces: `MeetYourAgent({ authed, referralCode, individualEnabled }: { authed: boolean; referralCode: string | null; individualEnabled: boolean })` — Task 5 passes `authed`.

- [ ] **Step 1: Create `meet-your-agent.tsx`:**

```tsx
import Link from 'next/link'
import { AgentDemo } from '@/app/agent/components/agent-demo'
import { LandingAccess } from './landing-access'

// "Meet your Agent" — live interactive demo of the /agent app on the public
// landing. The demo runs the same mock engine as the app; state resets on
// reload, which is fine for a demo.
export function MeetYourAgent({ authed, referralCode, individualEnabled }: {
  authed: boolean
  referralCode: string | null
  individualEnabled: boolean
}) {
  return (
    <section id="meet-your-agent" className="mt-20 w-full max-w-5xl mx-auto px-2">
      <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
        <div className="flex-1 text-center lg:text-left">
          <div className="text-xs tracking-[0.25em] font-semibold" style={{ color: '#2FD37A' }}>
            MEET YOUR AGENT
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold text-white tracking-tight">
            It trades. You watch.
          </h2>
          <ul className="mt-6 space-y-3 text-white/85 text-sm md:text-base max-w-md mx-auto lg:mx-0 text-left">
            <li className="flex gap-3">
              <span style={{ color: '#2FD37A' }}>●</span>
              Works Bitcoin &amp; crypto up/down markets around the clock — 5 and 15-minute windows on Kalshi and Polymarket.
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#2FD37A' }}>●</span>
              Subscribe to better models — or build your own with a plain-English prompt.
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#2FD37A' }}>●</span>
              Every trade explained: the signal it saw, or the gate that stopped it.
            </li>
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center">
            {authed ? (
              <Link
                href="/agent"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold tracking-wide text-stone-950 transition hover:opacity-90"
                style={{ background: '#2FD37A' }}
              >
                Open App →
              </Link>
            ) : (
              individualEnabled && (
                <LandingAccess
                  referralCode={referralCode}
                  variant="hero"
                  mode="individual"
                  tone="primary"
                  label="Get your agent →"
                />
              )
            )}
            <span className="text-white/50 text-xs">← it&rsquo;s live, try it</span>
          </div>
        </div>
        <AgentDemo />
      </div>
    </section>
  )
}
```

NOTE for the implementer: before using `LandingAccess`, read `apps/platform/src/app/landing-access.tsx` and confirm the exact prop names/variants used above exist (they are used with `variant="hero"` and `variant="nav"`, `mode`, `tone`, `label` elsewhere on the landing). If `variant="hero"` renders something visually unsuitable here (e.g., a wide block), fall back to `variant="nav" tone="primary"` with the same label. Do not invent new props.

- [ ] **Step 2: Wire into `page.tsx`** — import `{ MeetYourAgent }` and render it directly AFTER the hero CTA block's closing `</div>` (the block that contains the `signupCfg.allClosed` conditional), BEFORE the stats strip that follows. Pass `authed={authed}` (Task 5 introduces the variable — for THIS task hardcode `authed={false}` with a `// replaced in the authed-nav task` comment so the section works standalone), `referralCode={referralCode}`, `individualEnabled={signupCfg.individualEnabled}`.

- [ ] **Step 3: Verify** — dev server; screenshot `/` at 1280px and 430px; READ: section shows copy left / phone right at desktop, stacked on mobile; demo interactive (click Models tab in frame, screenshot); hero + signup CTAs above unchanged. tsc clean; tests pass. Kill own PID.

- [ ] **Step 4: Commit**

```bash
git add apps/platform/src/app/meet-your-agent.tsx apps/platform/src/app/page.tsx
git commit -m "feat(landing): Meet your Agent section with live phone-frame demo"
```

---

### Task 5: Auth-aware navbar + hero CTA

**Files:**
- Modify: `apps/platform/src/app/page.tsx`
- Modify: `apps/platform/src/app/landing-mobile-nav.tsx`

**Interfaces:**
- Consumes: `getAuthClient` from `@/lib/supabase-auth` (same pattern as `dashboard/layout.tsx`).
- Produces: `authed: boolean` in `page.tsx`, passed to `MeetYourAgent` and `LandingMobileNav`.

- [ ] **Step 1: Auth check in `page.tsx`** — add to imports: `import { getAuthClient } from '@/lib/supabase-auth'`. In `LandingPage()`, after the `signupCfg` line:

```tsx
// Auth-aware nav: logged-in users get app entry points instead of the
// signup funnel. Fail-soft — any auth hiccup renders the logged-out nav.
// AGENT_PREVIEW=1 (local QA only) forces the authed variant.
let authed = process.env.AGENT_PREVIEW === '1'
if (!authed) {
  try {
    const supabase = await getAuthClient()
    const { data } = await supabase.auth.getUser()
    authed = Boolean(data.user)
  } catch {
    authed = false
  }
}
```

- [ ] **Step 2: Desktop nav swap** — the existing block

```tsx
<div className="hidden sm:flex items-center gap-2">
  <Link href="/login" ...>LOG IN</Link>
  {(signupCfg.individualEnabled || signupCfg.organizationEnabled) && (
    <LandingSignupButton ... />
  )}
</div>
```

becomes

```tsx
<div className="hidden sm:flex items-center gap-2">
  {authed ? (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/10 hover:ring-white/60 transition"
      >
        DASHBOARD
      </Link>
      <Link
        href="/agent"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-wider text-stone-950 transition hover:opacity-90"
        style={{ background: '#2FD37A' }}
      >
        OPEN APP →
      </Link>
    </>
  ) : (
    <>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/10 hover:ring-white/60 transition"
      >
        LOG IN
      </Link>
      {(signupCfg.individualEnabled || signupCfg.organizationEnabled) && (
        <LandingSignupButton
          referralCode={referralCode}
          individualEnabled={signupCfg.individualEnabled}
          organizationEnabled={signupCfg.organizationEnabled}
        />
      )}
    </>
  )}
</div>
```

(The logged-out branch is character-identical to today's markup.)

- [ ] **Step 3: Hero CTA swap** — wrap the existing hero CTA block (`signupCfg.allClosed ? ... : ...`) in an `authed` conditional: when `authed`, render instead:

```tsx
<div className="flex justify-center">
  <Link
    href="/agent"
    className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold tracking-wide text-stone-950 transition hover:opacity-90 shadow-[0_8px_32px_rgba(47,211,122,0.3)]"
    style={{ background: '#2FD37A' }}
  >
    Open App →
  </Link>
</div>
```

When not authed, the existing block renders unchanged.

- [ ] **Step 4: Mobile nav** — `landing-mobile-nav.tsx`: add `authed?: boolean` to `Props`. In the panel, when `authed`, render INSTEAD of the LOG IN link + both `LandingAccess` blocks:

```tsx
<Link
  href="/agent"
  className="block w-full text-center rounded-full px-4 py-2.5 text-xs font-bold tracking-wider text-stone-950 transition"
  style={{ background: '#2FD37A' }}
  onClick={() => setOpen(false)}
>
  OPEN APP →
</Link>
<Link
  href="/dashboard"
  className="block w-full text-center rounded-full bg-white/5 px-4 py-2.5 text-xs font-semibold tracking-wider text-white ring-1 ring-white/30 hover:bg-white/10 transition"
  onClick={() => setOpen(false)}
>
  DASHBOARD
</Link>
```

The Venues/Pricing footer links stay in both variants. `page.tsx` passes `authed={authed}` to `<LandingMobileNav ... />`, and Task 4's `<MeetYourAgent authed={false} ...>` hardcode becomes `authed={authed}`.

- [ ] **Step 5: Verify** — dev server WITHOUT `AGENT_PREVIEW`: screenshot `/` logged-out at 1280px + 430px (nav identical to before; mobile hamburger unchanged). Then `AGENT_PREVIEW=1 pnpm platform`: screenshot `/` — desktop nav shows DASHBOARD + OPEN APP →, hero shows single Open App button, section CTA shows Open App. READ all screenshots. tsc clean; tests pass. Kill own PID.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/page.tsx apps/platform/src/app/landing-mobile-nav.tsx apps/platform/src/app/meet-your-agent.tsx
git commit -m "feat(landing): auth-aware navbar, hero CTA, and mobile nav"
```

---

### Task 6: Full QA + build gate

**Files:**
- Modify: only what QA surfaces (fixes, no features).

- [ ] **Step 1:** `pnpm --filter @sneakers/platform test` → 15 pass; `pnpm --filter @sneakers/platform exec tsc --noEmit` → clean.
- [ ] **Step 2:** `pnpm --filter @sneakers/platform build` → exit 0; judge only errors touching `src/app/agent/**`, `src/app/page.tsx`, `src/app/meet-your-agent.tsx`, `src/app/landing-mobile-nav.tsx`.
- [ ] **Step 3: Flow QA** (dev server; screenshots READ at 430px + 1280px; own PIDs only):
  1. `/` logged-out — hero + signup funnel unchanged; Meet your Agent section renders; demo orb breathing.
  2. In-frame: swipe/click to Wave Rider → Subscribe → becomes equipped; Models tab → + subscribe OddsJam → ✓; open OddsJam sheet (no metrics row, inside frame); Add Agent → create → lands on demo Agent tab centered on the new orb; Balance tab → Add cash $100 → tab-bar number updates.
  3. Demo isolation: interacting with the demo never navigates the page (URL stays `/`).
  4. `/agent` (with `AGENT_PREVIEW=1`) — identical to pre-refactor; sheets still route correctly (Equip now → `/agent`).
  5. `AGENT_PREVIEW=1` landing — authed nav/hero/section CTAs.
  6. `prefers-reduced-motion` spot check: demo orb static (emulate via headless Chrome `--force-prefers-reduced-motion` if available, else note).
- [ ] **Step 4:** Fix findings (smallest change), re-run Steps 1–2, commit:

```bash
git add apps/platform/src/app apps/platform/src/app/agent
git commit -m "feat(landing): QA fixes — agent showcase + authed nav complete"
```
(Stage specific files only — the paths above are the allowed universe, list files explicitly.)
