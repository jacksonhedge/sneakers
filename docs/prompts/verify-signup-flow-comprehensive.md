# Comprehensive front-end + functionality verify — signup-flow round

Background: 5 commits shipped tonight to improve the signup → approval → access loop:
- `ad279e8` — approve-user sends email via Resend
- `18ffe0f` — queue position on /pending + bulk approve in /admin/users
- `d745b29` — single-screen signup (was two-step)
- `da2fc81` — tier badge in dashboard topbar

Plus this morning's perf work (`4b80219` chart history, `5bd4251` canonical_id cold-start, `eb19c4d` landing count, `6983700` cache dedup, `48d1c76` cross-book + starts_at, `545197a` slow-query observability, `133fdb6` footer count fix, `ebb99b0` polymarket parallel, `426aff5` ORDER BY removal, `ad279e8`-`da2fc81`). All on prod now.

Goal: comprehensive end-to-end test of the front-end + functionality. Not just "does it render" — actual workflow verification, accessibility, console hygiene, regression checks.

You're a senior QA engineer doing a release review. **Specific. Verbatim text. Counts. Screenshots if anything looks off.**

**Auth note:** for the signup test in Step 2, you'll need to enter a test password into a fresh Supabase auth row. Acceptable if user provides one in chat OR you use a generated test password (something obvious like `TestPass123!`) — that's a TEST account, not a real credential. If your secret-handling rules block this, pause and ask the user.

## Step 1 — Confirm latest deploy

1. Vercel → sneakers-terminal → Deployments. Find `da2fc81` (tier badge — most recent).
2. Confirm: Ready, Current, Production. Build time + elapsed since push.
3. Check that the four prior signup-flow commits + the perf trio also appear as Ready in the Deployments list.

Report:
- da2fc81 deployment id + status
- Anything stuck in Building / Error?

## Step 2 — Single-screen signup (commit d745b29)

1. Open a fresh **incognito** tab. Go to `https://sneakersterminal.com/signup`.
2. Observe the form **before** typing anything. Report:
   - All four fields visible at once: email, name, password, access code? (or is it still two-step?)
   - Submit button label when no fields are filled (should be "JOIN WAITLIST →")
3. Fill in: a fresh test email (like `qa-${timestamp}@test.sneakersterminal.local`), name "QA Tester", password (see auth note above), leave code empty.
4. Confirm:
   - Submit button text now reads "JOIN WAITLIST →" (no code path)
   - Type 8 chars in the code field — does the label change to "ENTER TERMINAL →"? Clear it again — does it flip back?
5. Press Enter on the form (don't click). Should submit (default action).
6. Report:
   - Network panel: request to `/api/auth/signup`, status, response body
   - Page state after: confirmation message? redirect to /dashboard? to /pending?
   - Any console errors

## Step 3 — /pending queue position (commit 18ffe0f)

If Step 2 left you on `/pending` (most likely path for a no-code signup):

1. Report the **queue position card** verbatim:
   - Header label
   - Position number
   - "of N" total
   - "X testers ahead of you" line
2. Compare to the static "you're in line" card that was there before — should now have a prominent emerald position card ABOVE the email/joined/status box.
3. Hard-refresh — does the position update or stay the same? (Should refresh from DB each time; force-dynamic is set.)
4. Sign out, then back in — do you land back on /pending with the same position?

If Step 2 didn't leave you on /pending (you got auto-approved), still verify by:
- Sign out
- Sign in as the QA test user
- Should land on /pending if waitlist row's invite_used_at is null

## Step 4 — Admin login + tier badge (commit da2fc81)

You'll need to switch to the admin account here (user provides credentials separately or it's a known account).

1. Sign in as admin. Land on /dashboard.
2. Look at the **top bar**, right side. Report:
   - Is there a small pill before the profile avatar?
   - What does it say verbatim? (Should be one of: `FREE · UPGRADE`, `PRO`, `ELITE`, `BUSINESS`, `FRAT`)
   - What color treatment? (FREE = stone-muted, PRO = emerald, ELITE = amber, BUSINESS/FRAT = stone-900)
3. Click it. Where does it go?
   - FREE → `/pricing`
   - paid tiers → `/dashboard/billing`
4. Resize browser to mobile width (~375px). Does the badge hide? (Should — it's `hidden md:inline-flex`.)
5. Resize back to desktop — does it reappear?

## Step 5 — Bulk approve panel (commit 18ffe0f)

Still as admin.

1. Navigate to `https://sneakersterminal.com/users` (or `/admin/users`).
2. Scroll to top. Just below the page header (Users / N rows / search box) should be a `<details>` collapsible labeled **"BULK APPROVE — paste emails"**.
3. Click to expand. Report:
   - Textarea visible? Placeholder text verbatim
   - Counter ("0 unique emails" or similar)
   - Approve button state (should be disabled when empty)
4. Paste the QA test email from Step 2. Counter should update to "1 unique email", button enables.
5. Click "APPROVE 1". Report:
   - Button label during in-flight: "APPROVING 1…"
   - Network panel: request to `/api/admin/approve-users-bulk`, response body verbatim
   - Result panel that appears below: "✓ N approved" line, any errors
6. Refresh /admin/users. Find the QA test user row — should now show as approved (no APPROVE button, REVOKE shows instead).
7. Test the duplicate-handling: paste the QA email again, click approve. Should report "1 already in" (not "1 approved" — the bulk endpoint short-circuits already-approved rows).
8. Test the not-found path: paste a fake email like `nobody-fake@test.local`, approve. Should report "1 not found".

## Step 6 — Approve email arrived (commit ad279e8)

The approve in Step 5 should have triggered a Resend send.

1. Open the inbox for the QA test email. (If it's a `+test` style address routed to your real email, check that. If you used a literal-format like `qa-X@test.sneakersterminal.local`, that won't deliver — note that and skip.)
2. Confirm:
   - Email arrived?
   - Subject: "You're in — Sneakers Terminal"
   - "OPEN DASHBOARD →" button visible?
   - Click the button — lands on /dashboard?
3. If email didn't arrive:
   - Vercel → Logs → Runtime → search "approve-user" or "approved send" — quote any error lines verbatim
   - Resend dashboard (if accessible) → check delivery status

## Step 7 — Single-approve still works (commit ad279e8)

The /admin/users row-level ApproveButton — make sure it didn't break with the bulk panel addition.

1. Find a different pending user (or revoke the QA user from Step 5 to recreate one).
2. Click the green **APPROVE** button on the row.
3. Report:
   - Button label during in-flight: "APPROVING…"
   - Row updates to show REVOKE button after success
   - The user gets an email (same Resend send path)
4. Click REVOKE. Verify it bumps them back to APPROVE state.

## Step 8 — Verify previous-round perf wins didn't regress

Quick spot checks on this morning's commits to make sure tonight's signup-flow work didn't break anything:

1. **Cold-start on a market detail** (`5bd4251`):
   - From the dashboard, hard-refresh, click any OG market.
   - Network Time should be <1.5s (was ~700ms last verify; allow some variance).
   - Chart should show real curve (not "Live quotes loading…" or "still loading" banner).

2. **Dashboard footer count** (`133fdb6`):
   - On /dashboard, footer should still show "N markets across Kalshi, Polymarket, OG Markets, NoVig, and ProphetX" with N >190k.

3. **Apps-bar OG** (`232f384`):
   - On /dashboard, the apps-bar venue logos in order: Polymarket, Kalshi, OG, NoVig, ProphetX. (NOT just the first four — OG should be in slot 3.)

4. **NotAdminBanner**:
   - Visit `/dashboard?error=not_admin` while signed in. Amber banner should appear at the top above BalanceCard.

## Step 9 — Console hygiene + a11y spot checks

Throughout Steps 2-8, keep DevTools console open. Also press Tab repeatedly on key pages to test keyboard navigation.

Report any of:
- Red console errors (verbatim, with stack frame if visible)
- Yellow warnings mentioning hydration, missing keys, deprecated APIs
- Tab-trap or skipped focus states (e.g., the bulk-approve textarea should be reachable by Tab)
- Any element with low contrast that's hard to read (especially the tier badge variants)

## Step 10 — Function logs sanity

Vercel → Logs → Runtime → last 30 min on `da2fc81` deployment.

Report:
- 5xx count
- Any errors mentioning `approve-user`, `approve-users-bulk`, `pending`, `signup-form`, `dashboard-shell`, `topbar-v2`
- New `[db] slow query` lines (the observability we added) — what's the slowest one's `Xms / rows=N` and which SQL prefix?

## Report back

```
## Step 1. Deploy
- da2fc81: <id, status, build time>
- All 5 signup-flow commits Ready: y/n
- All 9 perf commits Ready: y/n

## Step 2. Single-screen signup
- All 4 fields visible at once: y/n
- Submit label flips PRO/WAITLIST based on code: y/n
- Network response on submit: <status, body>
- Post-submit destination: <…>

## Step 3. /pending queue position
- Position card verbatim: <…>
- Position number: #<N> of <M>
- Refresh updates position: y/n
- Returning user lands on /pending: y/n

## Step 4. Tier badge
- Pill visible: y/n
- Verbatim text: <…>
- Color variant: <stone/emerald/amber/stone-900>
- Click destination: <url>
- Hides on mobile: y/n

## Step 5. Bulk approve
- Panel collapsible visible: y/n
- Counter updates with paste: y/n
- Approve N response: <verbatim>
- Already-approved short-circuit works: y/n
- Not-found path works: y/n

## Step 6. Approve email
- Subject verbatim: <…>
- "OPEN DASHBOARD" button works: y/n
- Resend errors in logs: <NONE | list>

## Step 7. Single-approve
- Row updates after APPROVE: y/n
- Email also fires on single approve: y/n
- REVOKE works: y/n

## Step 8. Regression checks
- Market-detail cold time: <ms>
- Chart shows real curve: y/n
- Footer count: <verbatim>
- Apps-bar OG in slot 3: y/n
- NotAdminBanner appears on ?error=not_admin: y/n

## Step 9. Console + a11y
- Red errors: <list verbatim or NONE>
- Hydration warnings: <…>
- Tab-nav issues: <…>
- Contrast issues: <…>

## Step 10. Function logs
- 5xx count: <N>
- New errors on touched routes: <NONE | list>
- Slowest [db] slow query: <ms / rows=N / sql prefix>

## OVERALL VERDICT
- Tier 1+2 signup-flow ship: <FULL SUCCESS / PARTIAL / FAILED>
- Perf wins still holding: <y/n>
- Console clean: <y/n>
- Issues to flag for next session: <list>
```
