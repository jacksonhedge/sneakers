## Quick check — admin tournaments page + admin cap tier

Two things, ~3 minutes. Target host: **https://admin.sneakersterminal.com** for #1, **https://sneakersterminal.com** for #2. Sign in as admin.

### 1. Admin tournaments page

Open `https://admin.sneakersterminal.com/tournaments`.

Expect:
- Header reads `> TOURNAMENTS` with a count summary
- Four summary tiles up top (Window / Total fill / Locked + ready / Underfilled)
- A table with 30 rows; columns: STARTS IN / FLAVOR / SIZE / DURATION / MODE / VENUE / BUY-IN / CASH / FILL / PRIZE POOL / STATUS
- Mode column shows `🤖 BOT` (emerald) for autobot rounds, `MANUAL` (gray) for manual
- Status column shows colored pills (`WAITING` / `LOCKED` / `STARTING` / `LIVE` / `UNDERFILLED`)
- VENUE cells are clickable links to `/affiliates`

PASS / FAIL · note anything off.

### 2. Cost cap — admin tier

Go to `https://sneakersterminal.com/dashboard`. Send any short message to O'Toole (e.g. `hi`).

In DevTools → Network → POST `/api/otoole/chat` → Response body, find the `cap` object.

Expect: `cap.tier === "business"` (admin → uncapped) and `cap.costUsdCap` is `null` or a very large number.

If `cap.tier === "free"` — paste the full `cap` object back. That's the wiring miss we're trying to pin down.

PASS / FAIL · paste the cap object you saw.

---

That's it. One paste-back when both done.
