## Verify deploy d32524d — tournaments + teach-bot + affiliate admin + $2/day cap

Commit `d32524d` was just pushed to `origin/main`; Vercel is rebuilding prod now. Once that finishes (~2 min), run this sweep against the live host.

**Target host: https://sneakersterminal.com** (NOT localhost — this is the prod verify pass).
**Admin host:** `https://admin.sneakersterminal.com` (separate subdomain; main `/admin/*` paths redirect there).

Sign in with an admin email so the admin checks work.

Two notes up front:
- Two intentional gaps: the admin nav entry for `Affiliates` was deferred (reach the page via direct URL only), and the O'Toole sidebar's BYO-row copy still reads `"capped daily"` instead of `"$2/day budget"` (cap itself enforces — only the copy is stale). Both are noted as "pending follow-up" in the commit. Don't flag them as regressions.
- The full-session-sweep prompt from earlier covers the same ground in more detail. This one is the **deploy-verify pass** — tighter, focused on the new commit's surface.

---

## Task 1 — Old tiles fully gone

1. Load `https://sneakersterminal.com/dashboard`. Sign in if redirected.
2. In the center 3-column row, the strings `Cross-Book Spread` and `Normalized Market Performance` should NOT appear anywhere.
3. Hard-refresh once (Cmd+Shift+R) if either is still present — Vercel may have served you stale cache.

PASS / FAIL · note any string still seen.

---

## Task 2 — Tournaments tile (middle column)

1. Header: `Tournaments` with a fuchsia/pink **NEW** pill on its left.
2. Top-right: `ALL →` link → navigates to `/dashboard/horse-race`. Click it. Should land on the lobby (NOT a 404). Click back.
3. Up to 5 rows. Each row has: asset badge (₿/Ξ/◎), flavor (`BTC sprint` / `ETH sprint` / `SOL classic` / `BTC classic` / `BTC marathon`), size pill (`1V1 DUEL` / `5P TABLE` / `10P TABLE`), `$N · <Venue> · X/Y`, fill bar, countdown, fuchsia `BUY IN →` button.
4. Wait 3 seconds — at least one countdown decrements.
5. Footer: `Crypto Horse Race · 5/15/30-min strike markets` with `OPEN LOBBY →` link.

PASS / FAIL.

---

## Task 3 — Teach-Your-Bot tile (right column)

1. Header: `🤖 Teach your AI bot to trade` + `5 PICKS` chip.
2. Body shows 5 cards in this order:
   1. ARTICLE — Sneakers — *How O'Toole reads markets — strategy, not signal*
   2. TWEET — @cryptoTrader — *Fading Polymarket overround on settled events*
   3. ARTICLE — Aaronson + co. — *Prompting an LLM to size positions like a trader*
   4. TWEET — @kalshi_quant — *Cross-venue arb on weather contracts*
   5. VIDEO — @predictionalpha — *Building a Polymarket bot in 30 minutes*
3. Each card has a kind chip + author + yellow `COMING SOON` badge (placeholders) + bold title + 2-line hook.
4. Clicking a card does nothing (URLs are placeholders). Confirm.
5. Footer: `STRATEGY →` link to `/dashboard/settings/otoole`.

PASS / FAIL.

---

## Task 4 — Lobby + tournament join flow (was 404, now should work)

1. Navigate to `https://sneakersterminal.com/dashboard/horse-race` directly.
2. Confirm the lobby loads (NOT a 404). Header reads "Sneakers Tournaments" or similar; rolling schedule of tournaments visible by venue.
3. Click `BUY IN →` on any **Polymarket** row. Modal opens.
4. Click "I already have one — connect", paste `0xabcdef12`, click VERIFY. Wait for the success toast `"Connected — Polymarket verified · Account 0xabcdef12 ready..."` (retry if you hit the simulated 10% failure path).
5. Modal closes. Now click `BUY IN →` on a **different Polymarket** row (different size or flavor).
6. **Expected**: modal opens straight onto the fast-track step:
   - Emerald `✓ Polymarket already connected · Account 0xabcdef12 · verified this session` banner
   - White Buy-in summary card
   - Big emerald `CONFIRM BUY-IN — $X` button
   - Smaller `Re-verify Polymarket account` link
7. Click `CONFIRM BUY-IN`. Toast: `"Buy-in queued — <flavor> · <size> on Polymarket. Live escrow + payment goes live next round."`
8. Back at the lobby: every Polymarket BUY IN button is now emerald with a leading `✓`. Other venues stay fuchsia.

PASS / FAIL · note if state persistence works across rows.

---

## Task 5 — Focus trap + click shield (round-3 a11y fixes)

1. From the lobby, mouse-click `BUY IN →` on any non-verified venue row.
2. Modal opens. Hit `Tab` repeatedly. Focus should cycle inside the dialog (×, sign-up card, connect card) and never leak out into the lobby below.
3. `Shift+Tab` from the first focusable should wrap to the last.
4. Press `Esc` to close. Focus should return to the BUY IN button you clicked from. Hit `Enter` — should re-open that row's modal.
5. **Click shield**: rapid-click `BUY IN →` on a row five times in fast succession. Exactly **one** modal opens. **Zero** affiliate tabs spawn (vs. the round-2 bug where 4+ ?ref=SNEAKERS tabs appeared).

PASS / FAIL.

---

## Task 6 — Truncate threshold

1. From the lobby, BUY IN on any unverified row, paste `0xdeadbeef1234` (14 chars exactly), VERIFY.
2. Success toast should read: `"Account 0xdead…1234 ready..."` (truncated).
3. Try `0xabc12345` (10 chars) on another venue → toast unchanged: `"Account 0xabc12345 ready..."`

PASS / FAIL.

---

## Task 7 — Affiliate admin (direct URL only — nav entry deferred)

1. Navigate directly to `https://admin.sneakersterminal.com/affiliates`. (If the subdomain redirects/404s, also try `https://sneakersterminal.com/admin/affiliates` — that should redirect to the subdomain.)
2. **Expected**: page loads with header `> VENUE AFFILIATE LINKS` and `5 venues · 0 overridden`.
3. Five cards in order: Polymarket, Limitless, OG, Hyperliquid, Kalshi. Each shows a `DEFAULT` pill.
4. Edit Polymarket: paste `https://polymarket.com/?ref=DEPLOYTEST` and code `DEPLOYTEST`. Click `SAVE`.
5. **Expected**: green toast `saved polymarket`. Pill flips to `OVERRIDE`. Timestamp + email appear top-right.
6. Open `https://sneakersterminal.com/dashboard/horse-race`, click BUY IN on a Polymarket row, click "Sign up via Sneakers" card. New tab should open `https://polymarket.com/?ref=DEPLOYTEST` (NOT `?ref=SNEAKERS`). Modal's amber post-signup banner reads `"Use code DEPLOYTEST at signup."` Sign-up card title shows emerald `CODE DEPLOYTEST` chip.
7. Back at admin, click `RESET TO DEFAULT` → pill flips back to `DEFAULT`, lobby's next BUY IN no longer shows the code chip.

PASS / FAIL · note any redirect issues to the admin subdomain.

---

## Task 8 — Cost-cap server-side wiring

1. From the dashboard, send any short prompt to O'Toole (e.g., `hi`).
2. Open DevTools → Network → filter `chat`. Click the POST `/api/otoole/chat` row → Response.
3. **Expected fields in the JSON**:
   - `cap.tier` — `"business"` if you're an admin, `"free"` otherwise
   - `cap.limit` — number (5 for free)
   - `cap.used` — increments by 1
   - `cap.costUsd` — small positive number (probably <0.01 for one short message) ← NEW
   - `cap.costUsdCap` — `2` for free, ∞ for business ← NEW
   - `usage.input` / `usage.output` — token counts

PASS / FAIL · note exact `cap` object values seen.

---

## Task 9 — Confirm deferred copy hasn't regressed

The two intentional follow-ups: the admin nav and the O'Toole sidebar copy. Both should look UNCHANGED from before.

1. `/admin` (nav at top). The list of admin nav items should NOT include `Affiliates` yet. (If it does, great — but per the deploy notes, that wasn't shipped this commit.)
2. Open the O'Toole sidebar on `/dashboard`. Above the chat input, the row should read `On Sneakers' key · free, capped daily` (the OLD copy). The cap STILL enforces server-side per Task 8 — only the displayed copy lags.

PASS / FAIL — really just confirming we didn't accidentally ship the dirty working tree.

---

## Reporting back

```
Task 1 (old gone):           PASS/FAIL · note
Task 2 (Tournaments tile):   PASS/FAIL · note
Task 3 (Teach-bot tile):     PASS/FAIL · titles seen
Task 4 (lobby + fast-track): PASS/FAIL · note
Task 5 (focus trap + shield): PASS/FAIL · note
Task 6 (truncate threshold): PASS/FAIL · toast text seen
Task 7 (affiliate admin):    PASS/FAIL · subdomain reachable=Y/N · save+lobby-update worked=Y/N
Task 8 (cost cap):           PASS/FAIL · paste cap object
Task 9 (deferred unchanged): PASS/FAIL · nav has Affiliates? · panel copy?

Top 3 issues:
  1.
  2.
  3.

Top 3 working surprisingly well:
  1.
  2.
  3.

Anything broken vs. polish — call out which.
```
