# Chrome prompt — full stress test (everything we shipped today + mobile)

Comprehensive stress test of the entire Sneakers Terminal — public site, authed dashboard, admin panel, multi-venue autotrade, mobile O'Toole FAB, wallet balance in topbar. Designed as a one-pass run before user travels and tests on their phone.

20-25 minutes. Read-only across the board (no submits, no destructive clicks, no broadcast send, no real credential entries).

---

**Required inputs from the user before you start:**

- `email` — defaults to `jacksonfitzgerald25@gmail.com`
- `password` — user types it themselves at the form
- `admin_email` — defaults to `jackson@hedgepayments.com`
- `admin_password` — user types it themselves at the admin login

If any missing, STOP and ask.

---

## Step 0 — Public side stress

For each, just confirm 200 + no obvious vocab leaks / breakage:

1. `/` (landing)
2. `/pricing` — Enterprise tier reads "private deployment" not "dedicated infra"
3. `/students` — "Referred by KZSB7Z" or "Referred by V5GHNE" (NOT "Referred by operator")
4. `/college` — same vocab check
5. `/hardware` — topbar does NOT have "CONNECT WALLET" button
6. `/venues` — venue grid renders
7. `/markets` un-authed — confirms it gates to login (URL should NOT contain `error=no_waitlist_row`)
8. `/login` — form renders, "Remember me" checkbox visible
9. `/signup` — Step 1 form renders

**Public summary:** [pass/fail per page, any leaks]

---

## Step 1 — Sign in as user, dashboard sweep

Sign in as `email`. Land on `/dashboard`.

### Topbar checks
- Wallet button: shows actual `$X.XX` total (likely `$0.00` since no creds saved). NOT just "💳 Wallet" with no number.
- Tap the wallet pill: popover shows TOTAL BALANCE + per-venue breakdown (or "No venues connected yet")
- Topbar venue chips on the right (AppsBar): the green-check badges should ONLY appear on venues with verified credentials. With zero credentials, no green checks.
- LOADING badge: NOT permanent

### Body checks
- Category cards (Politics / Economics / Crypto / Sports): no overlapping text, vertical-stack layout
- Biggest Volume: 6 rows, each with sparkline (flat line OK), YES column shows actual YES leg price
- **Click any BiggestVolume row** → navigates to market detail (the hydration fix from `f51c551`)
- BalanceCard: if NO credentials, shows "Connect a venue" empty state with CTA. If credentials exist, shows total + per-venue rows.
- O'Toole sidebar (left): 380px wide, renders normally. Below — open the chat, send `What email am I signed in as?` — should answer correctly.

### Console
- ZERO React error #418
- ZERO hydration warnings
- After navigating to a market detail and back, still ZERO

**Dashboard summary:** [topbar state, body state, click navigation works, console clean]

---

## Step 2 — Market detail page

From the BiggestVolume click in step 1, you should be on `/dashboard/markets/<platform>/<id>`. Confirm:

- URL has NO `seed-` prefix (e.g., `/poly-btc100k` not `/seed-poly-btc100k`)
- Topbar reads "Sneakers" with the same logo lockup as the dashboard topbar (NOT "O'Toole TERMINAL")
- NO Light/Dark theme toggle
- YES + NO prices visible. YES on this page should match YES% from the dashboard list
- Console still clean

**Market detail summary:**

---

## Step 3 — Connections page

Navigate to `/dashboard/connections`. Confirm:

- Summary strip uses "streaming live prices" (NOT "scraping")
- Per-venue cards visible
- For Polymarket / Kalshi / Opinion specifically: each card shows a CONNECT button (since you have no credentials saved)
- For other venues: CONNECT button via affiliate flow (don't click external)

**Do (UX-only):** Click CONNECT on the Polymarket card. Wizard opens with API KEY / API SECRET / PASSPHRASE fields. Type fake values: `test-fake-key`, `test-fake-secret`, `test-fake-pass`. Click SAVE.

**Expected per the verify-first fix:**
- Red error pill: "Couldn't verify the credentials: ... Nothing was saved — fix the values and try again." 
- The error message DOES NOT start with "Saved, but..."
- After cancel, the credential is NOT in `/api/balance` byVenue list

**Result:**

---

## Step 4 — Other authed surfaces (load + scan)

Each should return 200 with no obvious breakage:

- `/dashboard/leaderboard` — page renders (NOT 404; was broken until commit `c7bffdc`)
- `/dashboard/markets` — markets browser
- `/dashboard/minute` — minute markets
- `/dashboard/alerts` — alerts list
- `/dashboard/profile` — profile page
- `/dashboard/settings/api-keys` — security copy says "encrypted at rest" not "stored encrypted in our database"
- `/dashboard/settings/autotrade` — copy doesn't say "Kill-switch endpoint" / "POST" / "Background worker"
- `/dashboard/settings/otoole` — no "PLAN_OTOOLE" reference

**Results:** [list any 500 / blank / vocab leak]

---

## Step 5 — Onboarding stepper

Visit `/onboarding/about-you` → header reads "STEP 1 OF 6 · ABOUT YOU"
Visit `/onboarding/wallet` → "STEP 2 OF 6 · WALLET"
Visit `/onboarding/done` → "STEP 6 OF 6 · DONE", NO "SKIP FOR NOW" link in footer.

**Result:**

---

## Step 6 — O'Toole battery (3 questions, including the new credential awareness)

Open right sidebar O'Toole chat. Send each:

### Q1: `What email am I signed in as?`
Expected: Correct email response.

### Q2: `What venues do I have connected?`
Expected — NEW from `e71e95c`: O'Toole knows from server-injected context. Should answer accurately about whether you have credentials saved + their verified state. With zero credentials: "you don't have any venues connected yet".

### Q3: `What's my wallet balance?`
Expected — NEW from `e71e95c`: O'Toole should NOT make up a number. Should direct user to the dashboard's BalanceCard for live numbers. Honest refusal.

**Responses verbatim + judgement:** [honest / hallucinated per Q]

---

## Step 7 — Mobile resize test

**Do:** In DevTools, switch to mobile device emulation (iPhone 14 or similar, ~390x844 viewport). Reload `/dashboard`.

Expected:
- Left O'Toole sidebar GONE (was 380px wide, would have crushed the page)
- A black circular FAB with "Ø" appears bottom-right
- Tap the FAB: full-screen overlay slides in with O'Toole chat
- Body scroll locks while overlay is open
- Tap × button or press ESC: overlay closes, dashboard scrolls again

Test the chat once inside the overlay: send a quick message and confirm response renders.

**Mobile result:** [FAB visible, overlay opens, chat works, scroll locks correctly]

---

## Step 8 — Sign out, sign in as admin

Sign out from user. Visit `https://admin.sneakersterminal.com/login`, sign in with `admin_email` + `admin_password`.

Confirm:
- URL bar reads `admin.sneakersterminal.com/`
- Top nav has 13 items including AUDIT and FLAGS and ANNOUNCE
- "signed in as" + SIGN OUT button top-right
- NO public-site footer (no social icons, no marketing legal copy)

---

## Step 9 — Admin sub-routes (each should 200)

- `/users` — list, filter chips for tier/type/country
- `/users/<click any row>` — detail with ACTIONS / ADMIN ACTIVITY / USER ACTIVITY / RECORD / REFERRAL TREE sections (read-only — don't click any action button)
- `/audit` — audit feed
- `/flags` — feature flags page; previously-created `verify_test_flag` and `verify_polish_pill` should be visible
- `/announcements` — broadcast composer (DO NOT preview, DO NOT send)
- `/clicks` — click events
- `/markets` — admin market catalog
- `/system` — env var status, allowlist

**Admin sub-routes summary:** [pass per route, any 500s]

---

## Step 10 — Final report

```
## Stress test — <today's commits: 9b811b7, c7bffdc, 593d438, 300da0a, f51c551, a3560ab, e71e95c, 8c65b9e, b798e2e>

### Public side
(any breakage)

### Dashboard chrome
- Wallet button shows $X.XX in navbar: yes / no — actual value:
- Popover per-venue breakdown: render OK
- AppsBar checkmarks reflect credential health: yes / no
- LOADING badge gone: yes / no

### Dashboard body
- Category cards layout clean: yes / no
- BiggestVolume row clicks navigate: yes / no
- Sparklines flat-line OK: yes / no
- BalanceCard renders (empty state OR data): yes / no
- Console errors: <count> #418 / <count> hydration

### Market detail
- seed- in URL: yes / no
- Wordmark verbatim:
- Theme toggle present: yes / no
- YES + NO consistent with dashboard:

### Connections wizard
- Polymarket fake creds rejected: yes / no
- Error wording: "Couldn't verify..." (NOT "Saved, but..."): yes / no

### Other dashboard subroutes
- /leaderboard: pass / fail
- /alerts/settings: vocab clean
- /settings/api-keys: "encrypted at rest" present
- /settings/autotrade: vocab clean
- /settings/otoole: vocab clean

### Onboarding stepper
- Step numbers progress: yes / no
- /done has no SKIP FOR NOW: yes / no

### O'Toole battery
- Q1 email: honest / hallucinated
- Q2 venues connected: honest / hallucinated
- Q3 wallet balance: honest / hallucinated

### Mobile
- Sidebar hidden at 390px: yes / no
- FAB visible bottom-right: yes / no
- Overlay opens on tap: yes / no
- Chat works inside overlay: yes / no
- Scroll locks while open: yes / no

### Admin
- Subdomain URL clean: yes / no
- All subroutes 200: yes / no
- Public footer absent: yes / no

### Top 5 fix-tomorrow items
Ranked. Each: <surface> — <one-sentence problem>.

### Anything weird
(free-form)
```

---

## Boundaries

- READ-ONLY. No submits anywhere.
- DO NOT click "Grant access" / "CONFIRM" / "SEND" / "REVOKE" / "DELETE".
- DO NOT enter REAL credentials in the connections wizard. Only obviously-fake test strings (and only on Polymarket per step 3).
- DO NOT click external venue affiliate links.
- DO NOT preview / send a broadcast email.
- Stay on `*.sneakersterminal.com` and `admin.sneakersterminal.com`.
- Redact passwords from screenshots.
- If any page > 30s, flag it but don't retry.
