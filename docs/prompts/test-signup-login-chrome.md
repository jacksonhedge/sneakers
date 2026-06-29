You are testing the **sign-up and login** flows of the Sneakers web app on a LOCAL dev server. Exercise signup, login, magic-link, password reset, and the protected-route gate, and report what works vs. what's broken.

## SAFETY
- Do NOT use real personal credentials or secrets. Use throwaway test values: email `test+<random>@example.com`, password `Test1234!`.
- Do NOT enter payment info or connect a real wallet.

## SETUP (already running)
The Sneakers dev server is **already running at http://localhost:3100** — use that base URL for every route below. ⚠️ Do NOT use `http://localhost:3000`: that port is a *different* app ("Hedge"), not Sneakers. (Confirm you're on Sneakers: the page title should read "Sneakers Terminal".)
Notes on environment (important for interpreting failures):
- Real signup/login needs Supabase env keys configured; magic-link / reset emails need `RESEND_API_KEY`.
- For local magic-link testing WITHOUT email, `AUTH_DEV_RETURN_LINK=1` makes the magic-link and password-reset endpoints return the link in the JSON response (look in the network response / any on-screen dev link).
- If a flow errors with a 500 / "email not sent" / Supabase auth error, it's most likely **missing local env**, not a code bug — call that out specifically rather than reporting it as broken.

## TESTS

### 1. Open self-serve sign-up (the KEY new behavior to verify)
- Go to `/signup` (no invite code).
- Fill a fresh email (`test+<random>@example.com`), name, and password. **Leave the invite-code field blank.**
- Submit. **Expected NEW behavior: codeless signup grants instant access — it should NOT land on a `/pending` waitlist page; it should grant access and head toward `/dashboard`** (it may ask for email confirmation depending on Supabase config — note if so).
- Report: did codeless signup grant access (reached dashboard / `hasAccess`), land in `/pending`, or error?

### 2. Password login
- Sign out if signed in → go to `/login` → sign in with the email + password you just created.
- Expected: session set, lands on `/dashboard`.

### 3. Magic-link login
- Go to `/login?email=<your test email>` → click the magic-link button.
- If a dev link is returned (AUTH_DEV_RETURN_LINK), follow it → expect `/auth/callback` → `/dashboard`. If no dev link and no real email inbox, note that email delivery is required and move on.

### 4. Password reset
- Go to `/forgot-password` → submit the test email.
- If a dev link is returned, follow it → `/reset-password` → set a new password → expect redirect to `/login?reset=success`. Else note email is required.

### 5. Protected-route gate
- Sign out. Directly visit `/dashboard`. Expected: redirect to `/signup` (or `/login`).

## REPORT BACK
- For each flow (1–5): **works / broken / blocked-by-missing-env**, with the specific outcome (URL landed on, any error text, console/network errors).
- Explicitly confirm whether **codeless signup now grants instant access** (the change we just made) vs. `/pending`.
- Separate **real bugs** from **missing local env** (Supabase/Resend) clearly.
- Screenshot: the signup result, the dashboard after login, and any error states.
