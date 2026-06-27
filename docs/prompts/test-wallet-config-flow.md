# Chrome prompt — wallet config + balance aggregator QA

End-to-end smoke test of today's shipment: the `/api/balance` aggregator, the dashboard balance card, the Supabase-backed connections grid, and the new credentials wizard (Polymarket / Kalshi / Opinion).

This is **mostly read + UI inspection**, plus a few writes (connecting venues, optionally pasting real API keys). Default target is the user's local dev server. If they want to test against a deployed environment, ask first.

---

**Required inputs from the user before you start** — ask in chat if missing:

- `base_url` — defaults to `http://localhost:3000`. Confirm the dev server is running (`pnpm dev` from `~/sneakers-trading/apps/platform`).
- `email` — the email of the test account (must already exist in the Supabase auth users table)
- Sign-in method: this app uses **magic link** auth. Confirm the user can check that inbox during the run.
- `creds_to_test` — which (if any) of `polymarket`, `kalshi`, `opinion` they have real API keys ready to paste during this session. If empty/none, skip every step labeled `[REAL KEYS]` — just verify UI without hitting the test-connection step.

If any of those are missing, STOP and ask. Don't invent values.

---

## Step 0 — Sanity

1. Open `<base_url>` in a fresh tab. The marketing/landing page should render.
2. Open DevTools → Network tab. Leave it open for the rest of the run.
3. Visit `<base_url>/dashboard` directly. Unauthed → should redirect to `/signup` or `/login`. Note which.

If the dev server is unreachable or 500s, STOP and report.

## Step 1 — Sign in

1. Go to `<base_url>/login` (or `/signup` if that's where step 0 sent you).
2. Enter `email`, request the magic link.
3. Have the user open the magic link from their inbox in the SAME browser tab.
4. After auth, you should land on `/dashboard`. Confirm:
   - URL is `<base_url>/dashboard`
   - The user-name / email shows in the topbar (not "sign in")

## Step 2 — Dashboard balance card (empty state)

The new `BalanceCard` lives at `apps/platform/src/app/dashboard/balance-card.tsx` and self-hides when the user has zero connected venues.

1. On `/dashboard`, look for a card titled "SNEAKERS BALANCE" near the top of the page (above the WalletStatusCard amber "Set up your wallet" prompt, if it's still visible).
2. **For a fresh test account**: the BalanceCard should NOT render. Only the amber WalletStatusCard should appear.
3. In Network tab, confirm `GET /api/balance` was called and returned `200` with body `{ ok: true, totalCents: 0, currency: "USD", byVenue: [], fetchedAt: "..." }`.

**Success criteria**: card hidden, `/api/balance` returns empty `byVenue` array.

If `/api/balance` returns 401 → auth cookie isn't reaching the route. Screenshot + STOP.
If it returns 500 → check console + network for the error body. Capture and report.

## Step 3 — Connections grid (Supabase-backed)

1. Visit `<base_url>/dashboard/connections`.
2. The page should render a venue catalog grouped by category (Prediction Markets, Sportsbooks, etc.). The summary strip at top says "0 / [N] CONNECTED".
3. In Network tab, confirm a request to `/rest/v1/user_venue_connections` (the Supabase REST endpoint) on page load.
4. **Toggle a non-credentialed venue** — e.g., scroll to a sportsbook with no `affiliateUrl`, click CONNECT. Watch Network: should fire a `POST /rest/v1/user_venue_connections`. The card visually flips to the green "DISCONNECT" state immediately (optimistic update).
5. Refresh the page. The toggle should persist (NOT lost like the old localStorage version).
6. Click DISCONNECT on the same card. Watch for `DELETE /rest/v1/user_venue_connections`. State persists across refresh.

**localStorage migration test** (only relevant if this account previously used the old localStorage version):
- Open DevTools → Application → Local Storage → `<base_url>`.
- Look for `sneakers:connections:v1`. If present BEFORE the page load, it should be GONE after the page mounts (replaced by `sneakers:connections:migrated:v1` flag set to `1`).
- The migrated venues should now appear as connected in the grid.

If toggle doesn't persist across refresh, OR if the network call 4xx/5xx, capture body + STOP.

## Step 4 — Credentials wizard (UI only, no real keys yet)

Three credentialed venues open the wizard instead of just the affiliate link: **polymarket**, **kalshi**, **opinion**.

For each of those three (in any order):

1. Find the venue card in the Prediction Markets section of `/dashboard/connections`.
2. Click CONNECT. A modal should slide in.
3. Verify the modal header:
   - Logo (Polymarket/Kalshi/Opinion branding)
   - Venue name
   - Status pill: "NOT CONNECTED" (or "CONNECTED" / "RECONNECT" if creds already exist)
   - × close button (top-right)
4. Verify the **scope toggle**: two side-by-side cards labeled "Read only" and "Read + trade". Clicking should highlight the active one.
5. Verify the **affiliate nudge**: should appear ONLY if creds aren't already saved. Card with "Don't have a [Venue] account yet?" + "SIGN UP ↗" button. The button should target the right `affiliateUrl` (right-click → copy link to verify).
6. Verify the **per-venue fields**:
   - **Polymarket**: API key, API secret, passphrase. With scope=trade, ALSO shows wallet private key + funder address fields. With scope=read, hides the wallet section.
   - **Kalshi**: Access Key ID + Private Key (PEM textarea). Scope toggle does NOT change visible fields (PEM is required either way).
   - **Opinion**: single API key field. Plus a setup-steps explainer that mentions sending USDT on BNB Chain.
7. Test the close interactions:
   - Pressing **Esc** closes the modal.
   - Clicking the dark backdrop (outside the white card) closes it.
   - Clicking inside the white card does NOT close it.
   - The × button closes it.
8. Click "cancel" inside the modal — also closes it.

Repeat for each venue. Report any mismatch.

## Step 5 — `[REAL KEYS]` Submit + test connection

ONLY do this for venues in `creds_to_test`. Skip the rest.

For each venue with real keys:

1. Open the wizard (Step 4 procedure).
2. Choose scope = "Read only" first (lower-trust test).
3. Paste the credentials.
4. Click "SAVE & TEST".
5. Watch Network: `POST /api/autotrade/credentials` with body containing `venue`, `scope`, and the credential fields. Should return 200.
6. Inspect the response body:
   - `ok: true`
   - `test.ok: true` → success path
   - `test.ok: false` → save succeeded but verification call failed. Capture `test.reason` exactly — this is the most important diagnostic. Examples:
     - Polymarket: signing-wallet mismatch
     - Kalshi: "rejected the signature (check key ID + PEM)" → likely RSA-PSS vs PKCS#1 v1.5 mismatch (known risk; user has notes on the swap)
     - Opinion: "returned 404 for /portfolio/balance — the balance endpoint path may need updating" → confirmed-known issue; capture and STOP for that venue
7. If success: the modal should show a green "Connected and verified." toast and auto-close after ~1.2s. The status pill in the connection card should now be active (green border).

After connecting, navigate back to `/dashboard`. The BalanceCard should now render with the venue listed and a real cents value (or `unavailable` if the live fetch failed).

## Step 6 — Balance card with connected venues

1. On `/dashboard`, the SNEAKERS BALANCE card should now show:
   - Total in dollars (USD format)
   - Per-venue rows with each connected venue's name + amount
   - A "1 venue" / "N venues" pill in the top-right
2. Network tab: confirm `GET /api/balance` returned a `byVenue` array with one or more entries. Each row shape: `{ venue, status: "ok"|"error"|"no_credentials"|"unsupported", cents? }`.
3. If a row shows `unavailable` (amber color), hover for the tooltip — it should contain the underlying error from the venue.

## Step 7 — Disconnect flow

1. Open the wizard for a venue you connected.
2. Click "disconnect" (small text link near the SAVE button).
3. Confirm the browser native `confirm()` dialog.
4. Network: should see `DELETE /api/autotrade/credentials?venue=<id>`.
5. Modal stays open with a green "Disconnected." message; status pill flips to NOT CONNECTED.
6. Close modal. Refresh `/dashboard`. The disconnected venue should drop out of the BalanceCard (or the whole card hides if that was the last one).

---

## Hard guardrails

- Don't paste any API key the user didn't explicitly hand you for this run. Never invent or guess credential values.
- Don't run any destructive action outside of the explicit "disconnect" step in §7. No bulk DELETE, no DB-direct queries.
- If the user has 2FA on their email/Supabase, stop and let them complete it manually — don't try to automate it.
- If you hit `[REAL KEYS]` Step 5 with `test.ok: false` for Opinion specifically, that's an EXPECTED known issue (the balance endpoint path is a guess). Just capture the reason and continue with other venues.
- Only test on the URL the user named in `base_url`. Do NOT navigate to production unless explicitly asked.

## Report back

A punch list per step:
- ✅ pass / ⚠️ partial / ❌ fail
- For ❌: status code + response body (truncated to ~200 chars)
- For UI bugs: screenshot the affected element and which step it broke
- One bullet at the end: anything surprising or worth follow-up
