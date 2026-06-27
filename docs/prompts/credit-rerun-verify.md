# Chrome prompt — re-run credit grant + clawback (steps 4/5/9)

Quick focused re-run of just the credit-related steps from the previous verify pass. These failed last time because `credit_transactions` and `user_credits` tables (or their columns) weren't on prod. Migrations 006 + 023 + a column patch ran tonight, table is now writable end-to-end (verified server-side).

5 minutes. Two real writes (+100 / -100 net zero on `target_email`).

---

**Required inputs from the user before you start:**

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `admin_password` — user types it themselves at the admin login
- `target_email` — defaults to `jacksonfitzgerald25@gmail.com` (same target as before; net-zero state preserved)

---

## Step 0 — Sign in to admin

`https://admin.sneakersterminal.com/login` → sign in → admin home.

## Step 4 (re-run) — Grant 100 credits

1. Navigate to `/users` → search `target_email` → click "view →".
2. Note current credit balance under the `> O'TOOLE CREDITS` section.
3. Type `100` into the delta field, `verify pass — credit grant retest` into reason.
4. Click `ADD 100 CREDITS` → `CONFIRM → balance <prior + 100>`.

**Expected (this time it should succeed):**
- Green pill: `+100 credits → balance 0 → 100`
- "Current balance" display refreshes to 100 after page revalidation
- NO error pill

**Pass / Fail:** [fill in]
**Verbatim message:**

## Step 5 (re-run) — Clawback -100 credits

1. Type `-100` into the delta field, `verify pass — clawback retest` into reason.
2. Button label changes to `SUBTRACT 100 CREDITS`.
3. Click → CONFIRM button is RED (destructive variant).
4. Click CONFIRM.

**Expected:**
- Green pill: `-100 credits → balance 100 → 0`
- Balance back to 0

**Pass / Fail:** [fill in]
**Verbatim message:**

## Step 9 (re-run) — Both adjustments appear in audit

Scroll down to the **`> ADMIN ACTIVITY`** section on the same user-detail page.

**Expected:** Top 4 rows are (newest first):
1. ADJUST_CREDITS · violet pill · `delta=-100, reason="verify pass — clawback retest", balance_before=100, balance_after=0`
2. ADJUST_CREDITS · violet pill · `delta=100, reason="verify pass — credit grant retest", balance_before=0, balance_after=100`
3. SET_USER_TIER · sky-blue pill · `prior_tier=pro, new_tier=free, reason="verify pass — restoring"` (from the previous run)
4. SET_USER_TIER · sky-blue pill · `prior_tier=free, new_tier=pro, reason="verify pass — temp Pro for testing"` (from the previous run)

**Pass / Fail:** [fill in]

## Bonus — `/admin/audit` filter chips

Navigate to `/admin/audit`. The chip filter row at the top should now include `ADJUST_CREDITS` (in addition to the existing `GRANT_ACCESS`, `SET_FEATURE_FLAG`, `SET_USER_TIER`).

**Pass / Fail:** [fill in]

---

## Step 10 — Final mini-report

```
| # | Fix | Pass/Fail | Notes |
|---|---|---|---|
| 4 | Grant 100 credits succeeds | | |
| 5 | Clawback -100 credits succeeds | | |
| 9 | Both ADJUST_CREDITS rows in user audit | | |
| + | ADJUST_CREDITS chip in /admin/audit | | |

## Final balance
Should be 0 (net zero — same as start).

## Anything weird
(free-form)
```

---

## Boundaries

- DO NOT use a delta larger than ±100.
- DO NOT change tier or flip status — JUST credits this time.
- DO NOT click external links.
- Net zero is the goal: target_email ends with same balance + tier as start.
- Redact passwords from screenshots.
