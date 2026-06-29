You are doing a FULL end-to-end test of the **Sneakers** web app on a local dev server. Cover auth (signup/login), the V1 dashboard (wallet + quick short-interval trading windows), wallet connect, and the markets UI. Report what works, what's broken, and **separate real bugs from missing local config/data**.

## SAFETY
- Use throwaway test values only: email `test+<random>@example.com`, password `Test1234!`. No real personal credentials, no real API keys/secrets, no payment info, no real wallet.
- If a form asks for venue API keys, you may type obviously-fake placeholders to test the form flow, then cancel — **never real keys**.

## SETUP
- Sneakers is running at **http://localhost:3100**. ⚠️ **NOT `:3000`** — that's a different app ("Hedge"). Confirm the page title reads **"Sneakers Terminal"** before testing.
- Environment caveats (use these to CLASSIFY failures, not report them as bugs):
  - Real signup/login needs Supabase keys configured; emails need `RESEND_API_KEY`. If `AUTH_DEV_RETURN_LINK=1`, magic-link/reset endpoints return a dev link in the JSON/network response.
  - Wallet balances + market data come from backend credentials + a DB. A fresh account will show **$0.00 balance**, and the markets lists may be **empty** if the local DB has no short-interval data. Flag these as **"missing data/env"**, not bugs.

## PART A — Auth
1. **Open (codeless) signup:** go to `/signup`, fill a fresh email + name + password, **leave invite code blank**, submit. **Expected NEW behavior: instant access — reaches `/dashboard`, NOT `/pending`.** Report the exact outcome.
2. **Password login:** sign out → `/login` → sign in with that email+password → expect `/dashboard`.
3. **Magic-link:** `/login?email=<test email>` → magic-link button → if a dev link is returned, follow it → `/auth/callback` → `/dashboard`. Else note email required.
4. **Password reset:** `/forgot-password` → submit the test email → if a dev link is returned, follow it → `/reset-password` → set a new password → expect `/login?reset=success`.
5. **Protected route:** signed out, directly visit `/dashboard` → expect redirect to `/signup` (or `/login`).

## PART B — Dashboard V1 (after logging in)
1. Confirm the dashboard **home** shows **two sections**: a **WALLET card** (total balance + per-venue) on top, and **QUICK MARKETS** (short-interval crypto trading windows) below. Describe the layout.
2. **Wallet card:** with no venues connected it should show **$0.00** + a "connect a venue" CTA. Report what it shows.
3. **Quick markets:**
   - Are there market cards grouped by asset (BTC/ETH/SOL/…) showing strike + YES price + Δ5m? Or is it empty (no local data)?
   - Test the **bucket filter** (5m / 15m / 30m / 60m) and the **asset filter** — do they actually filter the cards?
   - Do prices **flash/roll live**? Watch ~15s.
   - The **"tap to trade"** CTA — where does it lead (an in-app trade panel, or an external/affiliate link)?
4. **Topbar/shell:** confirm the dashboard chrome renders (logo, search, wallet button, profile/avatar). Open the navbar **wallet button** popover and describe it.

## PART C — Wallet connect (credential wizard)
1. Go to `/dashboard/connections` (or the connect flow). 
2. Click **CONNECT on Polymarket** → the credential wizard modal. Describe its fields (CLOB API Key / Secret / Passphrase; the scope toggle "read" vs "read + trade"). Type **FAKE** placeholders, toggle the scope, then either Cancel or attempt Save — saving runs a **test-connection**, which with fake keys should **fail with a clear error**; report that error. Do NOT enter real keys.
3. If you encounter the separate **"Sneakers Vault"** (`/dashboard/wallet`), describe it but expect it to be a non-functional scaffold (deposit/withdraw "coming soon").

## PART D — Markets browsing
1. Visit `/dashboard/markets`, `/dashboard/minute`, and `/dashboard/quick` directly. Do they load? What does each show (vs. empty)?
2. Click into a single market detail page if one's available — describe the trade panel on the right.

## REPORT BACK
- For each part/flow: **works / broken / blocked-by-missing-data-or-env**, with specifics (URL landed on, error text, console + network errors).
- Explicitly confirm: (a) **codeless signup grants instant access** (not `/pending`); (b) the **V1 dashboard shows wallet + quick windows**; (c) the **quick-markets filters work**; (d) the **connect-Polymarket wizard opens + validates** fake keys.
- Clearly **separate real bugs from missing local data/env**.
- Top issues to fix, prioritized (1–7).
- **Screenshots:** the signup result, the V1 dashboard (wallet + quick windows), a quick-markets filter state, the connect wizard, and any error states.
