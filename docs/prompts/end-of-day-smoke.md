# Chrome prompt — end-of-day smoke after today's full ship

End-of-session smoke covering everything we shipped today: trading-terminal audit polish, admin Tier A bundle, parallel multi-venue autotrade work, three migrations applied. Goal is to confirm nothing regressed from where each verify pass left us.

15-20 minutes. Read-only across the board — no submits, no destructive clicks, no broadcast send.

---

**Required inputs from the user before you start:**

- `email` — defaults to `jacksonfitzgerald25@gmail.com` (currently AUTHED, has dashboard access)
- `password` — user types it themselves at the form
- `admin_email` — defaults to `jackson@hedgepayments.com` (admin allowlist)
- `admin_password` — user types it themselves on the admin login

If any missing, STOP and ask.

---

## Step 0 — Public-side quick scan (un-authed)

Don't sign in yet. Visit each in incognito or a private window:

1. `https://sneakersterminal.com/` — landing renders, hero copy intact
2. `https://sneakersterminal.com/pricing` — 6 tiers, Enterprise reads "private deployment" NOT "dedicated infra"
3. `https://sneakersterminal.com/students` — referral attribution reads "Referred by KZSB7Z" NOT "Referred by operator KZSB7Z"
4. `https://sneakersterminal.com/college` — same vocab check
5. `https://sneakersterminal.com/hardware` — topbar does NOT show "CONNECT WALLET" button
6. `https://sneakersterminal.com/venues` — venue grid renders
7. `https://sneakersterminal.com/login` — form renders, "Remember me" checkbox present
8. `https://sneakersterminal.com/signup` — Step 1 form renders

Just confirm each page returns 200 and doesn't blow up. Not deep — call it good if the page loads cleanly.

**Public smoke result:** [list any 404 / 500 / blank / vocab-leak you spot]

---

## Step 1 — Sign in as user + dashboard smoke

Sign in at `/login` with `email` + `password`. Hand off password to user.

Land on `/dashboard`. Confirm:
- Topbar: NO permanent "LOADING" pill in right cluster
- Category cards: 4 cards (Politics / Economics / Crypto / Sports), no overlapping text
- Biggest Volume: 6 rows, each with a sparkline (flat-line OK), YES column shows the actual YES leg price (not the highest price)
- **Click on any BiggestVolume row** — should navigate to that market's detail page (this is the hydration fix from f51c551)
- Console: ZERO React error #418 / hydration warnings during sign-in + first nav

**Dashboard result:** [render time, any errors, did row clicks navigate?]

---

## Step 2 — Market detail page

From the BiggestVolume click in step 1, you should be on `/dashboard/markets/<platform>/<id>`. Confirm:
- URL has NO `seed-` prefix
- Topbar reads "Sneakers" with the standard logo lockup (NOT "O'Toole TERMINAL")
- NO Light/Dark theme toggle button
- YES price + NO price both visible; together they should be near 100¢ (within a few cents — wider spread is OK on cross-book pairs)
- YES price matches the YES% from the BiggestVolume row you clicked

Click "Dashboard" in the topbar nav to return.

**Market detail result:** [URL, YES/NO prices, any inconsistencies]

---

## Step 3 — Other dashboard surfaces (quick load)

Navigate to each, confirm 200 + no obvious breakage:

- `/dashboard/leaderboard` — renders the leaderboard page (NOT 404 — this was broken until c7bffdc)
- `/dashboard/markets` — full markets browser
- `/dashboard/minute` — minute markets (likely empty state)
- `/dashboard/alerts` — alerts list (paywall-gated for free tier OK)
- `/dashboard/connections` — connection grid; copy says "streaming live prices" NOT "scraping"
- `/dashboard/profile` — profile page renders
- `/dashboard/settings/api-keys` — security copy reads "encrypted at rest" NOT "stored encrypted in our database"
- `/dashboard/settings/autotrade` — copy doesn't reference "Kill-switch endpoint" / "POST" / "Background worker"

**Dashboard subroutes result:** [any vocab leaks or breakage]

---

## Step 4 — Onboarding stepper

Visit `/onboarding/about-you`, then `/onboarding/wallet`, then `/onboarding/done`. Confirm the step counter increments correctly: STEP 1 / 2 / 6 OF 6. On `/onboarding/done`, NO "SKIP FOR NOW" link in the footer.

**Onboarding result:** [step numbers seen]

---

## Step 5 — Sign out, sign in as admin

Sign out from the user dashboard. Then visit `https://admin.sneakersterminal.com/login`, sign in with `admin_email` + `admin_password`. Hand off password.

Land on admin home. Confirm:
- URL bar reads `admin.sneakersterminal.com/` (NOT `/admin`)
- Top nav has 13 items including AUDIT and FLAGS and ANNOUNCE
- "signed in as <email>" + SIGN OUT button visible top-right
- NO public-site footer at the bottom (no social icons, no "© 2026 Sneakers Terminal" copy)
- Stat tiles: Waitlist + Invited + Authed counts add up to total

**Admin home result:** [nav items count, footer absence confirmed, math adds up]

---

## Step 6 — Admin sub-routes (quick visits)

Each should render without 500:

- `/users` — user list, can filter by tier/type/country
- `/users/<click any row>` — detail page with ACTIONS / ADMIN ACTIVITY / USER ACTIVITY / RECORD / REFERRAL TREE sections (don't click Grant access — read-only)
- `/audit` — audit event feed (filterable)
- `/flags` — feature flags page; previously-created `verify_test_flag` and `verify_polish_pill` should be visible
- `/announcements` — broadcast composer (don't preview, don't send)
- `/clicks` — click events
- `/markets` — admin market catalog
- `/scrapers` — likely shows "Data directory not found" callout — that's expected
- `/system` — env var status table

**Admin subroutes result:** [any 500s or breakage]

---

## Step 7 — Sign out

Click SIGN OUT in admin top-right. Confirm redirect to `admin.sneakersterminal.com/login`. Try to revisit `/users` — should redirect back to `/login?next=/users`.

**Sign-out result:** [pass/fail]

---

## Step 8 — Final report

Return as:

```
## End-of-day smoke — <commits today: 9b811b7, c7bffdc, 593d438, 300da0a, f51c551>

### Public side
- Pricing: private deployment / dedicated infra
- Students/college: Referred by / Referred by operator
- Hardware topbar: CONNECT WALLET present / absent
- Anything broken:

### Dashboard
- Render time:
- LOADING pill:
- Category cards layout:
- BiggestVolume row clicks navigate: yes / no
- #418 errors observed: yes / no
- Anything broken:

### Market detail
- seed- in URL: yes / no
- Wordmark verbatim:
- Light/Dark toggle present: yes / no
- YES + NO total:
- Anything broken:

### Dashboard subroutes
- /dashboard/leaderboard renders: yes / no (was 404)
- /dashboard/connections vocab: clean / leak
- /dashboard/settings/* vocab: clean / leak
- Anything broken:

### Onboarding
- Step numbers progress correctly: yes / no
- SKIP FOR NOW gone on /done: yes / no

### Admin
- URL bar uses admin.sneakersterminal.com: yes / no
- Public footer absent: yes / no
- Stat tile math correct: yes / no
- All subroutes 200: yes / no — list 500s
- Sign-out works: yes / no

### Console error summary across the whole session
- Total #418 / hydration: <count>
- Other errors: <list>

### Top 5 fix-tomorrow items
Ranked. <surface> — <one-sentence>.

### Anything weird
(free-form)
```

---

## Boundaries

- Read-only. NO submits.
- Do not click "Grant access" / "CONFIRM" / "SEND" / "DELETE" / "REVOKE" anywhere.
- Do not click external venue affiliate links (will burn the agent session).
- Do not preview broadcast email or test alert.
- Stay on `*.sneakersterminal.com` and `admin.sneakersterminal.com`.
- Redact passwords from any screenshots.
