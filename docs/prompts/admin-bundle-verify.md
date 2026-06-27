# Chrome prompt — verify the admin polish bundle (commit 104cfb5)

Targeted verification pass for the 8-fix bundle that just deployed. Each item below has a **do** step + an **expected** observation + a **pass/fail** field. This is NOT an inventory walk — just hit each fix specifically and confirm it landed.

Total time should be 10-15 minutes. Don't dive into anything that's not on this list unless you spot a regression.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `password` — current admin password
- `test_invite_email` — only used in one optional step (#4); SAFE because we'll cancel before submitting. Defaults to `jackson+adminqa@hedgepayments.com`

If `admin_email` or `password` missing, STOP and ask.

---

## Step 0 — Sign in

1. Open `https://admin.sneakersterminal.com/login` in a fresh tab.
2. Sign in (you'll prompt the user to type the password).
3. Confirm landing on the admin home with the URL bar reading `admin.sneakersterminal.com/`.

If sign-in lands on `/dashboard?error=not_admin` or 404s, STOP. The deploy is bad.

---

## Verification checklist

### ✅ Fix #1 — Proxy dedupe (was P0: every nav link 404'd)

**Do:** From the admin home, click each item in the top nav, in order: OVERVIEW, USERS, INVITES, ANALYTICS, CLICKS, MARKETS, SCRAPERS, ALERTS, AUTOTRADE, O'TOOLE, STUDENTS, ENTERPRISE, SYSTEM. (SIGNUPS should NOT exist anymore — see #8.)

**Expected:** Every link loads its page (200, not 404). URL bar shows `admin.sneakersterminal.com/<something>` after each click. None should produce `/admin/admin/<something>`.

**Pass / Fail:** [fill in]
**Notes:** [list any links that 404'd]

### ✅ Fix #2 — `/users?page=999` shows friendly empty state (was raw DB error)

**Do:** Navigate to `https://admin.sneakersterminal.com/users?page=999`.

**Expected:** Empty table with message like *"Page 999 is past the last page (1). Jump to page 1."* — clickable link to page 1. NO red "Query failed: Requested range not satisfiable" banner.

**Pass / Fail:** [fill in]
**Notes:** [verbatim message if different]

### ✅ Fix #3 — `/system` DELETE STRESS-TEST ROWS now requires typing DELETE

**Do:** Navigate to `https://admin.sneakersterminal.com/system`. Find the DELETE STRESS-TEST ROWS button. Click it ONCE.

**Expected:** A red panel appears with explanation copy and a text input asking you to type `DELETE`. The CONFIRM DELETE button should be DISABLED until you type `DELETE` exactly. Cancel button should be visible.

**Do (continued):** Type `delete` (lowercase) — confirm the button stays disabled. Type `DELETE` (uppercase) — confirm the button becomes enabled. Then click **Cancel** (do NOT click CONFIRM DELETE — that would actually delete rows).

**Pass / Fail:** [fill in]
**Notes:** [any UI quirks]

### ✅ Fix #4 — `/invites` revoke is now a two-step inline confirm (optional)

**Do:** Navigate to `https://admin.sneakersterminal.com/invites`. Find the PENDING table. Click ANY "revoke" link in a row. **DO NOT click "confirm revoke" after** — we don't want to actually revoke a real invite.

**Expected:** The "revoke" button transforms into a red "confirm revoke" button + a stone-colored "cancel" link. The action does NOT submit on the first click — only on the second.

**Do (continued):** Click "cancel". Confirm the row reverts to plain "revoke" link.

**Pass / Fail:** [fill in]
**Notes:** [any UI quirks]

### ✅ Fix #5 — Public marketing footer is GONE on admin pages

**Do:** Scroll to the bottom of `/admin` (home), `/users`, `/system`, and `/analytics`. Look for the public footer (broken social icons, "Student discount", "© 2026 Sneakers Terminal — Not a registered investment advisor", apex links to /venues /markets /dashboard).

**Expected:** That footer is GONE on admin pages. The page may end abruptly or with an admin-context footer (acceptable). What we DON'T want: marketing copy + apex links bleeding into admin chrome.

**Do (sanity):** Visit `https://sneakersterminal.com/` (apex landing) in a different tab. The marketing footer SHOULD still be there on apex — that's where it belongs.

**Pass / Fail:** [fill in]
**Notes:** [if footer still appears on admin, capture which page]

### ✅ Fix #6 — SIGN OUT button works

**Do:** From any admin page, find the SIGN OUT button in the top-right (next to "signed in as <email>"). Click it.

**Expected:** Button label briefly changes to "SIGNING OUT…", then you're redirected to `/login` (URL bar still on `admin.sneakersterminal.com`). You're now signed out.

**Do (verify):** Try to navigate to `https://admin.sneakersterminal.com/users` directly. You should be bounced to `/login?next=/admin` (gate engages because no session).

**Pass / Fail:** [fill in]
**Notes:** [any redirect oddness]

### ✅ Fix #7 — `/admin` home stat math adds up

**Do:** Sign back in (the SIGN OUT just happened). On the admin home, look at Row 1 stat tiles: Waitlist total, Invited (unused), Authenticated, Paid tier.

**Expected:** The "Waitlist total" tile has a hint underneath like *"X on waitlist · Y invited · Z authed"* where X + Y + Z = the total number. The Invited tile says "(unused)" or "Has invite code, hasn't signed up". The math adds up — no double-counting.

**Pass / Fail:** [fill in]
**Notes:** [the actual numbers shown — capture X / Y / Z / total]

### ✅ Fix #8 — Dead `/signup-config` nav item is gone

**Do:** Look at the top nav. Count items.

**Expected:** SIGNUPS is GONE. The remaining items: OVERVIEW · USERS · INVITES · ANALYTICS · CLICKS · MARKETS · SCRAPERS · ALERTS · AUTOTRADE · O'TOOLE · STUDENTS · ENTERPRISE · SYSTEM (13 items).

**Pass / Fail:** [fill in]
**Notes:** [if SIGNUPS is still there or item count differs]

---

## Step 9 — Final report

Return as:

```
## Bundle verification — 104cfb5

| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 1 | Proxy dedupe (nav links) | | |
| 2 | /users?page=999 empty state | | |
| 3 | /system DELETE type-to-confirm | | |
| 4 | /invites revoke two-step | | |
| 5 | Public footer suppressed on admin | | |
| 6 | SIGN OUT button works | | |
| 7 | /admin home stat math | | |
| 8 | /signup-config nav item removed | | |

## Regressions spotted
(anything that was working before and is now broken — be specific about page + behavior)

## Anything else worth surfacing
(free-form)
```

---

## Boundaries

- DO NOT click "CONFIRM DELETE" on the stress-test cleanup — that's a real destructive action against waitlist data.
- DO NOT click "confirm revoke" on any invite — that immediately invalidates a real user's code.
- DO NOT type the password into anything other than the official login form.
- Redact passwords from screenshots.
- This is a verification pass — don't go off-script. If you find new bugs, list them under "Regressions spotted" but don't dive into investigating them.
