# Verify deploy 232f384 — OG in dashboard chrome + admin banner

Background: just pushed commit `232f384` to main (`feat(dashboard): promote OG into chrome + admin-allowlist warning`). Vercel auto-deploys main to production. Three things to verify:

1. OG now appears in the apps-bar **featured row** (not just the "+N more" drawer)
2. Dashboard footer mentions OG Markets in the venue list
3. `NotAdminBanner` renders on `/dashboard?error=not_admin` and dismisses correctly

Path A live-data fix from earlier should still be holding (71K+ markets, OG flowing). Confirm that hasn't regressed.

You're a UX QA tester. **Be concrete. Verbatim text. No adjectives.**

## Step 1 — Wait for the new deploy

1. Vercel → sneakers-terminal → Deployments. Find the deployment for commit `232f384`.
2. Wait until status = **Ready** and it's marked **Current** for Production.
3. Report: deployment id, build duration, total elapsed.

## Step 2 — Sign in (or use existing session) and hard-refresh

1. `https://sneakersterminal.com/dashboard` → hard-refresh (Cmd+Shift+R) so we're on `232f384`, not cached `4cdd858`.

## Step 3 — Apps-bar featured row check

1. Look at the row of venue logos at the top of the dashboard.
2. Report the **first 5 venue logos** in order, left to right.
3. Expected: Polymarket, Kalshi, OG, NoVig, ProphetX (in that order).
4. After the featured logos, what does the overflow chip say? (Should be `(+N more)` for some N.)

## Step 4 — Footer venue list

1. Scroll to the very bottom of `/dashboard`.
2. Quote the footer line **verbatim** (the one starting "Snapshot ...").
3. Expected to contain "across Kalshi, Polymarket, OG Markets, NoVig, and ProphetX".
4. Report the markets count too — should still be a 5- or 6-figure number (live data still flowing).

## Step 5 — NotAdminBanner

1. Navigate to `https://sneakersterminal.com/dashboard?error=not_admin` directly.
2. Report:
   - Does an amber/yellow banner appear at the top of the dashboard, above the BalanceCard?
   - Quote the banner text verbatim
   - Is there a DISMISS button? Click it — does the banner disappear?
   - After dismiss, does it stay dismissed on a soft refresh (just navigate away and back), or come back?
3. Now navigate to `/dashboard` (no query param). Confirm the banner does NOT appear.

## Step 6 — Sanity: live data still flowing

1. `https://sneakersterminal.com/dashboard/markets?platform=og` — confirm:
   - Total OG markets visible: should still be hundreds (was 71K+ across all platforms before)
   - DATA strip shows `og · Xm ago` with X < 15
2. Vercel → Logs → last 5 min → filter "ENOTFOUND base" — count should be **0**.
3. Filter "42703" — count should also be **0** (Supabase migration fix from earlier).

## Report back

```
## Step 1. Deploy
- 232f384 deployment id: <…>
- Build duration: <…>
- Status: Ready / Error
- Promoted to Production: <y/n>

## Step 3. Apps-bar featured row
- Logos in order: <…>
- Matches Polymarket / Kalshi / OG / NoVig / ProphetX: <y/n>
- Overflow chip text: <…>

## Step 4. Footer
- Verbatim: <…>
- Mentions OG Markets: <y/n>
- Markets count: <N>

## Step 5. NotAdminBanner
- Appears on ?error=not_admin: <y/n>
- Banner text verbatim: <…>
- DISMISS button works: <y/n>
- Hidden on /dashboard (no param): <y/n>

## Step 6. Live data sanity
- OG markets count: <N>
- Latest og update: <Xm ago>
- ENOTFOUND base in logs: <N>
- 42703 in logs: <N>

## VERDICT
- 232f384 ship: <FULL SUCCESS / PARTIAL — what's off / FAILED — what broke>
```
