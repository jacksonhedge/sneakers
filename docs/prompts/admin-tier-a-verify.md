# Chrome prompt — verify Tier A admin bundle (commits a4c06eb + ac49e86 + c309446)

Targeted verification pass for the 5-item Tier A bundle that just deployed.
Each item below has a **do** step, an **expected** observation, and a
**pass/fail** field. This is NOT an inventory walk — hit each fix and
confirm it landed.

Total time: 15-20 minutes. Three real writes happen (one Grant access,
one feature-flag create, one feature-flag toggle). Every other action is
read-only or preview-only.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `password` — current admin password
- `target_user_email` — email of an existing waitlist user to use as the
  Grant-access target. MUST be a real waitlist user that's currently in
  WAITLIST or INVITED status (NOT already AUTHED — Grant on AUTHED is a
  no-op). Use `jackson+adminqa@hedgepayments.com` only if it's already
  on the waitlist; otherwise pick another row from `/users` first and
  give the user that email to confirm.

If `admin_email` or `password` missing, STOP and ask.

---

## Step 0 — Sign in

1. Open `https://admin.sneakersterminal.com/login` in a fresh tab.
2. Sign in.
3. Confirm landing on the admin home with URL `admin.sneakersterminal.com/`.

If sign-in fails, STOP.

---

## ✅ Fix #1 — Audit log + per-user ADMIN ACTIVITY timeline

This needs a real audit row to verify, so we'll perform one Grant access
and watch it appear in two places.

### 1a — confirm /audit page exists and renders

**Do:** Navigate to `https://admin.sneakersterminal.com/audit`.

**Expected:**
- Page loads with header "ADMIN AUDIT", a count badge, and an event table
- Filter form: ACTOR + TARGET text inputs, SEARCH button
- Action chip row showing distinct action types (may be empty if no events yet)
- Table columns: WHEN · ACTOR · ACTION · TARGET · METADATA

**Pass / Fail:** [fill in]
**Notes:** [event count, or "no events yet"]

### 1b — perform a real Grant access to populate the log

**Do:**
1. Navigate to `/users` and find a row matching `target_user_email`.
2. Click "view →" to land on `/users/<id>`.
3. In the ACTIONS panel, click "Grant access" (or "Burn code" if INVITED).
4. Click "Confirm grant" on the second-step button. Wait for the result.

**Expected:** Green message like `granted access to <email> (code XXXXXXXX)`. Status badge near the email flips to AUTHED.

**Pass / Fail:** [fill in]
**Notes:** [verbatim result message]

### 1c — confirm the event appears on /users/<id>

**Do:** Stay on the user-detail page. Scroll to the "ADMIN ACTIVITY" section (between ACTIONS and RECORD).

**Expected:** A row at the top with WHEN = just now, ACTOR = your admin email, ACTION = GRANT_ACCESS pill (emerald), METADATA showing the issued code + previously_authed flag.

**Pass / Fail:** [fill in]
**Notes:** [first row content]

### 1d — confirm the event appears on /audit

**Do:** Navigate to `/audit`. Look for the most recent event.

**Expected:** Same event from 1c, top of the table. ACTION column shows the GRANT_ACCESS pill. Filter chips include `GRANT_ACCESS`.

**Pass / Fail:** [fill in]

### 1e — try filtering

**Do:** In the /audit search form, type your `target_user_email` into TARGET and click SEARCH.

**Expected:** Table narrows to rows where target matches; URL gains `?target=...`.

**Pass / Fail:** [fill in]

---

## ✅ Fix #2 — Per-user USER ACTIVITY (click_events) timeline

**Do:** From `/users/<id>` (still on the same target user), scroll to the "USER ACTIVITY" section (right below ADMIN ACTIVITY).

**Expected:** One of three states:
- If they've never authenticated: copy "User hasn't authenticated yet — no auth.users row, no page-views to show."
- If they're authed but no click_events: copy "Authenticated as <uuid> but no click_events recorded..."
- If they have events: a table with columns WHEN · EVENT · PAGE · TARGET · GEO showing recent page_view events.

Note: jackson@hedgepayments.com (your admin) almost certainly has events from this session. Visit `/users` and find his row to verify state #3.

**Pass / Fail:** [fill in]
**Notes:** [which state was hit + a sample event row]

---

## ✅ Fix #3 — Richer user search on /users

### 3a — filter chips render

**Do:** Navigate to `/users`.

**Expected:** Three chip rows visible above the table:
- STATUS: ALL / WAITLIST / INVITED / AUTHED
- TIER: ALL / FREE / PRO / ELITE / BUSINESS
- TYPE: ALL / INDIVIDUAL / BUSINESS

Plus a country text input next to the search box (placeholder "country (US)").

**Pass / Fail:** [fill in]

### 3b — filters compose

**Do:** Click TIER → FREE. URL should gain `?tier=free`. Click TYPE → INDIVIDUAL. URL should gain `&type=individual`. Type `US` into the country field, hit SEARCH.

**Expected:** All three filters visible in the URL; row count drops; "clear" link appears.

**Pass / Fail:** [fill in]
**Notes:** [final URL + row count]

### 3c — clear works

**Do:** Click "clear".

**Expected:** URL drops back to bare `/users`. All filters reset to ALL.

**Pass / Fail:** [fill in]

### 3d — text search covers more fields

**Do:** Search `q=jackson`. Then `q=hedgepayments`. Then a known referral code if you saw one earlier.

**Expected:** Each search returns matching rows. The text search now hits email + company_name + referral_code + invite_code.

**Pass / Fail:** [fill in]

---

## ✅ Fix #4 — Writable feature flags (/flags)

This step performs TWO real writes to a NEW flag we'll create just for the test.

### 4a — page renders

**Do:** Navigate to `/flags`.

**Expected:** "FEATURE FLAGS" header, count, NEW FLAG form, and an empty-state message ("No flags defined yet") OR a table of existing flags.

**Pass / Fail:** [fill in]

### 4b — create a test flag

**Do:** In the NEW FLAG form, enter:
- Key: `verify_test_flag`
- Description: `temporary flag created during admin verify pass; safe to delete`
- Leave "start ON" unchecked
- Click CREATE

**Expected:** Green message `verify_test_flag = FALSE`. The form clears. The flag appears in the table below with VALUE = FALSE pill.

**Pass / Fail:** [fill in]

### 4c — toggle the flag

**Do:** In the row for `verify_test_flag`, click "FLIP TO TRUE". Then click "CONFIRM → TRUE".

**Expected:** Green message `verify_test_flag = TRUE`. VALUE pill flips to emerald TRUE. UPDATED column shows today's date + your admin email as updated_by.

**Pass / Fail:** [fill in]

### 4d — flag flips show up in audit log

**Do:** Navigate to `/audit`. The two newest rows should be `SET_FEATURE_FLAG` events (one for the create, one for the flip).

**Expected:** Both rows present. Metadata column shows the prior_value, new_value, and changed flag.

**Pass / Fail:** [fill in]

(Leaving the test flag in the DB is fine — it's harmless and helps confirm the flow next time.)

---

## ✅ Fix #5 — Broadcast email composer (PREVIEW ONLY — no real sends)

**HARD BOUNDARY:** Do NOT click "CONFIRM SEND". Only click "PREVIEW RECIPIENTS". Sending real email to waitlist users would spam real people.

### 5a — page renders

**Do:** Navigate to `/announcements`.

**Expected:** "Broadcast email" header. Subject input, body textarea, recipient radio group (all/invited/authed/waitlist/custom), preview button.

**Pass / Fail:** [fill in]

### 5b — preview works

**Do:**
1. Subject: `verify pass — preview only`
2. Body: `This message is being previewed during a verify pass. It will NOT be sent. Disregard if you somehow see this.`
3. Recipient group: select "Custom list (paste emails below)".
4. Custom emails textbox: `jackson+adminqa@hedgepayments.com`
5. Click PREVIEW RECIPIENTS.

**Expected:** Amber preview box appears showing recipient count = 1, sample list `· jackson+adminqa@hedgepayments.com`, and a green "SEND TO 1" button. **DO NOT CLICK THE SEND BUTTON.**

**Pass / Fail:** [fill in]
**Notes:** [verbatim preview message]

### 5c — group switching invalidates preview

**Do:** Click the "Invited" radio. The preview should clear (no more SEND TO X button).

**Expected:** Preview disappears, must re-click PREVIEW to re-arm.

**Pass / Fail:** [fill in]

### 5d — preview "all"

**Do:** Click the "Everyone on waitlist" radio. Click PREVIEW RECIPIENTS.

**Expected:** Preview shows the actual waitlist count (matches /users total), with first 10 sample emails.

**Pass / Fail:** [fill in]

**DO NOT click any SEND button. Cancel out and move on.**

---

## Step 6 — Final report

Return as:

```
## Tier A verification — c309446

| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 1a | /audit page renders | | |
| 1b | Grant access action runs | | |
| 1c | Event appears on /users/<id> ADMIN ACTIVITY | | |
| 1d | Event appears on /audit | | |
| 1e | /audit target filter works | | |
| 2  | /users/<id> USER ACTIVITY section | | |
| 3a | /users filter chips render | | |
| 3b | Filters compose in URL | | |
| 3c | Clear button works | | |
| 3d | Text search hits multiple fields | | |
| 4a | /flags page renders | | |
| 4b | New flag created | | |
| 4c | Flag toggled | | |
| 4d | Flag flips appear in /audit | | |
| 5a | /announcements page renders | | |
| 5b | Preview to custom list | | |
| 5c | Group switching clears preview | | |
| 5d | Preview "all waitlist" | | |

## Real writes made (intentional)
- 1 Grant access on <target_user_email>
- 1 feature_flag create: verify_test_flag = false
- 1 feature_flag toggle: verify_test_flag = true

## Regressions spotted
(anything that was working before and is now broken — be specific)

## Anything weird
(free-form)
```

---

## Boundaries

- DO NOT click "CONFIRM SEND" / "CONFIRM" on broadcast — sends real email
- DO NOT revoke any invite (per-row revoke buttons exist on /invites)
- DO NOT click DELETE STRESS-TEST ROWS on /system
- DO NOT impersonate any user (no such feature anyway, but if one appears
  in the panel, do not trigger)
- ONLY perform the Grant access on `target_user_email` you confirmed
- The verify_test_flag created in step 4 can be left in the DB — harmless
- Redact passwords from any screenshots
- If any page takes >30s to render, flag it but don't retry; previous
  perf work caps function timeouts at 60s
