## Hyperliquid integration — browser verification

### UPDATE (priority — read first)
The previous test session found `/dashboard` server-rendering for 17–20 minutes and never finishing — the "Reading O'Toole…" splash you saw was `loading.tsx` while the page hung on database connection timeouts. The banner code IS shipped (HMR confirmed compile) but lives inside the page that never returned.

**Dev server has been restarted (fresh PID, port 3000).** Try again — the dashboard may now render cleanly. If it still hangs >30 s, that's a real DB connectivity problem on the user's local machine (likely Railway Postgres unreachable; Supabase is fine for auth) — flag it and stop, don't try to debug it from the browser.

**New ordering, given the hang risk:**
- Run **Task 3 first** (O'Toole chat lives in the dashboard *layout*, not page.tsx — it should work even while the right-hand pane is hung).
- Then attempt **Task 2** (banner) — only verifiable if the dashboard page actually finishes rendering.
- **Task 1** (admin/hl) still requires the user to log in as the admin email first.



Goal: visually verify the new HL admin signals page and confirm O'Toole actually invokes the three new HL tools (vs answering from memory). All work in this prompt is **browser-only** — no filesystem, no shell, no code edits. The dev server is already running at http://localhost:3000.

### Prerequisites (do these yourself before starting)
1. Make sure you're logged in as **jacksonfitzgerald25@gmail.com** (the admin allowlist email). If currently logged in as a `+test1b` alias or any other account, sign out and back in. The admin gate compares email exactly against the `ADMIN_EMAILS` env var.
2. Have a tab open at http://localhost:3000.

### Task 1 — `/admin/hl` visual walk
Navigate to http://localhost:3000/admin/hl. Report back:

- Did the page load (no redirect to /dashboard?error=not_admin)?
- **Header**: count of perps shown ("Direct-from-API snapshot of all N…"). Does N look reasonable (~230)?
- **Crowded longs table** (left): are the funding APR values colored emerald and reasonable in magnitude? Any obvious dust/garbage in the top rows?
- **Crowded shorts table** (right): same check, red coloring, lowest funding rates.
- **Top OI table**: is BTC near the top with multi-billion $ OI? Are 24h % and funding APR colored correctly (green for positive, red for negative)?
- **"Next" deferred-features section**: does it render the bulleted list?
- **Top nav**: where is the new `HL` link positioned? Should be between `Scrapers` and `Alerts`. Does the nav wrap awkwardly on your viewport width?

If anything looks off (broken layout, missing data, weird formatting), screenshot or describe it.

### Task 2 — Not-admin banner check
1. Sign out, sign back in as a non-admin account (the `+test1b` alias is fine).
2. Try to navigate to http://localhost:3000/admin/hl — you should be bounced to `/dashboard?error=not_admin`.
3. Confirm: is there now an amber banner at the top of the dashboard reading "ADMIN-ONLY PAGE — You're signed in but not on the admin allowlist." with a `DISMISS` button?
4. Click `DISMISS` — does the banner go away?
5. Reload the page (with `?error=not_admin` still in the URL) — does the banner come back?
6. Then sign back in as the admin email for Task 3.

### Task 3 — O'Toole tool-call verification
On the dashboard, send each of these three prompts to O'Toole (one at a time, fresh thread or just sequentially in the same chat). For each: report whether you can see a **tool call indicator** (usually a brief "calling tool…" or a tool name shown in the message) before the answer arrives. If no indicator is visible, judge from the answer itself — does it cite specific live numbers, or does it sound generic / decline?

1. **"What's the funding rate on HYPE?"**
   - Expected tool: `get_hl_perp`
   - Expected answer: cites a specific funding APR % for HYPE, mark price, OI in $.
   - Failure mode: "I don't have access to live data" or made-up numbers.

2. **"Show me the most overheated perps"**
   - Expected tool: `get_hl_funding_outliers`
   - Expected answer: lists 3-10 coins ranked by extreme funding, with APR values and OI.
   - Failure mode: generic talk about funding without specific coins.

3. **"Compare BTC perp to Polymarket BTC markets"**
   - Expected tool: `compare_hl_to_predictions`
   - Expected answer: BTC HL state (mark, funding, OI) alongside specific Polymarket question titles + their YES prices.
   - Failure mode: only HL info OR only Polymarket info, not both juxtaposed.

For each prompt, paste the actual O'Toole response back so we can see what happened.

### Reporting back
Make one consolidated post with three sections:
- `Task 1 (admin/hl):` <findings>
- `Task 2 (banner):` <findings>
- `Task 3 (tools):` <prompt-by-prompt observations + actual answers>

If anything is broken or a tool didn't fire, that's actionable feedback for the code-side session. Don't try to fix it from the browser.
