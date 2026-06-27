# Chrome prompt — verify the 4 polish fixes (commit 229368f)

Targeted verification pass for the polish bundle that just deployed,
addressing the 4 findings from the Tier A verify pass:

1. Grant access success banner missing on status flip
2. `/users?status=waitlist` was leaking AUTHED open-signup rows
3. `/announcements` "Everyone on waitlist" label was misleading
4. `/flags` create-result pill stayed pinned forever

10-15 minutes. No new writes — we re-use the seed data the previous
pass left in place (`local-test-cap@example.com` is already AUTHED;
`verify_test_flag` exists in flags table).

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `password` — current admin password
- `target_user_email` — pick a NEW WAITLIST or INVITED row to grant
  access to so we can verify the banner shows. Must be different from
  `local-test-cap@example.com` (already AUTHED). Suggest pulling a row
  from `/users?status=waitlist` after sign-in and asking the user to
  confirm before granting.

If `admin_email` or `password` missing, STOP and ask.

---

## Step 0 — Sign in

Same as before. Open `https://admin.sneakersterminal.com/login`, fill
email, hand off password to user, wait for admin home to render.

If sign-in fails or lands anywhere unexpected, STOP.

---

## ✅ Fix #1 — Grant access success banner persists across status flip

This is the regression from 1b in the previous pass. We need a real
WAITLIST or INVITED user to grant — the banner only shows up when we
actually do a write.

### 1a — find a fresh target

**Do:** Navigate to `/users?status=waitlist`. Confirm the table is
non-empty. Pick a synthetic-looking row (`@example.com`,
`@sneakersterminal.com`, anything obviously test data — NOT a real
personal email).

**STOP and confirm with the user** — show them the chosen email and
wait for "go ahead" before clicking anything.

**Pass / Fail (sanity):** [fill in — was the table populated?]
**Target chosen:** [fill in]

### 1b — perform the Grant access

**Do:** Click "view →" on the chosen row to land on `/users/<id>`. In
the ACTIONS panel, click "Grant access". Then click "Confirm grant".

**Expected:**
- Status badge near the email flips to AUTHED
- Action panel switches to "Already authed. No actions available..."
- **A green banner reading "granted access to <email> (code XXXXXXXX)"
  appears below the (now-empty) action area** — THIS is the fix
- ADMIN ACTIVITY section shows the new GRANT_ACCESS row at the top

**Pass / Fail:** [fill in — banner visible after status flip?]
**Banner text verbatim:** [fill in]

If banner does NOT appear, the fix didn't land. Capture page state
and STOP.

---

## ✅ Fix #2 — /users?status=waitlist no longer mixes AUTHED rows

### 2a — filter purity

**Do:** Navigate to `/users?status=waitlist`. Eyeball the STATUS column
of every row in the table.

**Expected:** EVERY row shows a grey WAITLIST badge. NO emerald AUTHED
badges, NO amber INVITED badges.

The previous bug had at least 2 AUTHED rows in this view
(`jacksonfitzgerald25+test1b@gmail.com` and `chrome-full-cap@example.com`).
Both should now be GONE from the waitlist filter results.

**Pass / Fail:** [fill in]
**Notes:** [if any non-WAITLIST rows still appear, list them]

### 2b — those rows now appear in /users?status=authed

**Do:** Click the AUTHED status chip. Search for `test1b` and `chrome-full-cap`.

**Expected:** Both rows appear under AUTHED. Their status badges show
emerald AUTHED. They no longer leak into waitlist view.

**Pass / Fail:** [fill in]

### 2c — counts add up

**Do:** Count rows under each filter chip:
- WAITLIST: ___ rows
- INVITED: ___ rows
- AUTHED: ___ rows
- ALL: ___ rows (sum should equal first three)

**Expected:** WAITLIST + INVITED + AUTHED = ALL.

**Pass / Fail:** [fill in]
**Counts:** WAITLIST=__ INVITED=__ AUTHED=__ ALL=__

---

## ✅ Fix #3 — /announcements label clarified

### 3a — label

**Do:** Navigate to `/announcements`. Look at the recipient radio group.

**Expected:** First radio reads:
**"Everyone — waitlist + invited + authed (capped at 500)"**

NOT the previous "Everyone on waitlist (capped at 500)".

**Pass / Fail:** [fill in]
**Verbatim label:** [fill in]

### 3b — waitlist-only group still scoped correctly

**Do:** Select "Waitlist only (no code yet, hasn't signed in)" radio.
Click PREVIEW RECIPIENTS.

**Expected:** Recipient count matches the WAITLIST row count from
fix #2c (i.e., true waitlist-only, NOT including the AUTHED open-signup
rows that previously leaked). NO AUTHED-looking emails in the sample.

**Pass / Fail:** [fill in]
**Recipient count:** [fill in]
**Sample emails (first 5):** [fill in]

**DO NOT click any SEND button.**

### 3c — "all" group still includes everyone

**Do:** Select "Everyone — waitlist + invited + authed (capped at 500)".
Click PREVIEW RECIPIENTS.

**Expected:** Recipient count = ALL count from fix #2c (everybody).

**Pass / Fail:** [fill in]
**Recipient count:** [fill in]

**DO NOT click any SEND button.** Cancel out and move on.

---

## ✅ Fix #4 — /flags create-result pill auto-clears

### 4a — pill clears after success

**Do:** Navigate to `/flags`. In the NEW FLAG form, create a flag:
- Key: `verify_polish_pill`
- Description: `temp flag, safe to delete — verifying pill auto-clear`
- start ON: leave unchecked
- Click CREATE

**Expected:** Green pill appears with "verify_polish_pill = FALSE".
**Wait 7 seconds.** The pill should DISAPPEAR by itself.

**Pass / Fail:** [fill in]
**Notes:** [time it took for the pill to clear, if not exactly 6s]

### 4b — error pill persists

**Do:** Try to create a flag with an invalid key — type `BAD KEY` (uppercase
+ space, violates the [a-z][a-z0-9_]{1,63} pattern). Click CREATE.

**Expected:** Red error pill appears. **Wait 10 seconds.** It should
STAY visible (errors don't auto-clear, by design).

**Pass / Fail:** [fill in]

---

## Step 5 — Quick smoke (rest of admin)

Just load each page and confirm 200 + nothing obviously broken. Don't
dive in.

- `/` (admin home)
- `/audit`
- `/clicks`
- `/markets`
- `/scrapers`
- `/system`

Note any page that throws a 500, takes >10s, or renders blank.

**Smoke pass:** [fill in — all OK or list anomalies]

---

## Step 6 — Final report

```
## Polish verify — 229368f

| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 1a | Found target user | | |
| 1b | Grant access banner shows post-flip | | |
| 2a | /users?status=waitlist is pure WAITLIST | | |
| 2b | Previously-leaked rows now in AUTHED | | |
| 2c | Filter counts sum to ALL | | |
| 3a | "Everyone" label updated | | |
| 3b | Waitlist-only preview is pure waitlist | | |
| 3c | "Everyone" preview matches ALL count | | |
| 4a | Create-pill auto-clears after ~6s | | |
| 4b | Error pill persists | | |

## Real writes made (intentional)
- 1 Grant access on <target_user_email>
- 1 feature_flag create: verify_polish_pill = false

## Smoke pass
(/, /audit, /clicks, /markets, /scrapers, /system — all OK / anomalies)

## Regressions spotted
(any)

## Anything weird
(free-form)
```

---

## Boundaries

- DO NOT click any SEND button on `/announcements`
- DO NOT click "confirm revoke" on `/invites`
- DO NOT click "CONFIRM DELETE" on `/system`
- ONLY grant access to the target_user_email confirmed by the user
- The two test artifacts left in DB (`verify_test_flag` from prior pass,
  `verify_polish_pill` from this pass) can be left in place
- Redact passwords from any screenshots
