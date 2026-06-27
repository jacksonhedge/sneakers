# Chrome prompt — overnight stability test (safe to leave unattended)

Loops through Sneakers Terminal's public + authed surfaces over multiple iterations to catch flaky / intermittent bugs that don't show up in a single pass: memory leaks, slow render drift, hydration errors that fire 1-in-N, session timeout behavior. Designed to run unattended for several hours.

**Hard rule: this prompt does ZERO writes.** No form submits, no clicks on action buttons, no broadcast sends, no admin actions. Pure read-only walk + observe.

---

**Required inputs from the user before you start:**

- `email` — defaults to `jacksonfitzgerald25@gmail.com`
- `password` — user types it ONCE at the login form before leaving. After that the session cookie should keep the agent signed in for the duration. If the session expires mid-run, that's itself a finding worth logging — don't try to re-auth.

If `email` missing, STOP and ask.

---

## Step 0 — Sign in once

1. Open `https://sneakersterminal.com/login`. User types password, clicks SIGN IN.
2. Confirm landing on `/dashboard`. Note the time.
3. From here, no further sign-in. If session expires mid-run, log the timestamp and continue with public-only iterations.

---

## Loop — run 12 iterations, ~10 min each

Each iteration walks the full surface area below. Between iterations, sleep 60s (matters less for findings; matters for not torching Vercel function-invocation budget overnight).

### Per-iteration walk

For each surface, capture:
- HTTP status (200 / 4xx / 5xx)
- Approximate render time (eyeball is fine — categorize as <2s, 2-5s, 5-10s, 10-30s, >30s)
- Console errors observed (just new ones — don't re-log a #418 you've already counted in iteration 1)
- Any visual breakage / layout shift

Surfaces (in order — clicking through, not direct-URL navigation, so we exercise router transitions too):

1. `/dashboard` (overview)
2. Click any BiggestVolume row → market detail
3. Back button → `/dashboard`
4. `/dashboard/markets` (browser)
5. Click any market card → detail
6. Back → `/dashboard/markets`
7. `/dashboard/leaderboard`
8. `/dashboard/profile`
9. `/dashboard/connections`
10. `/dashboard/alerts`
11. `/dashboard/settings/api-keys`
12. `/dashboard/settings/autotrade`
13. `/dashboard/settings/otoole`
14. `/dashboard/billing`
15. `/dashboard/billing/credits`

Then 3 public surfaces (un-authed in the same browser is fine — Sneakers gates on auth at the page level not the host):

16. `/` (landing)
17. `/pricing`
18. `/venues`

### After each iteration — log a tight row

```
Iteration N — timestamp HH:MM
- Total surfaces visited: 18
- Surfaces with HTTP 5xx: <list>
- Surfaces > 10s render: <list>
- New console errors: <count + sample>
- Layout breakage: <list>
- Session still alive: yes / no
```

If session dies mid-iteration, note the iteration + log "session expired at iteration N", then drop to public-only loops for the rest of the night.

---

## After 12 iterations (or session death)

Stop the loop. Compose the final cumulative report.

---

## Final report

```
## Overnight stability test — <date>

### Summary
- Iterations completed: <n> / 12
- Total page loads: <iterations × surfaces> 
- Session expiry: yes (at iteration N) / no
- Time elapsed: ~<hours>

### Aggregate findings
- HTTP 5xx total occurrences: <count>
  - Per-surface breakdown:
- Pages > 30s ever: <list with iteration numbers>
- Pages > 10s consistently: <list — if a page was slow on iter 1, 4, 7, 10 that's a real perf issue>
- Console error counts:
  - React #418: <count>
  - Hydration warnings: <count>
  - Other (top 3 by frequency):
- Layout breakage / visual regressions: <list>

### Trend analysis
- Did any surface DEGRADE over time? (e.g. /dashboard render time iteration 1 = 2s, iteration 12 = 25s) <yes/no with detail>
- Did any console error class start firing only after iteration N? <yes/no>
- Did session expire? At what time / iteration?

### Anything weird (free-form)

### Top 3 stability concerns
Ranked. Each: <surface or pattern> — <one-sentence problem>.
```

---

## Boundaries

- ZERO writes. No clicks on action buttons (Grant access, Confirm, Send, Revoke, Delete, Connect/Save in wizards, etc).
- DO NOT enter credentials anywhere — even fake ones — to keep the run truly read-only.
- DO NOT open external venue affiliate links.
- DO NOT navigate to `/admin` (separate auth, agent isn't signed in there anyway).
- If the session expires, log it and drop to public-only iterations. Don't try to re-auth (no password available unattended).
- If a page takes >60s, abandon it for that iteration; flag it; move to the next surface.
- If you encounter the same console error >100 times in a single iteration, deduplicate the log entry — capture it once with a count, not a flood.
- If anything looks like leaked credentials / PII / session tokens in URLs or page text, flag prominently — DO NOT screenshot the actual value.
- Stay on `*.sneakersterminal.com`.
- Redact passwords from any screenshots if you take them.
- Final report ends the run. Don't restart.
