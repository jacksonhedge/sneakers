# Signup-flow verify · PASS 2 of 2 — regression + perf + a11y

Background: tonight stacked 5 signup-flow commits on top of 9 perf commits from earlier. Pass 1 (separate prompt) covers the new features end-to-end. **This pass** confirms nothing else regressed.

Specifically catching:
- Cold-start on market-detail (was 12-15s pre-`5bd4251`, now ~700ms)
- Chart history (was "2 pts · still loading" pre-`4b80219`, now real curves on OG/NoVig/ProphetX)
- Footer count on /dashboard (was 21k briefly, now ~191k via `133fdb6`)
- Apps-bar OG in featured row (commit `232f384`)
- NotAdminBanner amber warning (commit `232f384`)
- Polymarket scraper running (was timing out, fixed in `ebb99b0`)
- Cross-book pairs panel (still empty in last verify, dependent on starts_at backfill propagating)
- Vercel function logs hygiene (5xx, slow-query, pgsql_tmp warnings)

You're a senior QA engineer running a release-readiness pass. **Specific. Verbatim text. Counts.**

## Step 1 — Cold-start on market-detail (`5bd4251`)

1. Open a fresh **incognito** tab and sign in.
2. Land on /dashboard. Hard-refresh once (Cmd+Shift+R) so we're on the latest deploy.
3. Navigate to `https://sneakersterminal.com/dashboard/markets?platform=og`.
4. Open DevTools → Network → "Doc" filter.
5. Click the first OG market card. Read the doc-request `Time` column verbatim.

Report:
- Network Time: <…ms>
- Was: 702ms last verify; allow some variance but >2s would be a regression
- Page renders fully: y/n
- Cross-venue chart legend visible (>1 line if the market is multi-venue): y/n

Click back, then click a second OG market within ~30s on the same warm function instance:
- Warm Network Time: <…ms> (was 11-14ms last verify)

## Step 2 — Chart history (`4b80219`)

On the OG market detail from Step 1:

1. Look at the chart header. Report:
   - Chart points label verbatim (was "2 pts" before fix; should now be 50+ pts on most live markets)
   - Is the **"Price history is still loading — showing live quotes only"** banner present? (Should be ABSENT for any market with >2 pts.)
   - Curve shape: real curve over time, or two flat horizontal lines?

If the banner IS present and pts <5, that's a regression — quote which market and any console errors.

Repeat for one ProphetX market and one NoVig market (navigate via `/dashboard/markets?platform=prophetx` and `?platform=novig`):
- ProphetX: pts=<…>, banner=<present/absent>, curve=<real/flat>
- NoVig: pts=<…>, banner=<present/absent>, curve=<real/flat>

## Step 3 — Footer count + apps-bar OG (`133fdb6` + `232f384`)

1. On `/dashboard` (signed-in), scroll to the **footer**.
2. Quote verbatim. Should be: "Snapshot YYYY-MM-DD · N markets across Kalshi, Polymarket, OG Markets, NoVig, and ProphetX. Live prices refresh every few minutes."
3. Report:
   - Verbatim footer text
   - The market count number — should be in the 100k+ range (~190k as of last verify)
   - "OG Markets" mentioned: y/n

4. Look at the **apps-bar** (venue logos at the top of the dashboard).
5. Report:
   - First 5 logos in order, left to right
   - Should be: Polymarket, Kalshi, OG, NoVig, ProphetX
   - Overflow chip text afterward (e.g. "+38 more")

## Step 4 — NotAdminBanner (`232f384`)

1. While signed in as a non-admin user (or as admin, but with the path), navigate to `https://sneakersterminal.com/dashboard?error=not_admin`.
2. Report:
   - Amber/yellow banner appears at top of /dashboard, above BalanceCard?
   - Banner text verbatim
   - DISMISS button works (banner disappears on click)?
   - Navigate to `/dashboard` (no query param) — banner does NOT appear?

## Step 5 — Cross-book pairs panel (`48d1c76`)

This was empty in last verify due to polymarket scraper failure. With `ebb99b0` parallelizing polymarket and `426aff5` removing the BufFileDumpBuffer crash on the recompute job, pairs should be populating now (assuming Postgres is back up after this morning's volume crash).

1. On /dashboard, find the **Cross-Book Spread** panel.
2. Report:
   - Header count (was "0 PAIRS"; should now be a positive number IF Postgres recovered + recompute-arb-pairs ran successfully)
   - First 2 sample row team names + sport
   - If still 0 PAIRS, check Railway logs for latest `recompute-arb-pairs` status

## Step 6 — Polymarket scraper still healthy (`ebb99b0`)

Railway → glorious-playfulness → sneakers-trading → Logs → search "polymarket".

Report:
- Most recent `→ polymarket` start timestamp
- Most recent `✓ polymarket done` timestamp
- Wall-clock duration (should be <4 min; was 5min timeout pre-fix, ~3 min last verify)
- Any `✗ polymarket failed` lines in last 6 iterations

If polymarket has been failing again, that explains any other downstream issues.

## Step 7 — Vercel function logs hygiene

Vercel → Logs → Runtime → last 30 min on the latest deployment.

Report:
- **5xx count**: <N> (target: 0)
- **Function timeout (`---` status) count**: <N> (target: 0; was 3 in pre-`426aff5` verify, then 0 after)
- **`[db] query failed`** count: <N>
- **`[db] slow query`** lines — quote the slowest one verbatim (Xms / rows=N / sql prefix)
- **`pgsql_tmp` / `BufFileDumpBuffer`** warnings: <N> (target: 0)
- Any errors mentioning `signup-form`, `pending`, `bulk-approve`, `topbar`, `tier-badge`, `dashboard-shell` (regression checks against tonight's signup-flow round)

## Step 8 — Accessibility + responsive spot checks

1. **Mobile (~375px width)**:
   - /signup form usable: fields visible, button reachable?
   - /dashboard topbar collapses cleanly (no overflow)?
   - /pending queue position card readable?
2. **Keyboard navigation** on /signup:
   - Tab through email → name → password → SHOW/HIDE → code → submit. Does focus order match visual order?
   - Press Enter on code field — does the form submit (per `d745b29`)?
3. **Color contrast**:
   - Tier badge variants — FREE muted on white background, can you read it?
   - Queue position card — emerald on emerald (light), readable?

## Report back

```
## Step 1. Cold-start
- Cold market-detail Network Time: <ms>
- Warm Network Time: <ms>
- vs 700ms cold / 11-14ms warm baseline: <…>

## Step 2. Chart history
- OG: pts=<N>, banner=<…>, curve=<…>
- ProphetX: pts=<N>, banner=<…>, curve=<…>
- NoVig: pts=<N>, banner=<…>, curve=<…>

## Step 3. Footer + apps-bar
- Footer verbatim: <…>
- Market count: <N>
- OG mentioned: y/n
- Apps-bar order: <…>
- OG in slot 3: y/n

## Step 4. NotAdminBanner
- Banner appears on ?error=not_admin: y/n
- Banner text: <verbatim>
- DISMISS works: y/n
- Hidden on /dashboard (no param): y/n

## Step 5. Cross-book pairs
- Header count: <…>
- Sample rows: <verbatim or n/a>
- VERDICT: POPULATED / STILL EMPTY

## Step 6. Polymarket scraper
- Latest start: <ts>
- Latest ✓ done: <ts>
- Duration: <Xs>
- Recent failures: <NONE | list>

## Step 7. Function logs
- 5xx count: <N>
- "---" timeout count: <N>
- "[db] query failed": <N>
- Slowest [db] slow query: <verbatim ms / rows / sql prefix>
- pgsql_tmp warnings: <N>
- Signup-flow code errors: <NONE | list>

## Step 8. A11y + responsive
- /signup mobile: <…>
- Topbar mobile: <…>
- /pending mobile: <…>
- Keyboard nav: <…>
- Contrast issues: <list or NONE>

## OVERALL VERDICT (Pass 2)
- Perf wins still holding: <y/n>
- Cross-book pairs populated: <y/n>
- Function logs clean: <y/n>
- Regressions detected: <NONE | list>
- Issues to flag for next session: <list>
```
