# Chrome prompt — provision admin.sneakersterminal.com

Set up the `admin.sneakersterminal.com` subdomain end-to-end so the admin panel lives on its own host. Code is already wired (the Next.js proxy rewrites `admin.*/foo` → `/admin/foo` internally). What's missing is **DNS at Namecheap** and **domain attach at Vercel**.

This prompt does both via the web UIs.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `namecheap_user` + `namecheap_password` — Namecheap login. If the user has 2FA enabled, they MUST be present to enter the code; the agent will pause and ask. Do NOT attempt to bypass 2FA.
- `vercel_login_method` — does the user log into Vercel via GitHub, Google, Email, or SSO? Need this so the agent picks the right SSO button. (User probably uses GitHub since the repo lives there.)

If any of those are missing, STOP and ask. Don't guess.

---

## Step 1 — Namecheap: add the DNS record

1. Open `https://www.namecheap.com/myaccount/login/` in incognito.
2. Log in with `namecheap_user` / `namecheap_password`. If 2FA prompts, PAUSE and ask the user for the code (don't attempt to bypass).
3. Navigate to: Dashboard → Domain List → find `sneakersterminal.com` → click **MANAGE** on its row.
4. Click the **Advanced DNS** tab.
5. Confirm what's already there for the apex (`@`) and `www` records — DON'T touch those. Note them in the report so we have a record.
6. Click **ADD NEW RECORD**:
   - **Type:** `CNAME Record`
   - **Host:** `admin`
   - **Value:** `cname.vercel-dns.com.` (the trailing dot is OK; Namecheap normalizes)
   - **TTL:** `Automatic`
7. Click the green checkmark to save.
8. Confirm the row appears in the list.

Capture: a screenshot of the Advanced DNS table AFTER adding, with the new `admin` row visible. Redact any auth-token / API-key columns if present.

If Namecheap shows a record conflict (e.g., an existing `admin` record), STOP and report — don't overwrite without confirmation.

## Step 2 — Vercel: attach the domain to the project

1. Open `https://vercel.com/login` in a new tab.
2. Click the SSO button matching `vercel_login_method` (GitHub if that's what the user said).
3. After landing in the dashboard, navigate to: jackson-fitzgeralds-projects → **sneakers-terminal** project.
4. Click **Settings** → **Domains** in the left nav.
5. In the "Add" input, type `admin.sneakersterminal.com` and click **Add**.
6. Vercel will:
   - Resolve the CNAME (the one you just added at Namecheap).
   - Provision an SSL cert via Let's Encrypt (~30s–2min).
   - Show the domain in the list with a "Valid Configuration" / green checkmark when ready.
7. If Vercel shows "Invalid Configuration" or "DNS not found":
   - DNS may still be propagating — wait 60s and refresh.
   - If still failing after 5min, screenshot the error and STOP. Don't retry endlessly.

Capture: screenshot of the Domains page once the new domain shows green/Ready.

## Step 3 — Verify

1. Open a fresh incognito tab.
2. Visit `https://admin.sneakersterminal.com`.
3. Expected redirect chain:
   - `https://admin.sneakersterminal.com/` → proxy rewrites to `/admin` internally → `requireAdmin()` sees no session → redirects to `/signup?next=/admin` (or `/login`).
   - URL bar should still read `admin.sneakersterminal.com` after redirect (NOT `sneakersterminal.com`).
4. Confirm:
   - SSL is valid (green padlock, no warnings).
   - The page renders (no 500, no Vercel "domain not configured" page).
5. Also check `https://sneakersterminal.com/admin` still works (it should — we haven't deleted the apex /admin route yet; that's a separate decision).

## Step 4 — Final report

Return as:

```
## Namecheap
- Existing apex/www records (verbatim, redacted if needed):
- New admin CNAME row visible: yes / no
- Screenshot: <attach>

## Vercel
- admin.sneakersterminal.com added: yes / no
- Configuration status (green/Valid or otherwise):
- SSL provisioned: yes / no
- Time from add → Ready: <approx>
- Screenshot: <attach>

## Verification
- https://admin.sneakersterminal.com loads: yes / no
- Redirect target on no-auth: <URL>
- URL bar stays on admin.* after redirect: yes / no
- SSL padlock green: yes / no
- https://sneakersterminal.com/admin still works: yes / no

## Anything weird
(free-form — record conflicts, DNS slowness, SSL provisioning errors, anything else)
```

---

## Boundaries

- DO NOT touch any DNS record besides adding the new `admin` CNAME. The apex (`@`), `www`, MX, TXT, and any other records stay exactly as they are.
- DO NOT remove existing Vercel domains, env vars, or project settings.
- DO NOT enter the Namecheap password into any field other than the official Namecheap login form. If a popup or third-party page prompts for it, STOP.
- If 2FA is enabled, PAUSE and ask the user for the code each time — do NOT attempt to bypass.
- Redact passwords / 2FA codes / session cookies from any screenshots.
- DO NOT perform Vercel actions outside of the `sneakers-terminal` project — the user has many other projects in this org and we shouldn't touch them.
- If Vercel asks to upgrade / change plan / charge a card during domain attach, STOP and report — don't accept anything.
