# Chrome prompt — Railway introduction / orientation

Paste into the Claude Chrome window. Read-only survey: do not change any
settings, restart services, or edit env vars. Just look and report back.

---

You're helping me get oriented on a Railway project. Open https://railway.app
and go to the dashboard. I want a clear written report — don't change anything,
this is read-only reconnaissance.

Context: this Railway project hosts the Postgres database behind Sneakers
Terminal. The web app is deployed on Vercel and reads market data from this
Railway Postgres over its public TCP proxy. Supabase (separate) handles auth
and user data — ignore anything Supabase here.

Please walk the project and report:

1. **Project + services.** Project name, and every service/plugin in it.
   Which one is the Postgres database? Note any other services (scrape loop,
   workers, cron) and what each appears to do.

2. **Postgres service.** For the Postgres service specifically:
   - Plan / resource limits (RAM, CPU, disk volume size).
   - Current disk usage vs. the volume cap, if shown. (We've had
     "No space left on device" pressure on pgsql_tmp — flag the headroom.)
   - The public connection details: host, port, and whether a public TCP
     proxy / `DATABASE_PUBLIC_URL` is exposed. Do NOT paste the password in
     plaintext — just confirm the proxy exists and note the host:port shape.
   - Postgres version, and whether the TimescaleDB extension is installed.

3. **Recent deployments / activity.** For each service: last deploy time,
   status (success/failed/crashed), and anything in the recent deploy logs
   that looks like an error, OOM, or restart loop.

4. **Metrics.** If Railway shows metrics graphs, summarize the Postgres
   service's CPU / memory / disk trend over the last 24h–7d. Call out any
   spikes or a climbing disk line.

5. **Variables.** List the env var *names* present on each service (names
   only — do not reveal secret values). I mainly want to confirm what's wired
   where.

End with a short punch list: anything that looks unhealthy, near a limit, or
worth a closer look. If something needs me to click into it or you can't see
it without changing state, say so rather than guessing.
