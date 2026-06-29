FULL end-to-end test of Sneakers on the live PREVIEW deployment. Test signup, login, the V1 dashboard (wallet + quick trading windows), and report what works. This preview uses the **live production Supabase + market DB**, so accounts you create are REAL — use a clearly-test email.

## SAFETY
- Throwaway creds only: email `sneakers-test+<random>@gmail.com` (an address you control), password `Test1234!`. This creates a REAL row in the live user table — expected; just keep the email obviously a test. No real secrets, no payment, and for any venue API-key field use obvious FAKE placeholders then cancel — never real keys.

## SETUP
- Target base URL: **https://sneakers-terminal-hiif8fjvk-jackson-fitzgeralds-projects.vercel.app**
- Confirm the page title reads **"Sneakers Terminal"** before testing.

## PART A — Auth (should fully work now — live Supabase)
1. **Codeless signup:** `/signup`, fresh email + name + password, **leave access code blank**, submit. EXPECTED: instant access → lands on `/dashboard` (NOT `/pending`). Report exactly what happened (and whether it asked for email confirmation).
2. **Password login:** sign out → `/login` → sign in with that email + password → expect `/dashboard`.
3. **Password save (if testing a mobile/Safari profile):** after a successful login, did the browser offer to SAVE the password? Note yes/no.
4. **Protected route:** signed out, visit `/dashboard` → expect redirect to `/signup`.

## PART B — Dashboard V1 (after login)
1. Confirm the home shows **two sections**: a **WALLET card** (total + per-venue) on top, and **QUICK MARKETS** (short-interval crypto windows) below. Describe the layout.
2. **Wallet card:** with no venues connected → should show **$0.00** + a "connect a venue" CTA. Report.
3. **Quick markets:** cards grouped by asset (BTC/ETH/SOL…) with strike / YES price / Δ5m? Do the **bucket filter (5m/15m/30m/60m)** and **asset filter** work? Do prices flash/roll live (~15s)? Is the list populated or empty?
4. **"Tap to trade":** click one — WHERE does it go? (Expected: an **external/affiliate link**, NOT an in-app order. Confirm which it is.)

## PART C — Wallet connect
1. `/dashboard/connections` → **CONNECT Polymarket** → describe the wizard fields (API key/secret/passphrase; read vs trade scope). Enter **FAKE** placeholders, try Save → expect a clear test-connection **error**. Cancel. Never use real keys.

## PART D — Markets
1. Visit `/dashboard/markets`, `/dashboard/minute`, `/dashboard/quick` — do they load? Populated with data or empty?

## REPORT BACK
- Each flow: **works / broken**, with specifics (URL landed on, error text, console/network errors).
- Explicitly confirm: (a) **codeless signup → instant access** on the live backend; (b) the **V1 dashboard shows wallet + quick windows**; (c) **filters work**; (d) **tap-to-trade goes to an external/affiliate link** (i.e., there is no first-party in-app trade yet).
- **Screenshots:** signup result, the V1 dashboard, a quick-markets filter state, the tap-to-trade destination, and the connect wizard.
