# Chrome prompt — trading terminal UI inventory walk

Walk every user-facing surface of Sneakers Terminal at `https://sneakersterminal.com` (the public + authed product, NOT the admin panel) and produce a structured inventory: for every page, list what renders, what's clickable, what's broken, what's empty/placeholder, what's confusing. Same five-question pass we did on the admin panel.

This is **NOT a smoke test** and **NOT a feature test**. The goal is a scannable map of the surface area so the founder can decide what to polish, what to gut, and what to build next.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `email` — the account to sign in as. Defaults to `jackson@hedgepayments.com` (already AUTHED, will see the gated dashboard).
- `password` — the account password. User types it themselves at the login form.

If missing, STOP and ask.

---

## Step 0 — Public-side audit (NO sign-in)

Don't sign in yet. We want the UN-authed view of every public surface first, because real visitors land here cold.

For EACH route below, do a **5-question pass:**

A. **Did it render?** (200 / 404 / 500 / blank / partial)
B. **What's on the page?** — list headings, sections, hero copy, CTAs.
C. **What's clickable?** — every button / link / form input / nav item.
D. **What does each clickable do?** — for read-only navigation, click and see. For SUBMITS / writes / external venue affiliate links, DO NOT click — note "destructive/external, not exercised".
E. **What's missing / broken?** — empty states, "lorem ipsum", broken images, console errors, links pointing to apex `/admin` or `/dashboard` that 404 or redirect weirdly.

Routes (un-authed, in order):

1. `https://sneakersterminal.com/` — landing
2. `/markets` — public market browser
3. `/venues` — venue list
4. `/pricing` — plans
5. `/students` — .edu landing
6. `/college` — college landing
7. `/hardware` — hardware tier
8. `/login` — login form
9. `/signup` — signup (do not submit; just view both step 1 and step 2 by typing in step 1 fields and clicking NEXT)
10. `/forgot-password` — reset form
11. `/r/SOMECODE` — referral redirect (use `/r/V5GHNE` — that's jackson's referral code, will resolve to a known landing)

For each: screenshot if visually interesting, log into the inventory.

**Cross-host bleed lens:** flag anywhere the public site references admin links, internal infra vocab ("scrape" / "scraper" / "pnpm scrape:*"), or shows admin-only chrome.

**Mobile responsiveness lens:** pick 3 random pages and resize the browser viewport to ~390px wide (iPhone width). Note any pages that break, overflow horizontally, or hide important content.

## Step 1 — Sign in

1. Visit `/login`.
2. Email = `email`, password = type it yourself.
3. Click SIGN IN.
4. Confirm landing on `/dashboard` (URL bar reads `sneakersterminal.com/dashboard`).

If sign-in fails or redirects unexpectedly, STOP and capture.

## Step 2 — Authed-side audit

Same 5-question pass for each. For pages that submit forms or fire alerts, **do not submit** — just inventory the form fields and note what would happen.

### Top-level dashboard — `/dashboard`

This is the most-visited page; spend ~3 minutes here.

- Topbar: what's there? email visible? data freshness indicator?
- Sidebar: every nav link with its label + URL
- Wallet status card
- O'Toole spotlight card (3 pillars: Configure / Teach / Execute)
- Category nav + cards (Sports / Politics / Crypto / etc.)
- BiggestVolume panel — 6 markets, sparklines render?
- Arbitrage panel — any candidates? what's the empty state?
- PerformanceChart — does it render?
- BigMovers — sparklines?
- UpcomingResolutions
- MyPositions — empty state copy?
- Right sidebar O'Toole chat — input visible? welcome message?

Render time? Console errors? Anything broken or blank?

Take a full-page screenshot.

### Markets — `/dashboard/markets`

- List rendering, sort/filter UI, count, sparklines per row
- Click into ONE specific market → `/dashboard/markets/[platform]/[marketId]`
  - Robinhood-style chart loads?
  - Timeframe pills (1H / 1D / 1W) work without a roundtrip?
  - YES/NO prices visible?
  - Order book or volume chart?
  - "Trade on" venue links — DO NOT click (external + would burn the session); just note presence
- Back to markets list. Note pagination if present.

### Minute Markets — `/dashboard/minute`

- Sub-hour crypto markets list
- Same pass: what renders, what's clickable, time-to-render

### Alerts — `/dashboard/alerts`

- Existing alerts list (likely empty)
- Click "New alert" or `/dashboard/alerts/new`
  - Form fields: market picker / trigger type / threshold / channel
  - Just inventory; **do NOT submit** (would create an alert)
- `/dashboard/alerts/settings` — quiet hours / browser push settings

### Profile — `/dashboard/profile`

- Email, display name, referral code, queue position / "you're in" state
- Tier badge
- Direct + indirect referral counts
- Avatar / profile image
- Change-password / sign-out / settings links

### Settings — `/dashboard/settings` and sub-pages

- `/dashboard/settings` — root
- `/dashboard/settings/api-keys`
- `/dashboard/settings/autotrade`
- `/dashboard/settings/otoole` — model picker, voice, scope

### Other authed surfaces — quick visit (~30s each)

- `/dashboard/connections` — affiliate-link surfaces (sportsbooks/DFS — DO NOT click external)
- `/dashboard/billing` — pricing / upgrade UI
- `/dashboard/billing/credits` — credits balance
- `/dashboard/leaderboard` — leaderboard table
- `/dashboard/leaderboard/join` — join flow
- `/dashboard/treasury` — treasury overview (likely placeholder)
- `/dashboard/org` — org / team

### Onboarding flow — `/onboarding/*`

The /onboarding/* pages are a sequenced flow new users hit after signup. Walk them in order:

- `/onboarding/about-you`
- `/onboarding/location-check`
- `/onboarding/platforms`
- `/onboarding/wallet`
- `/onboarding/invite-friends`
- `/onboarding/done`

For each: render? prefilled with your data? form fields? Submit button enabled or disabled? Don't actually submit unless inventory of form requires (e.g., the about-you state field needs a value to render the next step).

If any of these 404 because you've already completed onboarding, note that and move on.

## Step 3 — O'Toole chat sanity check

Open the right-sidebar O'Toole chat from any dashboard page.

1. Type: `What's the highest-volume Polymarket market right now?`
2. Submit. Note response time, whether it streams, whether it hits real data, and what tools it claims to call.
3. Follow-up: `What's a good 10-25 cent longshot in NBA?` (matches the user's stated price-range strategy)
4. Capture both responses verbatim in the report.

DO NOT have O'Toole create alerts, place trades, or call any write tools. Read-only chat only.

## Step 4 — Look-for list (specific concerns)

Across all pages above, also scan for and answer:

1. **Internal infra vocab leaking**: any "scrape" / "scraper" / "pnpm" / "JSONL" / "Postgres" / "RLS" / "Supabase" appearing in user-facing copy. (Per the user's stated convention, these should never surface to users — say "live prices" / "live data" / "update".)
2. **Mobile-broken pages**: which of the 3 you tested at 390px wide actually broke?
3. **Render time**: which pages took > 5s, > 10s, > 30s? (Dashboard had a known 17s post-fix; flag if anything regressed.)
4. **Empty states**: which of MyPositions / Alerts / Connections / Treasury / Leaderboard had bad empty-state copy ("nothing here" with no CTA) vs good ("no positions yet — open one from the markets browser →")?
5. **Broken links**: any link returning 404, 500, or redirecting somewhere weird?
6. **Console errors**: Top 5 most-repeated, with the page they fired on.
7. **Dead/parked surfaces**: any page that says "coming soon" / "WIP" / "not yet implemented" — list them and which ones the user-facing nav still links to (those are bug-bait).
8. **Affiliate / venue links**: do they have promo codes attached (per user's WINDAILY convention)? Do they open in new tabs?
9. **O'Toole quality**: did it answer with real market data, or a hallucinated answer?
10. **Founder-experience tells**: anywhere the page "feels off" but you can't articulate why — capture the URL and a one-line gut reaction.

## Step 5 — Final report

Return as one document with this structure. Keep entries terse — bullet style, not prose.

```
# Trading-terminal audit — <date>

## Public surfaces (un-authed)
### / (landing)
- Rendered: yes/no
- Sections: <list>
- Clickables: <list with URLs>
- Issues:
### /markets
- (etc)
... continue for /venues, /pricing, /students, /college, /hardware, /login, /signup, /forgot-password, /r/V5GHNE ...

## Mobile pass (3 pages at 390px)
- Page X: ok / broken — note
- Page Y: ok / broken — note
- Page Z: ok / broken — note

## Authed surfaces

### /dashboard (overview)
- Rendered: yes/no
- Render time: <s>
- Sections: <list>
- Clickables: <list>
- Issues:
### /dashboard/markets
- (etc)
... continue for all dashboard sub-routes ...

### Onboarding flow
- /onboarding/about-you: ...
- /onboarding/location-check: ...
- (etc)

## O'Toole chat
- Q1: <question>
- Q1 response: <verbatim>
- Q1 used real data: yes/no
- Q2: <question>
- Q2 response: <verbatim>
- Q2 used real data: yes/no
- Latency feel: snappy / slow / unusable

## Look-for-list answers
1. Internal infra vocab leaks: <list with page + verbatim text>
2. Mobile-broken: <list>
3. Slow pages: <list with timing>
4. Bad empty states: <list>
5. Broken links: <list>
6. Console errors: <top 5 with page>
7. Dead/parked surfaces still in nav: <list>
8. Affiliate links — promo codes attached? open in new tab?: <yes/no per surface>
9. O'Toole answer quality: <one sentence>
10. Founder-experience tells: <list of URL + one-line>

## Top 10 fix-tomorrow items
Ranked. Each entry: <surface> — <one-sentence problem> — <suggested fix>.
```

---

## Boundaries

- DO NOT submit any form that sends email (alert creation, profile changes, billing).
- DO NOT click any external venue affiliate link (Polymarket / Kalshi / etc.) — they'll burn the agent's session and we'll have to re-authenticate.
- DO NOT have O'Toole call any write tool (no alert creation, no trade proposals).
- DO NOT click any "delete" / "cancel subscription" / "close account" button.
- DO NOT navigate to `/admin` (out of scope; admin lives at `admin.sneakersterminal.com` anyway).
- Redact passwords from any screenshots.
- If a page takes > 30s, flag it and move on; don't keep retrying.
- This is qualitative + structural. Skip every form submit unless explicitly asked above.
- Stay on `*.sneakersterminal.com` throughout.
