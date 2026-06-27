# Chrome prompt — admin panel front-end smoke + stress test

End-to-end test of the Sneakers Terminal admin panel in production at **`https://admin.sneakersterminal.com`** (note: subdomain, not a path on the apex). Goal: verify every admin surface renders, confirm the subdomain routing is clean (URL bar stays on `admin.*`), exercise the live actions (issue / revoke invites), and report a punch list.

The admin panel was just moved to its own subdomain. The Next.js proxy rewrites `admin.sneakersterminal.com/foo` → `/admin/foo` internally — so URLs in this prompt drop the `/admin` prefix you'd use on the apex (e.g. `admin.sneakersterminal.com/users` is the new users page, not `admin.sneakersterminal.com/admin/users`).

This is **read-mostly + two safe writes**. The two writes are issuing and immediately revoking an invite to a controlled email — covered in detail in step 5.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `admin_email` — the email of an admin account (defaults to `jackson@hedgepayments.com` if not provided)
- `password` — the admin's password
- `test_invite_email` — an email to use as the target for the invite-issue test. Pick something the user owns or controls (e.g., `jackson+adminqa@hedgepayments.com`). MUST be different from the admin email; the test issues then revokes a code on this address. If they say "use a Gmail alias", that's fine.

If any of those are missing, STOP and ask. Don't guess.

---

## Step 0 — Sanity (subdomain routing)

1. Open `https://admin.sneakersterminal.com` in a fresh tab.
2. Without auth, you should be redirected to `https://admin.sneakersterminal.com/signup?next=/admin` (the admin gate redirects unauthed callers). Note:
   - URL bar should still read `admin.sneakersterminal.com` (NOT bounce to apex `sneakersterminal.com`)
   - SSL padlock should be green
   - If it 500s, hangs, or shows a Vercel "domain not configured" page, screenshot + STOP
3. Quick check that shared paths work on the subdomain (these were broken before today's proxy fix):
   - `https://admin.sneakersterminal.com/login` → should render the login page (200)
   - `https://admin.sneakersterminal.com/signup` → should render the signup page (200)
   - If either 404s, STOP — the proxy fix isn't live yet.

## Step 1 — Sign in as admin

1. Visit `https://admin.sneakersterminal.com/login` directly (not the apex `sneakersterminal.com/login`).
2. Email = `admin_email`, password = the password.
3. Click `SIGN IN →`.
4. Confirm:
   - URL bar reads `admin.sneakersterminal.com/...` (NOT bounced to apex)
   - You land on the admin home (NOT `/dashboard?error=not_admin`)

If you DO see `error=not_admin`, the email isn't in `ADMIN_EMAILS` — STOP and tell the user.

If you land on the user dashboard (`/dashboard` rather than admin home), the proxy may be rewriting incorrectly post-login — STOP and capture the URL.

## Step 2 — Top-level admin home

`https://admin.sneakersterminal.com/` (the subdomain root). Internally rewritten to `/admin`.

- What renders? Cards / counts / "welcome" / a sub-nav?
- What links are present in the admin nav? Capture them all (full URLs — note whether they stay on `admin.*` or jump to apex).

Note anything that looks blank, broken, or "I don't know what this is supposed to be."

## Step 3 — Users page (`https://admin.sneakersterminal.com/users`)

Where the bulk of the test happens. Note the URL is `/users` on the subdomain (which the proxy rewrites internally to `/admin/users`).

### 3a — initial render
1. Click into `/users` (or whatever link the admin nav exposes). Expect a paginated table (50 rows / page) of waitlist members with columns including: email, status (WAITLIST / INVITED / AUTHED), plan tier, referral code, direct/indirect referrals, country, created_at.
2. Note: time to render? Sort order (newest first?)? Total user count visible anywhere?
3. Confirm URL stays on `admin.sneakersterminal.com` (NOT jumping to apex).

### 3b — search
Run these searches, one at a time, noting time-to-results and count returned:
- empty (default)
- `jackson` (should match the admin's own row)
- `gmail` (likely many)
- `xxxnonsensexxx` (should produce empty state — note what the empty state looks like)
- `'; drop table` (input sanitization check — should NOT do anything destructive; should sanitize to empty or some safe subset)

### 3c — status filter
If there's a status filter (waitlist / invited / authed / all):
- Click each one. Note row count per filter. Confirm WAITLIST users have no `invited_at`, INVITED users have `invited_at` but no `invite_used_at`, AUTHED users have `invite_used_at`.

### 3d — pagination
- Click to page 2 (if it exists). Confirm rows differ from page 1, page indicator updates.
- Try `?page=999` in the URL. What happens? Empty state? 500?

### 3e — performance hint
Note the URL `?` query string after each search — confirms the search is filter-by-querystring (not client-side filter) which is fine.

## Step 4 — User detail (`https://admin.sneakersterminal.com/users/<id>`)

1. From the users list, click one row. Should land on `/users/<some-uuid>` (rewritten internally to `/admin/users/<id>`).
2. Note what's visible:
   - email, name (display_name from user_profiles), tier, plan
   - waitlist row data (referral_code, direct/indirect referrals, country, created_at)
   - invite state (code, invited_at, invite_used_at)
   - any actions (issue invite? revoke? grant access? change tier?)
   - any related-data sections (alerts? trades? click events? activity log?)
3. Specifically check: is there a one-click "Grant access" or "Burn code" button? **This is what the user wants added next** — flag whether it exists today.
4. Take a screenshot of the full detail page.

## Step 5 — Invites page (`https://admin.sneakersterminal.com/invites`) — the live-write test

### 5a — issue
1. Visit `/invites` on the subdomain.
2. Find the issue-invite form.
3. Enter `test_invite_email` and submit (without `force=1`).
4. Expected outcomes:
   - **If the email is on the waitlist already** → success message with the issued code, OR an "already has code, set force=1 to re-issue" message.
   - **If the email is NOT on the waitlist** → an error like "email not on waitlist — user must sign up for waitlist first".
5. Capture the verbatim message.

### 5b — re-issue with force
If 5a returned "already has code", retry with the force checkbox / param set. Confirm the message changes to "issued <new_code>".

### 5c — revoke
Find the revoke form / button for `test_invite_email`. Click it. Confirm the message says `revoked invite for <email>`.

### 5d — verify the trail
Go back to `/users` (subdomain root) and search `test_invite_email`. Confirm the row's status is now WAITLIST (no invite_code, no invited_at).

## Step 6 — Other admin surfaces (quick visit, ~30s each)

For each: load → screenshot → note "rendered / broken / blank / interesting". URLs are subdomain-relative (the proxy strips `/admin` for you).

- `/analytics` — what numbers are shown? signups/day? active users? revenue?
- `/clicks` — click-events dashboard from migration 026
- `/markets` — admin view of market catalog
- `/scrapers` — scraper health / last-run timestamps
- `/system` — system health / DB / env probes
- `/students` — .edu signup queue (75% off path)
- `/enterprise` — enterprise lead pipeline
- `/alerts` — alert-rules across all users
- `/autotrade` — autotrade config / queue
- `/otoole` — O'Toole usage / quotas
- `/signup-config` — signup-flow config

Note: a couple of these URLs may collide with non-admin routes that exist on the apex (e.g. `/markets` exists at `sneakersterminal.com/markets` as the public market browser). On `admin.*` they should ALWAYS resolve to the admin version because the proxy adds the `/admin` prefix internally. If any subdomain `/markets` page looks like the public market browser instead of the admin market view, flag it — that's a routing collision.

If any of these 404, say so plainly. If any throws a 500, capture the URL.

## Step 7 — Sign out + cross-subdomain check

1. Find the sign-out action (probably in the topbar or sidebar).
2. Click it. Confirm you're redirected to `/login` or `/` ON THE SAME SUBDOMAIN (URL bar should still read `admin.sneakersterminal.com`).
3. Try to revisit `https://admin.sneakersterminal.com/` — should redirect to `/signup?next=/admin` again (gate re-engaged).
4. Cross-subdomain check: now visit `https://sneakersterminal.com/dashboard` (the apex / user side). Are you signed out there too, or were you still authed via a session cookie that leaked across subdomains?
   - If still signed in on apex → cookie scope is too broad. Note this; we may want to tighten in a follow-up.
   - If signed out on apex → cookie scope was admin-only, which is the safer outcome.
5. Try `https://sneakersterminal.com/admin` (apex, NOT subdomain). What happens? 200 (still routes to admin)? 404? Redirect to subdomain? Note whichever — this tells us whether we should add an apex `/admin` → `admin.*` redirect.

## Step 8 — Final report

Return as:

```
## Subdomain routing
- admin.sneakersterminal.com without session: <redirect URL>
- admin.sneakersterminal.com/login renders: yes / no
- URL bar stays on admin.* throughout: yes / no
- SSL padlock green: yes / no

## Admin auth gate
- admin without session: <redirect URL>
- admin without admin role (if testable): <redirect URL>

## Admin home (admin.sneakersterminal.com root)
- Nav links visible: <list with full URLs>
- Anything broken / surprising:

## Users list (/admin/users)
- Initial render time: <s>
- Total rows visible (across all pages):
- Status filter present: yes / no
- Search behavior: works / surprising
- Sanitized hostile input ('; drop table) safely: yes / no
- Pagination edge case (?page=999): <result>

## User detail (/admin/users/[id])
- One-click "Grant access" / "Burn code" button exists today: yes / no
- Sections visible: <list>
- Anything obviously missing:

## Invites flow
- Issue without force: <result>
- Re-issue with force: <result>
- Revoke: <result>
- User-list reflects revoke: yes / no

## Other admin surfaces — per-page status (all on admin.sneakersterminal.com/<path>)
- /analytics: rendered / broken / blank — note
- /clicks: ...
- /markets: ... (collision check — admin view vs public market browser?)
- /scrapers: ...
- /system: ...
- /students: ...
- /enterprise: ...
- /alerts: ...
- /autotrade: ...
- /otoole: ...
- /signup-config: ...

## Sign-out + cross-subdomain
- Sign-out worked: yes / no
- admin.* re-gated after sign-out: yes / no
- Apex sneakersterminal.com still signed in (cookie leak): yes / no
- Apex /admin behavior (200/404/redirect): <result>

## Top 5 fix-tomorrow items
Ranked. Specific. Name the surface.
```

---

## Boundaries

- DO NOT issue invites to addresses other than `test_invite_email` — you'll spam real users on the waitlist.
- DO NOT revoke an invite belonging to anyone OTHER than `test_invite_email`.
- DO NOT click "delete" / "purge" / "wipe" actions if any exist anywhere — flag them, don't trigger.
- DO NOT impersonate or "view as" any other user account; if such an action exists on the user-detail page, NOTE it but DO NOT click.
- Redact passwords from screenshots.
- If any page takes >30s to render, flag it but don't keep retrying — that pattern caused the dashboard 500 yesterday.
