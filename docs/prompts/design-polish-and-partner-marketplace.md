# Prompt: Design-System Alignment Pass + Partner Agent Marketplace (DraftKings/FanDuel tier)

You are working in `/Users/jeremyalbus/sneakers-trading` (pnpm monorepo, Next 16 App
Router app at `apps/platform`) on branch `feat/sneakers-agent`. Follow the
superpowers process: brainstorm → spec → plan → subagent-driven execution with
per-task review. Do not skip the design gate. This prompt is your full context.

---

## Standing context (read before anything else)

**What exists and is LIVE on sneakersterminal.com:**
- The **agent app** at `/agent` (behind login): 4 tabs — Agent (cover-flow of
  living "model orbs", one equipped), Models (My Model | Trading Agents
  marketplace grid + Add Agent creator flow), Balance, Profile. Runs on a mock
  in-browser engine (`src/app/agent/lib/engine.ts`) whose shape mirrors the
  future `/api/agent/*` contract. Parent spec:
  `docs/superpowers/specs/2026-07-06-agent-experience-design.md`.
- The **public landing** (`src/app/page.tsx`): terminal-branded hero (blue,
  "The prediction terminal for college"), signup funnel, and the new
  **"Meet your Agent" section** — the real app running inside an iPhone frame
  (`src/app/agent/components/agent-demo.tsx`), fully interactive on the mock
  engine. Spec: `docs/superpowers/specs/2026-07-08-landing-agent-showcase-design.md`.
- **Auth-aware navbar**: logged-out = LOG IN + SIGN UP dropdown; logged-in =
  DASHBOARD (ghost) + OPEN APP → (green). Mobile hamburger mirrors both.
- **Partner-agent pattern already proven** in the marketplace grid
  (`src/app/agent/components/model-grid.tsx` + `lib/catalog.ts`): OddsJam and
  Gambly each have a logo-on-orb (logo file as the sphere's surface), a
  brand-glow card (`.mcell--featured.mcell--oddsjam` blue / `.mcell--gambly`
  green in `agent.css`), a tagline instead of metrics, and a price pill
  ("From $1 per day" / "$14.99/mo"). Logo assets live in
  `apps/platform/public/agents/` (320px, <40KB).

**Non-negotiable working rules:**
- The branch is SHARED with other Claude sessions. Stage files explicitly —
  NEVER `git add -A`/`git add .`. Kill only dev-server PIDs you started (no
  broad pkill). If :3000 is busy, let Next pick a port.
- Never use "scrape/scraper" in user-facing copy ("live prices", "live data").
- Money text uses tabular numerals (`.ag-num` inside the agent UI).
- All motion respects `prefers-reduced-motion`.
- `AGENT_PREVIEW=1 pnpm platform` (local only; hard-guarded to non-prod)
  bypasses the /agent auth gate AND forces the authed landing nav — use it for
  QA of logged-in states.
- Verify visually: headless-Chrome or standalone-Playwright screenshots at
  430px AND 1280px, and READ every screenshot you take. Unit suite:
  `pnpm --filter @sneakers/platform test` (15 tests). Types:
  `pnpm --filter @sneakers/platform exec tsc --noEmit`. Prod build gate before
  finishing: `pnpm --filter @sneakers/platform build`.
- Ship to preview via push (Vercel auto-builds the branch); production promote
  is the human's call — ask before promoting (the landing is the money page).

---

## PART A — Design-system alignment pass (navbar + buttons "in line")

**The problem.** The landing page grew organically and now has at least four
button dialects visible at once:
1. Top nav logged-out: LOG IN (white ring pill, `text-xs tracking-wider`) next
   to SIGN UP ▾ (solid blue `LandingSignupButton` dropdown) — differing
   heights/weights.
2. Top nav logged-in: DASHBOARD (white ring ghost) + OPEN APP → (solid green
   `#2FD37A`, `text-stone-950`) — introduces the agent-green into a blue-brand
   bar.
3. Hero CTAs: "Sign up as an individual →" / "Sign up your organization →"
   (blue system) and, when logged in, a large green "Open App →".
4. "Meet your Agent" section CTA: blue `LandingAccess` "Get your agent →"
   sitting under green-accented copy, beside the dark phone frame.
Plus the mobile hamburger panel's stacked variants of all of the above.

**The task.** Create ONE deliberate button/nav system and apply it everywhere
on the public surface (landing top nav both auth states, mobile panel, hero
CTAs, Meet your Agent CTA, and any stray landing buttons):
- Define tokens: two roles maximum — decide and document the color logic. The
  recommended split, to be validated in brainstorming: **blue = terminal/
  signup funnel actions; green (#2FD37A) = agent/app-entry actions** — so the
  color itself telegraphs "marketing funnel" vs "into the product." If that
  reads as too busy, the alternative is all-blue public surface with green
  reserved strictly for inside the phone frame/app; present both to the human
  with screenshots before applying.
- One pill spec: consistent height (e.g. 40px nav / 48px hero), radius, padding,
  font size/weight/tracking, case (pick UPPERCASE tracking-wider OR sentence
  case — not both), arrow treatment (`→` spacing), hover/focus states
  (focus-visible rings already exist — keep them).
- **Literal alignment**: the top-right nav items must sit on one baseline with
  identical heights, consistent gaps, and not shift layout between auth states
  or when the SIGN UP dropdown opens. Check at 1280px, 1024px, and the sm:
  breakpoint where the hamburger takes over.
- Audit files: `src/app/page.tsx` (nav + hero CTAs), `landing-signup-button.tsx`,
  `landing-access.tsx`, `landing-mobile-nav.tsx`, `meet-your-agent.tsx`.
  Prefer extracting a tiny shared `landing-button.tsx` (or CSS classes) over
  editing five inline className strings that will drift again.
- Also fix while in there (small, spotted during QA): the Meet your Agent copy
  sits over the brightest part of the glowing-sneaker hero background — add a
  subtle dark scrim/backdrop behind the text block so the green bullets stay
  readable; and the section shows an orphaned "← it's live, try it" caption
  when signups are closed — hide the caption when no CTA renders beside it.
- Do NOT restyle anything inside the phone frame or `/agent` — the app's design
  system (`agent.css`) is its own world and is correct.

**Definition of done for Part A:** side-by-side before/after screenshots at
both widths and both auth states; every public-surface button traceable to the
documented system; zero layout shift between auth states in the nav.

---

## PART B — Partner Agent Marketplace (the DraftKings/FanDuel tier)

**The vision.** The Trading Agents marketplace should read as an **app store
for trading agents** where major consumer operators — DraftKings, FanDuel,
PrizePicks, Underdog, BetMGM, ESPN Bet, Caesars, plus the existing OddsJam and
Gambly — each have a first-class branded agent: their logo living on an orb,
their brand color as the card's glow, their tagline, their price. A user
subscribes to "the DraftKings agent" the way they'd subscribe to a creator's
bot, and it trades (paper, in v1) with that partner's identity and, later,
that partner's data/odds feeds. This is simultaneously a consumer feature and
a **sales artifact**: the thing we screenshot and demo to partner BD teams.

**Legal reality — build this in, don't skip it:** we have NO deals with
DraftKings/FanDuel/etc. Their logos and names cannot ship on the public
production marketplace. So the build has two faces:
1. **Public marketplace** keeps only real/first-party agents (current catalog +
   any partner that actually signs: OddsJam and Gambly stay as-is since those
   cards already shipped — confirm with the human whether those are signed or
   should ALSO move behind the pitch wall).
2. **Private partner-pitch experience** at a noindex route (pattern:
   hedgepayments.com's per-partner proposal pages): e.g.
   `/partners/preview/<partner-slug>` — auth-optional but noindexed and
   unlinked — showing the full marketplace WITH that partner's branded agent
   live in it, plus a tailored pitch section. One URL per prospect to text a
   BD contact. Brand assets used only on these private pitch routes, labeled
   "Concept preview — not a live partnership."

**What to build (brainstorm the cut-lines with the human first):**

1. **Catalog schema upgrade** (`src/app/agent/lib/types.ts` + `catalog.ts`):
   - `partnerTier?: 'featured' | 'standard'`, `category: 'sportsbook' | 'dfs' |
     'prediction' | 'data' | 'community' | 'first-party'`,
     `brandColor?: string` (drives glow + pill without hand-writing CSS per
     partner — refactor `.mcell--oddsjam/.mcell--gambly` into a CSS-var-driven
     `.mcell--branded` so the 10th partner costs a data row, not a stylesheet
     edit; same for the orb: `--o1..--o4`/halo derived from `brandColor` with
     a logo-on-blob variant),
   - `logoSrc?: string` formalized (today the logo is baked into per-color CSS
     classes `orb--oddsjam`/`orb--gambly` — generalize to an `<img>`/background
     driven by data so partners don't need CSS at all).
2. **Marketplace UX growth** (Models tab, Trading Agents segment):
   - A **Featured Partners row** (horizontally scrollable, larger cards) above
     the existing grid; category filter chips (All / Sportsbooks / DFS /
     Prediction / Data / Community); the existing grid becomes the "All agents"
     body. Keep the + subscribe and detail-sheet mechanics exactly as they are.
   - Partner detail sheet upgrade: brand-colored header band, "Powered by
     <partner>" line, category chip, and a "Partner agent" badge distinct from
     community "in review".
3. **Partner mock data** for the pitch routes: DraftKings (their green,
   tagline like "The DraftKings agent — every DK market, played for you"),
   FanDuel (their blue), PrizePicks (purple), Underdog (gold/tan) — 4 is
   enough; write taglines that describe the *agent concept* without claiming
   live functionality. Logo files: the human must drop official marks into
   `apps/platform/public/agents/partners/` themselves (do NOT scrape/copy
   logos from the web autonomously); build with clean lettermark placeholders
   (two-letter tiles in brand colors) that swap to real files when present.
4. **Pitch route** `/partners/preview/[slug]`:
   - `noindex` (robots meta + header), no links from anywhere public.
   - Layout: partner-branded hero ("<Partner> × Sneakers — your agent, in
     their pocket"), the phone-frame `AgentDemo` seeded so the partner's agent
     is FIRST in the marketplace and (optionally) pre-subscribed, three pitch
     bullets (distribution to a college trading audience; Stripe-billed
     subscriptions with rev share; the connected-bot API contract from the
     parent spec — we send signals, their engine returns orders, every order
     passes our risk gates), and a contact CTA (mailto jackson@ or Calendly if
     one exists — ask).
   - Implementation note: `AgentDemo` currently composes the fixed CATALOG via
     `AgentProvider`. Add an optional `seedModels?: AgentModel[]` /
     `spotlightId?: string` prop path (provider accepts an initial-state
     override) so a pitch page can inject the partner agent without touching
     the real catalog. Keep the public app's behavior byte-identical when the
     props are absent (this codebase's established pattern — see `onNavigate`).
5. **"Become a partner" surface** (public, small): one card at the end of the
   Featured row or a line under the grid — "Run your brand's agent on Sneakers"
   → mailto/interest form. This is the only public trace of the partner
   program in v1.
6. **Spec + roadmap hygiene**: fold the schema changes into the Phase-2 API
   contract (`agent_models` table already has `featured`/`brand` concepts —
   extend with `partner_tier`, `category`, `brand_color`, `logo_url`), update
   `docs/superpowers/specs/2026-07-06-agent-experience-design.md`'s catalog
   section, and add the pitch-route pattern to the spec so iOS inherits it
   later.

**Explicit brainstorm questions to resolve with the human before planning:**
- Are OddsJam/Gambly actually signed, or do their cards also belong behind the
  pitch wall? (They're live on prod today.)
- Color-role decision from Part A (blue/green split vs all-blue public).
- Pitch route auth: fully public-but-noindex (easiest to text a BD contact) vs
  a shared password (Chip-and-a-Chair used one) — recommend public+noindex+
  unguessable slug.
- Featured row on the REAL marketplace now (with only OddsJam/Gambly/Up-Down
  populating it) or only after a third real partner signs?
- Pricing display for pitch mocks: real-looking ("From $2 per day") or
  "Pricing TBD with partner"?

**Sequencing suggestion (one spec, two plans):** Plan 1 = Part A (small,
independent, ship same-day). Plan 2 = Part B (schema refactor → marketplace UX
→ pitch route → mock partners), each phase behind the same review gates.

**Definition of done for Part B:** public marketplace unchanged for
end-users except the Featured row + category chips (populated only with real
agents); `/partners/preview/draftkings` (and fanduel/prizepicks/underdog)
render the full branded pitch with the partner's agent spotlighted in a live
demo; nothing partner-branded is linked or indexed publicly; all gates green
(tests/tsc/build/screenshots read); production promote left to the human.
