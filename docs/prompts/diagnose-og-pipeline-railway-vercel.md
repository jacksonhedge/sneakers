# Sneakers Terminal — diagnose why OG (and all live data) isn't reaching prod

Background: production terminal is serving the seed fallback (`apps/platform/src/lib/seed-snapshots.ts`) — only 13 hardcoded markets, OG = just `og-btc-week`. The 28-group OG expansion shipped to git as commit `4cdd858` and is presumed deployed to Vercel. The break is upstream of the platform: either the Railway scraper service isn't running, or it's running but its writes aren't landing in the DB the Vercel platform reads from.

You're an infra QA tester. **Be concrete. Verbatim values, statuses, timestamps. No adjectives.**

**SECRET HANDLING:** never paste full secret values back. For env vars, only confirm:
- whether the var EXISTS,
- the protocol/host prefix only (e.g. `postgresql://...supabase.co:6543/postgres` is fine; the password is not),
- the length (e.g. "value is ~120 chars").

If you're unsure whether something counts as a secret, redact it.

## 1. Railway — trader scraper service

1. Go to `https://railway.app/`. Sign in if needed (user handles auth).
2. Find the project that contains the **sneakers-trading** repo / **trader** service. The user will tell you the project name if you can't find it from the dashboard.
3. Open the **trader** service.

Report:
- **Service exists?** yes / no
- **Status:** Active / Crashed / Sleeping / Removed / other
- **Last deploy:** timestamp + commit SHA shown
- **Restart count in last 24h:** N
- **Build command:** verbatim (from Settings → Build)
- **Start command:** verbatim (should be `bash scripts/scrape-loop.sh`)

## 2. Railway — env vars on trader service

Settings → Variables. Confirm presence (NOT values) of each:
- `POSTGRES_URL` — exists? protocol/host prefix only (e.g. `postgresql://...supabase.co:6543/postgres`)
- `PROPHETX_BEARER_TOKEN` — exists?
- `NOVIG_BEARER_TOKEN` — exists?
- `PRIZEPICKS_COOKIE` — exists?
- `UNDERDOG_BEARER_TOKEN` — exists?
- `ODDS_API_KEY` — exists?
- `SCRAPE_INTERVAL_SEC` — exists? value if present
- `SNEAKERS_SKIP_DB` — exists? value if present (if `=1`, scraper is JSONL-only)

List anything else you see that's unusual.

## 3. Railway — recent logs from trader service

Open Logs (or Deploy Logs → Runtime). Filter / scroll to **last 30 minutes**.

Report:
- **Most recent timestamp** in logs
- **Are there any `iteration N` lines?** Quote the latest one verbatim
- **Are there any `✓ og done` lines?** Quote the latest one + 2 surrounding lines
- **Are there any `✗ og failed` lines?** If yes, quote the failure block (5 lines)
- **Any DB-related errors?** Search for: `POSTGRES`, `ECONNREFUSED`, `password authentication`, `connection terminated`, `pool`. Quote any matches verbatim.
- **Any "SNEAKERS_SKIP_DB" / "skipping db" messages?**

If the service is **Sleeping** or has no recent logs, that alone is the diagnosis — say so.

## 4. Vercel — sneakers-terminal project

Go to `https://vercel.com/`. Open the `sneakers-terminal` project.

Report:
- **Production deployment commit SHA** (top of Overview tab) — should be `4cdd858` or newer
- **Production deployment status:** Ready / Error / Building
- **Production deployment age:** how long ago

## 5. Vercel — env vars (Production scope only)

Settings → Environment Variables. Filter to **Production**. Confirm presence of each:
- `POSTGRES_URL` — exists? protocol/host prefix only. **CRITICAL: report the host so we can compare to Railway's.**
- `SNEAKERS_ENABLE_SEED` — exists? value if present (we suspect `=1`)
- `ANTHROPIC_API_KEY` — exists?
- `NEXT_PUBLIC_SUPABASE_URL` — exists? value (this one's not secret)
- `SUPABASE_SERVICE_ROLE_KEY` — exists?

## 6. Vercel — recent function logs

Logs tab → filter to last 1 hour, only **Errors / Warnings**.

Report:
- Count of 5xx responses in last hour
- Any errors mentioning `POSTGRES`, `ECONNREFUSED`, `markets`, `snapshots`, `timescale`, `pool` — quote 1-2 verbatim
- Any function-timeout errors

## Verdict

Based on 1–6, classify the failure into ONE of:

- **A. Railway trader service doesn't exist / isn't running** — no service, or status is Removed/Sleeping, or no logs in last hour
- **B. Railway running, but POSTGRES_URL missing or scraper misconfigured** — service Active, but no `POSTGRES_URL` var, or `SNEAKERS_SKIP_DB=1`, or DB errors in logs
- **C. Railway and Vercel point at different DBs** — both have `POSTGRES_URL` but the host prefixes don't match
- **D. Both point at same DB, scraper writes succeeding, but Vercel reads still empty** — scraper logs healthy, hosts match, no DB errors, but seed fallback still serving on prod (likely a code bug or `SNEAKERS_ENABLE_SEED=1` overriding)
- **E. Something else** — describe

## Report back

```
## 1. Railway trader service
- Exists: <y/n>
- Status: <…>
- Last deploy: <ts + sha>
- Restarts (24h): <n>
- Build cmd: <verbatim>
- Start cmd: <verbatim>

## 2. Railway env vars
- POSTGRES_URL: <exists y/n — host prefix only>
- PROPHETX_BEARER_TOKEN: <y/n>
- NOVIG_BEARER_TOKEN: <y/n>
- PRIZEPICKS_COOKIE: <y/n>
- UNDERDOG_BEARER_TOKEN: <y/n>
- ODDS_API_KEY: <y/n>
- SCRAPE_INTERVAL_SEC: <y/n + value>
- SNEAKERS_SKIP_DB: <y/n + value>
- (other notable vars): <list>

## 3. Railway logs (last 30m)
- Most recent log ts: <…>
- Latest `iteration N`: <verbatim or NONE>
- Latest `✓ og done`: <verbatim or NONE>
- Latest `✗ og failed`: <verbatim block or NONE>
- DB errors: <verbatim or NONE>
- SKIP_DB messages: <verbatim or NONE>

## 4. Vercel production deployment
- Commit SHA: <…>
- Status: <…>
- Age: <…>

## 5. Vercel env vars (Production)
- POSTGRES_URL: <exists y/n — host prefix>
- SNEAKERS_ENABLE_SEED: <y/n + value>
- ANTHROPIC_API_KEY: <y/n>
- NEXT_PUBLIC_SUPABASE_URL: <y/n + value>
- SUPABASE_SERVICE_ROLE_KEY: <y/n>

## 6. Vercel function logs (last 1h)
- 5xx count: <n>
- DB-related errors: <verbatim or NONE>
- Timeouts: <verbatim or NONE>

## VERDICT: <A | B | C | D | E>
- One-paragraph reasoning citing the specific lines above that drove the call.
```
