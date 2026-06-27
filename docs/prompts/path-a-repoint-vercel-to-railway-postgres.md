# Sneakers Terminal — Path A: repoint Vercel POSTGRES_URL at Railway Postgres + drop seed flag

Background: prior diagnosis confirmed the Railway scraper service is healthy and writing to a Railway-hosted Postgres at `postgres.railway.internal:5432/railway` (10-min cadence, `✓ og done` per iteration). The Vercel platform's `POSTGRES_URL` points at a non-existent host (NXDOMAIN on `"base..."`), and `SNEAKERS_ENABLE_SEED=1` forces the seed fallback regardless. Both must change for live data — including the OG 28-group expansion — to surface in the production terminal.

You are an infra QA tester executing a **production env change**. Be deliberate. Confirm each step before proceeding. **Stop and ask the user** if anything is ambiguous (multiple Railway projects, multiple Postgres services, unexpected env vars, etc.).

**SECRET HANDLING:**
- The Postgres connection string IS a secret. Do not echo it into the chat at any point — not in confirmations, not in logs, not in error reports.
- If you need to confirm you copied the right thing, only report the **host:port prefix** (e.g. "copied URL with host `roundhouse.proxy.rlwy.net:12345`").
- When pasting into Vercel, use the form's paste behavior; do not screenshot the field with the value visible.

## Step 1 — Railway: get the public TCP proxy URL for Postgres

1. `https://railway.app` → project **glorious-playfulness** (the same project as the trader scraper).
2. Find the **Postgres** service (separate from the `sneakers-trading` Node service). If you see more than one Postgres, **stop and ask the user** which one the scraper writes to.
3. Open the Postgres service → **Connect** tab (or **Variables** tab if Connect doesn't exist).
4. Locate the **Public Network** connection string — it should be `postgresql://postgres:***@<host>.proxy.rlwy.net:<PORT>/railway` (the public TCP proxy, NOT the `.railway.internal` host).
   - If only the internal URL is shown, look for a "**TCP Proxy**" or "**Enable public networking**" toggle in Settings → Networking. Enable it (this is non-destructive — it just exposes the existing DB on a public proxy port). Then re-grab the URL.
5. Copy the full URL to clipboard.
6. Report back: `host:port` prefix only + confirm "URL copied to clipboard". Do NOT report the full URL.

## Step 2 — Vercel: update POSTGRES_URL on Production scope

1. `https://vercel.com` → `sneakers-terminal` project → Settings → **Environment Variables**.
2. Filter to **Production** scope. Locate the existing `POSTGRES_URL` row.
3. Note its current value's host prefix for the rollback record (you noted earlier the host began with `"base..."` — confirm and report that prefix one more time so we have the rollback target).
4. Click Edit on `POSTGRES_URL`. **Production scope only** (do not change Preview / Development for this pass).
5. Paste the URL from clipboard (Step 1).
6. Save.
7. Report: "Updated POSTGRES_URL on Production. Old host prefix: `<old>`. New host prefix: `<new>`."

## Step 3 — Vercel: remove SNEAKERS_ENABLE_SEED on Production

1. Same Environment Variables page, **Production** scope.
2. Locate `SNEAKERS_ENABLE_SEED`. Confirm it's set to `1`.
3. **Delete** the variable entirely (cleaner than setting to `0` — fewer dead vars). Production scope only.
4. Report: "Deleted SNEAKERS_ENABLE_SEED from Production."

## Step 4 — Vercel: trigger a redeploy

Env var changes require a redeploy to take effect.

1. Go to Deployments tab.
2. Find the most recent **Production** deployment (commit `4cdd858`).
3. Three-dot menu → **Redeploy**.
4. In the redeploy dialog: **uncheck "Use existing Build Cache"** (so env vars get re-baked into any prerendered routes). Confirm.
5. Wait until the new deployment is **Ready**. Report: "Redeploy finished, status Ready, deployment id `<id>`, age `<seconds>`."
6. If the redeploy errors, **stop and report the build log error verbatim**. Do not roll back env vars without checking with the user.

## Step 5 — Verify live data is flowing

1. Open `https://sneakersterminal.com/dashboard/markets?platform=og` in a fresh tab. Hard-refresh (Cmd+Shift+R).
2. Wait for the list to render.
3. Report:
   - **Total OG markets visible** — should be hundreds, not 1
   - **Latest "updated X ago"** — should be <10 min
   - **Sample 3 question titles** verbatim — look for World Cup / NFL / Inflation / etc. (the 28-group expansion should now be visible)
4. Open `/dashboard` — confirm the footer no longer says "13 markets across Kalshi, Polymarket, NoVig and ProphetX". Quote the new footer verbatim.
5. Open one OG market detail. Confirm the chart shows >2 historical points (Timescale should have hours of data accumulated by Railway's scrape-loop).

## Step 6 — Sanity: function logs

1. Vercel → Logs → last 5 minutes, filter Errors/Warnings.
2. Report:
   - Count of `getaddrinfo ENOTFOUND base` errors — should be **0** now
   - Any new errors that weren't there before
   - Count of 5xx responses

## Report back

```
## Step 1. Railway public Postgres URL
- Host:port: <host>.proxy.rlwy.net:<port>
- Copied to clipboard: <yes/no>
- Notes (multiple Postgres? toggle needed?): <…>

## Step 2. Vercel POSTGRES_URL update
- Old host prefix: <…>
- New host prefix: <…>
- Scope changed: Production only

## Step 3. SNEAKERS_ENABLE_SEED removal
- Was: 1
- Action: deleted from Production

## Step 4. Redeploy
- Triggered: <ts>
- Status: Ready / Error
- Deployment id: <…>
- Age at completion: <…>
- Build cache: skipped

## Step 5. Live data verification
- /dashboard/markets?platform=og total: <N>
- Latest updated: <X min ago>
- Sample titles:
  1. <verbatim>
  2. <verbatim>
  3. <verbatim>
- Footer (/dashboard) verbatim: <…>
- Market detail chart points: <N>

## Step 6. Function logs (last 5m)
- getaddrinfo ENOTFOUND base count: <N>
- New errors: <list or NONE>
- 5xx count: <N>

## VERDICT
- OG live data flowing in prod: <YES — fully / PARTIAL — <what's off> / NO — <what broke>>
- Rollback needed: <yes/no — and why>
```
