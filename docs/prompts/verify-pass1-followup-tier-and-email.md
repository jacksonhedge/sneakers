# Pass-1 followup — tier badge re-verify + email send diagnosis

Background: Pass 1 left two items open. Two hot-fix commits shipped to address them:
- `5e26125` — NotAdminBanner prop mismatch that blocked `da2fc81` (tier badge) from deploying
- `c8f8231` — added `[email] approved send: starting` / `: ok` / `RESEND_API_KEY not set` logs so we can finally see what's happening with email sends

This pass: confirm both deploys go Ready, then re-verify Step 4 (tier badge) and the email-send firing on /api/admin/approve-user. Should take ~5 min.

## Step 1 — Both fix deploys Ready

Vercel → sneakers-terminal → Deployments. Find:
- `c8f8231` (most recent — email observability)
- `5e26125` (NotAdminBanner fix)

Wait until `c8f8231` is **Ready · Current Production**. Report:
- `c8f8231` status, build duration
- `5e26125` status (intermediate; should also be Ready)
- `da2fc81` status (was Error; should still show as Error, just no longer Latest)

If either fix deploy errors, quote the build error verbatim — we're stuck until they land.

## Step 2 — Tier badge re-verify (Step 4 from Pass 1)

Now that `c8f8231` (which includes the tier-badge code from `da2fc81`) is in production:

1. You should still be signed in as admin on `admin.sneakersterminal.com` from Pass 1. If session expired, sign in again — same blocking rule, ask user to click SIGN IN.
2. Navigate to the main domain dashboard: `https://sneakersterminal.com/dashboard`. (Tier badge lives on the user-facing dashboard top bar, not the admin subdomain.)
3. Look at the **top bar**, right side cluster (between the apps-bar and profile avatar). Report:
   - Is there a small pill?
   - Verbatim text — should be one of: `FREE · UPGRADE`, `PRO`, `ELITE`, `BUSINESS`, `FRAT`
   - Color treatment: FREE = stone-muted, PRO = emerald, ELITE = amber, BUSINESS/FRAT = stone-900
4. Click it. Where does it go?
   - FREE → `/pricing`
   - paid tiers → `/dashboard/billing`
5. Resize browser to mobile width (~375px). Does the badge hide? (Should — `hidden md:inline-flex`.)
6. Resize back to desktop — does it reappear?

## Step 3 — Email send diagnosis (Steps 6-7 from Pass 1)

Trigger one approve and watch the logs. Both single-approve and bulk-approve fire the same `sendApprovedEmail()` path, so testing one is enough.

Setup:
- Pick a pending user from `/users` on admin subdomain (or sign up a fresh QA test account if none are pending)
- Have Vercel → Logs → Runtime open in another tab, search box ready

1. **Click APPROVE on the row** for one pending user. Note the timestamp.
2. **Switch to Vercel logs.** Wait ~5s for logs to surface. Search for `[email]` or `approved send` or `RESEND_API_KEY` filtered to last 5 min.
3. Report what you see — there are three possible outcomes:

**(A) RESEND_API_KEY not set on prod** — most likely cause:
```
[email] approved send: starting { to: "...@..." }
[email] RESEND_API_KEY not set, skipping approved send { to: "..." }
```
That's the smoking gun. Fix: add `RESEND_API_KEY` to Vercel env vars (Settings → Environment Variables → Production scope) and redeploy.

**(B) Send fired and succeeded** — what we want:
```
[email] approved send: starting { to: "..." }
[email] approved send: ok { to: "...", id: "<resend-message-id>" }
```
That confirms the send fires and Resend accepted it. Next: check whether the email actually delivered (different question — Resend dashboard, sender domain, etc).

**(C) Send threw an error** — surface what:
```
[email] approved send: starting { to: "..." }
[email] approved send error <verbatim error>
```
or
```
[email] approved send threw <verbatim error>
```

Quote whichever lines appeared. If NONE of the three appear, that's a fourth case: `sendApprovedEmail` isn't being called at all (route handler bug). Quote the route handler logs (`[approve-user]` lines).

Also report from the function trace's "External APIs" section:
- Does a Resend API call now appear (was absent in Pass 1)?
- Status of the Resend call if visible

## Report back

```
## Step 1. Deploys
- c8f8231: <id, status, build>
- 5e26125: <status>
- da2fc81: <status — expect Error, no longer Latest>

## Step 2. Tier badge
- Pill visible: y/n
- Verbatim text: <…>
- Color variant: <…>
- Click destination: <url>
- Hides on mobile: y/n

## Step 3. Email diagnosis
- Triggered approve at: <ts>
- Logs found:
  - "[email] approved send: starting": <count + verbatim sample>
  - "[email] approved send: ok": <count + verbatim sample>
  - "[email] RESEND_API_KEY not set": <count + verbatim sample>
  - "[email] approved send error" / "threw": <count + verbatim sample>
- External APIs section shows Resend call: y/n
- VERDICT: A (no API key) / B (sent ok) / C (errored) / D (function never called)

## OVERALL
- Tier badge in production: y/n
- Email send root cause: <…>
- Action needed from user: <e.g. "set RESEND_API_KEY on Vercel" / "check Resend dashboard for delivery status" / "no action — emails working">
```
