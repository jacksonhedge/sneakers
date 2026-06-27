# Verify dashboard RSC fix (commit 5fa3d74)

Background: the live dashboard was crashing for every visitor about 2s after first paint with **"Functions cannot be passed directly to Client Components"** (digest `321016599` and friends). Three Server Components under `/dashboard` — `biggest-volume.tsx`, `dashboard/quick/page.tsx`, `dashboard/positions/page.tsx` — were passing inline `format={(n) => …}` function props to `RollingNumber`, which is a Client Component. Next 16 forbids that across the RSC boundary, so render serialization threw, the root layout caught and unmounted the whole dashboard for **"This page couldn't load."** This is what the prior O'Toole-error-sanitization verify hit before it could even reach the chat panel.

Fix at `5fa3d74` on branch `fix/dashboard-rsc-function-prop`:
- New `<RollingFormatted />` ('use client') wrapper takes a string `format` key (`percent` / `percent1dp` / `fixed2` / `cents` / `cents1dp`) — RSC callers pass only serializable props.
- Swapped the 3 RSC call sites (biggest-volume, quick, positions).
- Added `app/dashboard/error.tsx` — segment-scoped error boundary so any future render error inside `/dashboard` fails locally, not at the root.

**Base URL (preview):** `https://sneakers-terminal-jqbmwf8oh-jackson-fitzgeralds-projects.vercel.app`

## ⛔ HARD RULE — no payment CTAs

Same rule as the site-sweep prompt — do NOT click any trial / subscribe / upgrade / pay / manage subscription / buy / checkout CTA anywhere on the preview. The Sneakers wallet button + tournament BUY IN entries are also in scope of this rule. Observation only.

## Step 0 — Sign in

Sign in at `<BASE>/login` using **email + password** (not magic link — preview URL isn't in Supabase's redirect allowlist). If sign-in requires the user's password, **stop and hand the tab back** for the user to drive auth.

Once authed, navigate to `<BASE>/dashboard`.

## Step 1 — The dashboard STAYS mounted

The whole point. The previous preview unmounted the dashboard to a "This page couldn't load / A server error occurred" screen within ~2s. After this fix it must stay.

Wait at least **15 seconds** on `/dashboard` after first paint without interacting. Report:
- Did the dashboard render and **stay** for the full 15s? y/n
- Did the page swap to **"This page couldn't load"** / **"A server error occurred"** at any point? y/n (expect n)
- Any "Try again" / "Back to home" / red error card visible? y/n (expect n)

## Step 2 — The Biggest Volume card actually renders

The fix's primary site. Look at the **"Biggest Volume"** rail / card on the dashboard. (If you can't find it by name, look for a list of markets with platform logos and percentage values on the right.)

Report:
- Is the Biggest Volume card visible? y/n
- How many market rows in it? `<N>`
- For the first row: copy the verbatim **percentage value** shown on the right (e.g. `42%`). Is it formatted as a percent (e.g. `42%` not `0.42` or `42.0000%`)?
- Is the small **$0.xx** line under the percent rendering as expected (2 decimals)?
- For any row with a **24h change** indicator (▲/▼ + percent), is the percent showing with one decimal (e.g. `1.2%`)?

## Step 3 — DevTools console + Network sanity

Open DevTools BEFORE interacting further.

- **Console tab:** any errors mentioning **"Functions cannot be passed"**, digest **321016599** / **2917971031** / **342900887**? (expect: NONE)
- **Console tab:** any errors mentioning **"Server Components render"** error? (expect: NONE)
- **Network tab:** filter to `_rsc`. Hover over any link or scroll — any `_rsc=…` requests with **503** status? (expect: NONE for the /dashboard subtree)
- **Network tab:** the GET for `/dashboard` itself — status code? (expect 200)

## Step 4 — Walk into the dashboard subroutes that share the bug fix

These two routes were also passing function props (same pattern as biggest-volume) and would have crashed when visited from /dashboard. Confirm they load now without unmounting the layout.

- Navigate to `<BASE>/dashboard/quick`. Wait 5s.
  - Page renders? y/n
  - Any rolling cent-formatted values visible (e.g. `42¢`)? y/n
  - Page swaps to error screen? y/n (expect n)
- Navigate to `<BASE>/dashboard/positions`. Wait 5s.
  - Page renders? y/n
  - Any rolling cent-formatted values visible (e.g. `42.4¢`)? y/n
  - Page swaps to error screen? y/n (expect n)

## Step 5 — Bonus: confirm the O'Toole chat now actually paints

Combine with the prior sanitization fix's intent — go back to `<BASE>/dashboard`, find the O'Toole chat panel (left-side panel based on the prior verify), and send: `What is the highest-volume Kalshi market right now?`

Report:
- Does the assistant message render **in the chat panel** (not in DevTools — actually visible on the page)? y/n
- The reply text (verbatim, first 120 chars): `<…>`
- Still no raw "Anthropic" / "credit balance" / JSON leak in the visible reply? y/n (expect: still no — but the prior fix is on a DIFFERENT branch, so the credit-balance leak may resurface on THIS preview)

> Note: this preview is built from `main`, which does NOT include the otoole-sanitize commit. The leak may resurface visibly. **That's expected on this preview** and is not a regression of this fix — the sanitization fix lives on `fix/otoole-sanitize-error-leak` and ships separately. Flag if you see it but don't fail this verify on it.

## Step 6 — Trigger the new error boundary (optional, only if you can)

The new `error.tsx` only fires if a render error occurs. There's no easy in-page button to force one without modifying state, so this step is **best-effort, skip if it would require risky interactions**. If you see any spontaneous error during your walk, note it and whether the new boundary card ("Something hiccuped here. · Try again / Back to home") appeared, OR the old "This page couldn't load" appeared. Old screen = boundary didn't catch (bad). New card = boundary caught (good).

## Report back

```
## Step 1. Stays mounted
- Rendered + stayed for 15s: y/n
- Swapped to "This page couldn't load": y/n  (expect n)
- Red error card visible: y/n  (expect n)

## Step 2. Biggest Volume renders
- Card visible: y/n
- Rows: <N>
- First row percent (verbatim): <…>
- $0.xx line correct (2 dp): y/n
- 24h delta row percent (1 dp, e.g. 1.2%): y/n / n/a

## Step 3. Console + Network
- "Functions cannot be passed" console errors: <NONE | list digests>
- "Server Components render" console errors: <NONE | list>
- _rsc 503s under /dashboard: <NONE | list>
- /dashboard status code: <…>  (expect 200)

## Step 4. Subroutes
- /dashboard/quick renders: y/n  |  cent values visible: y/n  |  errored: y/n
- /dashboard/positions renders: y/n  |  cent values visible: y/n  |  errored: y/n

## Step 5. O'Toole chat
- Reply visible in panel: y/n
- Reply text first 120 chars: <…>
- (Note: leak may resurface on this preview — sanitization ships separately)

## Step 6. Error boundary (optional)
- Any spontaneous error encountered: y/n
- If yes: which screen appeared? <new "Something hiccuped" card | old "This page couldn't load">

## VERDICT
- Dashboard crash: <FIXED / PARTIAL / STILL BROKEN>
- Function-prop RSC error gone from console: y/n
- Subroutes (quick / positions) usable: y/n
- Issues observed: <NONE | list>
```
