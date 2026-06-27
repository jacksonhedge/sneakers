# Chrome prompt — verify admin credit/tier adjusters + LAST LOGIN list

Targeted verification of two new admin features:

1. **Credit + tier adjusters** on `/admin/users/<id>` — `0c8153a`
2. **`/admin/users` LAST LOGIN column + sort** — `540cdd6`

Plus a quick check that the user-side surfaces (profile + billing/credits) reflect admin changes immediately.

15-20 minutes. **Two real writes** happen — one credit grant + one tier flip on a controlled test user. Both are reversible (write a -delta credit, set tier back to free).

---

**Required inputs from the user before you start:**

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `admin_password` — user types it themselves at the admin login
- `target_email` — a user you can safely poke. Default suggestion: `jacksonfitzgerald25@gmail.com` (an admin email already in the allowlist; safe to grant credits / flip tier on since it's the same operator). If user wants a different target, they should give it explicitly.

If anything missing, STOP and ask.

---

## Step 0 — Sign in to admin

Open `https://admin.sneakersterminal.com/login`. Sign in. Land on admin home with the URL bar reading `admin.sneakersterminal.com/`.

---

## Step 1 — `/admin/users` LAST LOGIN column visible

**Do:** Navigate to `/users`.

**Expected:**
- Table now has 11 columns (was 10): EMAIL · STATUS · TYPE · PLAN · REF CODE · DIR/IND · GEO · JOINED · INVITED · **LAST LOGIN** · view→
- LAST LOGIN cell per row shows one of:
  - timestamp (e.g. `2026-05-02 14:23`) — user has signed in
  - `never` (italic, dim) — has auth.users row but no sign-ins
  - `—` (dim) — waitlist-only, no auth.users row yet

**Pass / Fail:** [fill in]
**Notes:** [count of rows, distribution of states]

---

## Step 2 — Sort row visible + chip clicks work

**Do:** Look above the table for filter rows. There should be FOUR rows: STATUS · TIER · TYPE · **SORT**.

The SORT row has 3 chips: NEWEST / OLDEST / LAST LOGIN.

**Do (click test):**
1. Click NEWEST → table sorts newest-joined first (default behavior).
2. Click OLDEST → table sorts oldest-joined first. URL gains `?sort=oldest`.
3. Click LAST LOGIN → table sorts by last sign-in timestamp descending. Users who've never signed in sink to the bottom.

**Pass / Fail per chip:** [fill in]
**Notes:** [first 3 emails per sort to verify ordering]

---

## Step 3 — Open `target_email`'s detail page

**Do:** From `/users`, search for `target_email` and click "view →".

**Expected:** User detail page renders with sections in this order:
- Email + status badge + back link
- ACTIONS panel (Grant access / Issue / etc — depends on current state)
- **CREDIT ADJUSTER** — new section with current balance shown
- **TIER ADJUSTER** — new section with current tier badge
- ADMIN ACTIVITY (audit history)
- USER ACTIVITY (click events)
- RECORD (waitlist row dump)
- REFERRAL TREE

Note the current credit balance + current tier — you'll need them for the next steps.

**Pass / Fail:** [fill in]
**Current balance:** [fill in]
**Current tier:** [fill in]

---

## Step 4 — Credit adjuster — grant credits

**Do (in the CREDIT ADJUSTER section):**
1. Type `100` into the delta field
2. Type `verify pass — credit grant test` into the reason field
3. Watch the button label — should change to `ADD 100 CREDITS`
4. Click `ADD 100 CREDITS` (arms it, doesn't submit yet)
5. Button changes to `CONFIRM → balance <previous + 100>` — verify the math is right
6. Click `CONFIRM`

**Expected:**
- Green pill: `+100 credits → balance X → X+100`
- Form clears, page refreshes (server action revalidates)
- Current balance display updates to the new value

**Pass / Fail:** [fill in]
**Verbatim result message:** [fill in]

---

## Step 5 — Credit adjuster — clawback (negative delta)

**Do:** Repeat with delta `-100` and reason `verify pass — clawback test`.

**Expected:**
- Button label changes to `SUBTRACT 100 CREDITS`
- Confirm button is RED (destructive variant) — NOT emerald
- After confirm: green pill `-100 credits → balance X+100 → X` (back to original)

**Pass / Fail:** [fill in]
**Notes:** [any UX quirks]

---

## Step 6 — Credit adjuster — validation

**Do (validation tests, no real submits):**
1. Try delta `0` — button should be disabled (or, after click, error "delta must be a non-zero integer")
2. Try delta with no reason — button should be disabled
3. Try delta `2000000` (2M, exceeds the ±1M cap) — button arms, on confirm: red pill saying "delta exceeds hard cap"

**Pass / Fail per validation:** [fill in]

---

## Step 7 — Tier adjuster — flip Free → Pro

**Do (TIER ADJUSTER section):**
1. Click the PRO chip (assuming current tier is FREE)
2. Type `verify pass — temp Pro for testing` into reason
3. Click `CHANGE TIER → PRO` (arms)
4. Click `CONFIRM → free → pro`

**Expected:**
- Green pill: `tier free → pro`
- Current tier badge updates to PRO (emerald-ringed)
- Page refresh shows new tier persists

**Pass / Fail:** [fill in]

---

## Step 8 — Tier adjuster — flip back to Free

**Do:** Same flow, picking FREE chip + reason `verify pass — restoring`.

**Expected:** `tier pro → free`. Badge flips back.

**Pass / Fail:** [fill in]

---

## Step 9 — Both adjustments appear in audit log

**Do:** Scroll down to the **ADMIN ACTIVITY** section on the same user page.

**Expected:** Top 4 rows of the activity feed should be (newest first):
1. SET_USER_TIER · prior_tier=pro, new_tier=free, reason="verify pass — restoring"
2. SET_USER_TIER · prior_tier=free, new_tier=pro, reason="verify pass — temp Pro for testing"
3. ADJUST_CREDITS · delta=-100, balance_before=X+100, balance_after=X, reason="verify pass — clawback test"
4. ADJUST_CREDITS · delta=100, balance_before=X, balance_after=X+100, reason="verify pass — credit grant test"

The pills should be sky-blue for SET_USER_TIER and violet for ADJUST_CREDITS.

**Pass / Fail:** [fill in]
**Notes:** [if metadata is missing or malformed]

---

## Step 10 — Same actions appear in `/admin/audit`

**Do:** Navigate to `/admin/audit`. Look at the top of the table.

**Expected:** Same 4 rows appear at the top (most recent). Filter chips at the top should now include `SET_USER_TIER` and `ADJUST_CREDITS` as new action types.

**Pass / Fail:** [fill in]

---

## Step 11 — User-side visibility (sign in as the target user)

**HARD STOP** — sign out of admin first. Then sign in as `target_email` (user types password). Land on `/dashboard`.

**Do:**
1. Visit `/dashboard/billing/credits`. Current balance should match the post-test value (back to original since we did +100 then -100).
2. Visit `/dashboard/profile`. Plan should read FREE (since we restored).
3. Visit `/dashboard/billing`. "CURRENT PLAN: Free" should be highlighted.

**Expected:** All three surfaces reflect the post-test state without any caching staleness.

**Pass / Fail:** [fill in]
**Notes:** [any user-side staleness — would indicate revalidatePath gap]

---

## Step 12 — Final report

```
## Credit + tier + last-login verify — 540cdd6

| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 1  | LAST LOGIN column visible | | |
| 2  | SORT chips work | | |
| 3  | User detail panels render | | |
| 4  | Grant 100 credits + audit | | |
| 5  | Clawback -100 credits | | |
| 6  | Credit validation (0, no reason, >cap) | | |
| 7  | Tier free → pro | | |
| 8  | Tier pro → free | | |
| 9  | Both in user's ADMIN ACTIVITY | | |
| 10 | Both in /admin/audit | | |
| 11 | User-side surfaces reflect changes | | |

## Real writes performed
- credit_transactions: +100, then -100 (net zero)
- waitlist.plan_tier: free → pro → free (net zero)
- 4 admin_audit_events rows created

## Anything weird
(free-form)

## Top fix-tomorrow items
(if any — ranked)
```

---

## Boundaries

- DO NOT use a delta larger than ±10,000 except for the cap-test in step 6.
- DO NOT change tier on any user other than `target_email`.
- DO NOT click DELETE / REVOKE / GRANT ACCESS or any other action button outside this script.
- DO NOT enter real credentials in any wizard.
- Net zero is the goal: target_email should end the run with the SAME credit balance + tier as they started with.
- Stay on `admin.sneakersterminal.com` and `sneakersterminal.com`.
- Redact passwords from screenshots.
