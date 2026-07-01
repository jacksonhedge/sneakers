# Chrome-agent E2E — Onboarding On-Ramp (/join)

Paste this into a Claude-in-Chrome window to end-to-end test the new 5-panel onboarding on-ramp. It lives at **https://sneakersterminal.com/join** (once deployed) or your Vercel preview URL. Do NOT run it against a real personal account — use a fresh disposable test email each run.

---

You are QA-testing the new Sneakers Terminal onboarding on-ramp at `<BASE_URL>/join` (I'll give you BASE_URL). Work through each scenario, take a screenshot at each key step, and report PASS/FAIL with what you saw. Do not enter any real personal password or payment info — use throwaway test values only.

**Test account:** use a fresh email like `sneakers-onramp-test+<random>@example.com` and a throwaway password `TestPass12345`.

### Scenario A — New user, full signup (happy path)
1. Go to `<BASE_URL>/join`. Confirm the dark premium screen renders: near-black canvas, disc/coin logo top-left, a progress rail of dots, an ambient "BTC 5m …" ticker, and the headline "Let's get you into the markets."
2. **Panel 1 (email):** type the fresh test email, press Enter / click Continue. Confirm it advances (a brief spinner while it checks, then the next panel).
3. **Panel 2 (create password):** confirm the field is masked (type=password), the show/hide toggle works, and Continue is disabled until ≥8 characters. Type `TestPass12345`, continue.
4. **Panel 3 (name):** Continue disabled until ≥2 chars. Type a display name, continue.
5. **Panel 4 (what you trade):** confirm chips for live venues (Polymarket, Kalshi, ProphetX, NoVig, Limitless). Confirm Continue works with ZERO selected (it's optional). Select a couple, continue.
6. **Panel 5 (confirm & enter):** confirm it reviews email + name + chosen venues, with a "Create account & enter →" button. Click it.
7. Confirm you land on `/dashboard` (or a "check your email" state if email confirmation is on). PASS if account creation succeeds and routes correctly.

### Scenario B — Returning user (login branch)
1. Fresh `/join`. Enter the email you JUST created in Scenario A. Continue.
2. Confirm it branches to a **login** panel (not the create-password panel): shows the email read-only with a "Not you? Edit" affordance, a password field, "Remember me", a "Forgot password?" link, and an "email me a magic link instead" fallback.
3. Enter the correct password → confirm it signs in and lands on `/dashboard`.
4. Repeat, entering a WRONG password → confirm an inline error appears and you STAY on the panel (not stuck, button re-enables).

### Scenario C — Validation & back-navigation
1. New `/join`, new email. On the email panel, type an invalid email (`notanemail`) → Continue must be blocked with an inline hint.
2. Advance a couple of panels, then use Back (or a completed progress dot) to return → confirm previously-entered values are preserved (email/name still filled).
3. On the venues panel, select nothing and continue → must advance (optional).

### Scenario D — Reduced motion
1. Turn on your OS "Reduce motion" setting.
2. Reload `/join` and step through panels → confirm panels change via a simple fade with NO sliding/translate animation, and the flow still fully works.

### Scenario E — Navbar entry points
1. Go to `<BASE_URL>/` (landing). Confirm the top-right shows **Log in** and **Sign up**.
2. "Log in" → `/login` (the existing waitlist/login page — unchanged). "Sign up" (Individual) → `/join`.
3. (Referral check) Visit `<BASE_URL>/r/SOMECODE` first (sets a referral cookie, redirects to `/`), then open the Sign up → Individual link → it should go to `/signup` (referral attribution preserved), NOT `/join`.

**Report:** for each scenario, PASS/FAIL + a one-line note + a screenshot of the key screen. Flag anything that looks visually off (contrast, alignment, the magic-link button styling on the dark shell) even if functional.
