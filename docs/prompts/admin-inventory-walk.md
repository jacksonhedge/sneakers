# Chrome prompt — admin panel inventory walk (what's there, what works, what's wired)

Walk every page of the Sneakers Terminal admin panel at `https://admin.sneakersterminal.com` and produce a **complete inventory**: for each page, list every clickable thing, every form field, every data widget, and call out what's wired (does the action), what's stubbed (visible but inert), what's broken (errors / 404s), and what's missing (placeholder copy / coming-soon).

This is **NOT a smoke test** and **NOT a feature test**. The goal is a structured, scannable map of the surface area so the founder can decide what to polish, what to gut, and what to build next. Be exhaustive — quantity matters more than narrative.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `password` — current admin password
- `test_invite_email` — for the ONE write action you'll exercise (issue + revoke an invite). Should be a Gmail alias the user owns, e.g. `jackson+adminqa@hedgepayments.com`. MUST be different from `admin_email`.

If any are missing, STOP and ask.

---

## Step 0 — Sign in

1. Open `https://admin.sneakersterminal.com/login` in a fresh tab.
2. Sign in (user types password). Confirm:
   - URL bar reads `admin.sneakersterminal.com` after redirect (NOT bounced to apex)
   - You land on the admin home (NOT `/dashboard?error=not_admin`)
3. If sign-in lands you anywhere other than admin home, STOP and capture the URL + console errors.

## Step 1 — Top-level admin home

URL: `https://admin.sneakersterminal.com/` (proxy rewrites to `/admin`).

Capture:

- **Page title / heading** (verbatim)
- **Top nav / sidebar** — list every link by label + URL. Note which subdomain they target (admin.* / apex / app.*).
- **Tiles / cards on the page** — for each: title, what numbers/data it shows, whether it links anywhere on click, whether it looks "real" (live data) vs "placeholder" (mocked / coming-soon)
- **Footer / status strip** — anything?
- **Any visible feature flags / mode switches**?

Take a full-page screenshot.

## Step 2 — One full pass through every admin sub-route

For EACH of these routes, do the same five-question inventory:

A. **Did it render?** (200 / 404 / 500 / blank / partial)
B. **What's on the page?** — list headings, sections, tables, charts.
C. **What's clickable?** — for every button / link / form field / dropdown / checkbox / row-action: enumerate them with their labels.
D. **What does each click DO when triggered?** — for the harmless / read-only ones, click and see. For destructive / write actions (delete, send-email, charge, grant-access, expire, etc.), DO NOT click — just note "destructive, not exercised".
E. **What's missing / broken / placeholder?** — empty states, "coming soon" copy, lorem ipsum, broken images, console errors.

Routes (URLs are subdomain-relative; the proxy adds `/admin` internally):

1. `/` — home (already done in Step 1, skip)
2. `/users` — waitlist + auth users list
3. `/users/<id>` — user detail (click into one row from /users; pick the row matching `admin_email` if findable, else the first row)
4. `/invites` — invite-code issuance + revocation
5. `/analytics` — signup / engagement / revenue numbers
6. `/clicks` — click-events dashboard from migration 026
7. `/markets` — admin view of market catalog
8. `/scrapers` — scraper / data-source health
9. `/system` — system health, DB probes, env checks
10. `/students` — .edu signup queue (75% off path)
11. `/enterprise` — enterprise lead pipeline
12. `/alerts` — alert rules across all users
13. `/autotrade` — autotrade config / queue
14. `/otoole` — O'Toole usage / quotas
15. `/signup-config` — signup-flow config

For each, screenshot if visually interesting. If a route 404s, just say so — don't dwell.

## Step 3 — One write-action test (controlled)

This is the ONLY place you exercise a write action. The point: confirm the issue+revoke loop works end-to-end with a fresh email.

1. Visit `/invites`.
2. Issue an invite to `test_invite_email` (without `force=1`):
   - Capture the success message verbatim
   - Capture the issued code
3. Visit `/users` and search for `test_invite_email` — confirm a row exists with status INVITED.
4. Go back to `/invites` and revoke `test_invite_email`'s invite.
   - Capture the revoke message
5. Re-visit `/users` and search again — confirm status flipped back to WAITLIST.

If any of those four steps fails, capture the response (network tab response body if there) and STOP that branch — note the failure in the report.

## Step 4 — Look-for list (specific things the founder wants to know)

Across all pages above, also scan for and answer:

1. **Is there a one-click "Grant access" / "Burn invite" button on `/users/<id>`?** — the founder asked about this; today it's done via tsx script.
2. **Is there a "View as user" / impersonation feature anywhere?** Don't click — note presence.
3. **Is there a "Change tier" / "Upgrade plan" action on user detail?** Don't click — note presence.
4. **Is there any KYC / verification UI?** (We expect: no — KYC is intentionally parked until testers ramp.)
5. **Is there a real-time / realtime indicator anywhere?** (auto-refresh, websocket, etc.)
6. **Is there evidence of dark vs light mode toggle?**
7. **Are there any "DANGER" / "destructive" actions that look one-click without confirmation?** (e.g., delete user without modal). These are bug-bait.
8. **Are admin actions logged anywhere visible?** (audit log, recent-activity feed, etc.)
9. **Is there a search across users that supports more than email?** (name, ID, tier, country)
10. **Is the `/users` list newest-first?** Old-first would be a sort bug.

## Step 5 — Performance + console hygiene

For each page that rendered:

- Approximate render time (good < 2s, OK 2-10s, slow > 10s, very slow > 30s — flag the slow ones)
- Console errors? List them with page + message (truncate stack traces; just the top line)
- Any 4xx / 5xx network calls observed? Same: list with page + URL + status

## Step 6 — Final report

Return as one document with this structure. Keep entries terse — bullet style, not prose.

```
# Admin panel inventory — <date>

## Sign-in flow
- URL after sign-in:
- Anything weird:

## /admin home
- Heading:
- Nav links: <list with URLs>
- Tiles/cards: <list>
- Anything broken/missing:

## Per-route inventory
### /users
- Rendered: yes/no
- Sections: <list>
- Clickables: <list>
- Click results: <list>
- Missing/broken:
### /users/<id>
- Rendered: ...
- (etc)
### /invites
- (etc)
... continue for all 13 remaining routes ...

## Write-action test (issue + revoke)
- Issue result:
- Code returned:
- /users reflects INVITED: yes/no
- Revoke result:
- /users reflects WAITLIST after revoke: yes/no

## Look-for-list answers
1. One-click "Grant access" on /users/<id>: yes / no — note
2. View-as-user / impersonation: yes / no — note
3. Change tier / upgrade plan action: yes / no — note
4. KYC UI: yes / no — note
5. Realtime indicator: yes / no — note
6. Dark/light toggle: yes / no — note
7. Unconfirmed destructive actions: <list>
8. Audit log / recent activity: yes / no — note
9. Search beyond email (name/id/tier/country): yes / no — note
10. /users sort order (newest first): yes / no

## Performance
- Slow pages (> 10s): <list with timing>
- Very slow pages (> 30s): <list>

## Console errors / network failures
- <list grouped by page>

## Top 10 fix-tomorrow items
Ranked. Each entry: <surface> — <one-sentence problem> — <suggested fix>.
```

---

## Boundaries

- DO NOT click any "delete" / "purge" / "wipe" / "expire" button anywhere. Note presence; don't trigger.
- DO NOT issue invites to ANY address other than `test_invite_email`.
- DO NOT revoke an invite for any address other than `test_invite_email`.
- DO NOT impersonate / "view as" any account if such an action exists.
- DO NOT change tier / plan / billing on any user, including yourself.
- DO NOT modify env / signup-config / autotrade settings — read-only inspection.
- Redact passwords from screenshots.
- If a page takes > 30s, flag it and move on; don't keep retrying. The dashboard had this exact failure mode earlier this week and we don't want to re-trigger Vercel function timeouts on retry storms.
- If you see anything that looks like leaked secrets, PII spilled into UI, or session tokens in URLs — flag prominently and DO NOT screenshot the actual value (describe it instead).
