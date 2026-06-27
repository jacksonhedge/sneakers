# Signup-flow verify · PASS 1 of 2 — new features

Background: 4 commits shipped tonight to improve the signup → approval → access loop:
- `ad279e8` — approve-user sends email via Resend
- `18ffe0f` — queue position on /pending + bulk approve in /admin/users
- `d745b29` — single-screen signup (was two-step)
- `da2fc81` — tier badge in dashboard topbar

This pass: end-to-end test of the new front-end features + the underlying API behavior. Pass 2 (separate prompt) covers regression + perf checks. Either order is fine.

You're a senior QA engineer. **Specific. Verbatim text. Counts. Screenshots if anything looks off.**

**Auth note:** Step 2 needs to enter a test password into a new Supabase auth row. Use a generated test password like `TestPass123!` (it's a TEST account, not a real credential). If your rules block this, pause and ask the user.

## Step 1 — Confirm latest deploy

1. Vercel → sneakers-terminal → Deployments. Find `da2fc81` (tier badge — most recent).
2. Confirm: Ready, Current, Production. Build time + elapsed since push.
3. Check the four signup-flow commits all appear as Ready:
   - `da2fc81` (tier badge)
   - `d745b29` (single-screen signup)
   - `18ffe0f` (queue position + bulk approve)
   - `ad279e8` (approve email)

Report any stuck in Building / Error.

## Step 2 — Single-screen signup (`d745b29`)

1. Open a fresh **incognito** tab. Go to `https://sneakersterminal.com/signup`.
2. Observe the form **before** typing anything. Report:
   - All four fields visible at once: email, name, password, access code? (or is it still showing only step 1?)
   - Submit button label when no fields are filled (should read "JOIN WAITLIST →")
3. Fill in: a fresh test email like `qa-${unix-timestamp}@test.sneakersterminal.local`, name "QA Tester", password `TestPass123!`, leave code empty.
4. Confirm:
   - Submit button text reads "JOIN WAITLIST →" (no code path)
   - Type 8 chars in the code field — does the label change to "ENTER TERMINAL →"? Clear it again — does it flip back?
5. Press Enter on the form (don't click the button). Should submit (default action).
6. Report:
   - Network panel: request to `/api/auth/signup`, status, response body verbatim
   - Page state after: confirmation message? redirect to /dashboard? to /pending?
   - Any console errors

If the API needs email confirmation, the page will say "check your email" — note that and skip directly to Step 3 by signing in manually.

## Step 3 — /pending queue position (`18ffe0f`)

If Step 2 left you on `/pending`:

1. Report the **queue position card** verbatim:
   - Header label (should be "YOUR POSITION")
   - Position number
   - "of N" total
   - "X testers ahead of you" line if visible
2. Compare to the rest of the page: should be a prominent emerald card ABOVE the email/joined/status box. The static "you're in line" headline should still be there too.
3. Hard-refresh (Cmd+Shift+R) — does the position number stay accurate?
4. Sign out and sign back in as the same QA user — should land back on /pending with the same position.

If Step 2 didn't leave you on /pending (auto-approved), still verify by:
- Sign out
- Sign in as the QA test user
- If you land on /dashboard, that means auto-approval fired (post-signin sets invite_used_at on first sign-in) — note that and skip the queue-position UI check (it only renders for users with invite_used_at=null)

## Step 4 — Admin sign-in + tier badge (`da2fc81`)

You'll need admin credentials here. User provides separately.

1. Sign in as admin. Land on /dashboard.
2. Look at the **top bar**, right side. Report:
   - Is there a small pill before the profile avatar?
   - Verbatim text? Should be one of: `FREE · UPGRADE`, `PRO`, `ELITE`, `BUSINESS`, `FRAT`
   - Color treatment? FREE = stone-muted, PRO = emerald, ELITE = amber, BUSINESS/FRAT = stone-900
3. Click it. Where does it go?
   - FREE → `/pricing`
   - paid tiers → `/dashboard/billing`
4. Resize browser to mobile width (~375px). Does the badge hide? (Should — `hidden md:inline-flex`.)
5. Resize back to desktop — does it reappear?

## Step 5 — Bulk approve panel (`18ffe0f`)

Still as admin.

1. Navigate to `https://sneakersterminal.com/users` (or `/admin/users`).
2. Just below the page header (Users / N rows / search box) should be a `<details>` collapsible labeled **"BULK APPROVE — paste emails"**.
3. Click to expand. Report:
   - Textarea visible? Quote placeholder text verbatim
   - Counter ("0 unique emails" or similar)
   - Approve button state when empty (should be disabled)
4. Paste the QA test email from Step 2. Counter should update to "1 unique email", button enables.
5. Click "APPROVE 1". Report:
   - Button label during in-flight (should read "APPROVING 1…")
   - Network panel: request to `/api/admin/approve-users-bulk`, response body verbatim
   - Result panel that appears below: "✓ N approved" line + any other counts
6. Refresh /admin/users. Find the QA test user row — should now show as approved (REVOKE button instead of APPROVE).
7. **Test duplicate handling**: paste the same QA email again, click approve. Should report "1 already in" (not "1 approved").
8. **Test not-found**: paste `nobody-fake@test.local`, approve. Should report "1 not found".

## Step 6 — Approve email arrived (`ad279e8`)

The approve in Step 5 should have triggered a Resend send.

If your QA email goes to a real inbox you can check:
1. Confirm:
   - Email arrived?
   - Subject verbatim: "You're in — Sneakers Terminal"
   - "OPEN DASHBOARD →" button visible
   - Click it — lands on /dashboard?

If the email is a placeholder address that won't deliver:
1. Vercel → Logs → Runtime → search "approved send" or `[approve-user]` or `[email] approved` in last 10 min
2. Report any error lines verbatim
3. If no errors, the send fired (best-effort try/catch swallows logs only on failure)

## Step 7 — Single-approve still works (`ad279e8`)

The /admin/users row-level ApproveButton — make sure it didn't break with the bulk panel addition.

1. Find a different pending user (or REVOKE the QA user from Step 5 to recreate one).
2. Click the green **APPROVE** button on the row.
3. Report:
   - Button label during in-flight: "APPROVING…"
   - Row updates to show REVOKE button after success
   - Email also fires? (check inbox or logs as in Step 6)
4. Click REVOKE. Verify it bumps them back to APPROVE state.

## Step 8 — Console hygiene during this pass

Throughout Steps 2-7, keep DevTools console open.

Report:
- Red console errors (verbatim with stack frame if visible)
- Yellow warnings mentioning hydration, missing keys, deprecated APIs
- Did Tab navigation reach all interactive elements (especially the bulk-approve textarea)?

## Report back

```
## Step 1. Deploy
- da2fc81 deploy: <id, status, build time>
- 4 signup-flow commits all Ready: y/n
- Stuck deploys: <NONE | list>

## Step 2. Single-screen signup
- All 4 fields visible at once: y/n
- Initial submit label: <verbatim>
- Submit label flips when code typed: y/n
- Enter-to-submit works: y/n
- Network response status / body: <…>
- Post-submit destination: <…>

## Step 3. /pending queue position
- Position card visible: y/n
- Verbatim: "<…>"
- Position number: #<N> of <M>
- "X ahead of you" line: <verbatim or absent>
- Refresh keeps state: y/n
- Returning user lands on /pending: y/n (or auto-approved? note)

## Step 4. Tier badge
- Pill visible in topbar: y/n
- Verbatim text: <…>
- Color variant: <stone/emerald/amber/stone-900>
- Click destination: <url>
- Hides on mobile width: y/n

## Step 5. Bulk approve
- Panel collapsible visible: y/n
- Textarea placeholder: <verbatim>
- Counter updates with paste: y/n
- Approve N response body: <verbatim>
- Already-approved short-circuit works: y/n
- Not-found path works: y/n

## Step 6. Approve email
- Subject verbatim: <…>
- "OPEN DASHBOARD" button works: y/n
- (If unable to check inbox) Resend errors in logs: <NONE | list>

## Step 7. Single-approve
- Row updates after APPROVE: y/n
- Email also fires on single approve: y/n
- REVOKE works: y/n

## Step 8. Console hygiene
- Red errors: <list verbatim or NONE>
- Hydration warnings: <…>
- Tab-nav issues: <…>

## VERDICT (Pass 1)
- Single-screen signup: <SUCCESS / PARTIAL / FAILED>
- Queue position: <…>
- Tier badge: <…>
- Bulk approve: <…>
- Approve email: <…>
- Single-approve untouched: <…>
- Issues to flag for next session: <list>
```
