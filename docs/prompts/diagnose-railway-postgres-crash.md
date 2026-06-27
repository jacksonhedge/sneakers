# Railway Postgres crash investigation (morning 2026-05-04)

Background: user got a Railway notification that something on Postgres crashed this morning. Need to know: (a) what crashed (Postgres service vs the trader service), (b) when, (c) why, (d) is it back up now, (e) what's the blast radius.

Context from last night's session: we observed pgsql_tmp temp-tablespace pressure (warning at 03:33 EDT), then a `BufFileDumpBuffer` failure on the recompute-arb-pairs job. The 376k-row sort was spilling and overflowing pgsql_tmp. We dropped the ORDER BY in commit `426aff5` to eliminate the spill — but the underlying volume pressure may have continued to grow from other sources.

Read-only investigation. **Do not restart or redeploy anything in this pass.**

## Step 1 — Identify what crashed

1. Go to `https://railway.app` → project `glorious-playfulness`.
2. Look at the dashboard service list. Anything with a red status, "Crashed", "Failed", or restart count >0?
3. Report:
   - Service name + status badge for each service in the project
   - Timestamps if any service shows "Last failed at..." or "Restarted at..."

## Step 2 — Postgres service deep-dive

Click into the **Postgres** service (the one our scraper writes to + Vercel reads from).

Report from the **Overview** tab:
- Status: Active / Crashed / Restarting / Sleeping
- Uptime
- Last deploy / restart timestamp
- Restart count in last 24h

Report from the **Metrics** tab:
- CPU usage trend (any spike around the morning crash time?)
- Memory usage trend (was it climbing toward limit?)
- Disk usage (% full, current vs total, look for a ramp pattern)
- Network I/O (anything anomalous?)

Report from the **Settings → Volumes** tab if visible:
- Volume size
- Used %
- Mount point

## Step 3 — Postgres logs around the crash

Open **Logs** on the Postgres service, scroll to roughly 6-12 hours ago (the "this morning" timeframe).

Look specifically for:
- `out of memory` / `OOM` / `killed`
- `No space left on device` / `pgsql_tmp` / `BufFileDumpBuffer`
- `PANIC` / `FATAL` / `restarting`
- `archive_command failed`
- Any line with `LOG:` immediately before a service restart

Report the **first 5 fatal/panic lines** verbatim and the **first restart line** timestamp.

## Step 4 — sneakers-trading (scraper) impact

Click into the `sneakers-trading` service. Logs.

Report:
- Were any scraper iterations between the Postgres crash time and now showing `✗ ... failed` lines?
- Specifically check: `recompute-canonical`, `recompute-arb-pairs`, and the per-platform scrapers
- What's the most recent successful iteration completion time?
- Is the scrape-loop still running (pid alive in logs) or did it die alongside Postgres?

## Step 5 — Current connectivity

1. Vercel → sneakers-terminal → Logs → Runtime → last 30 min.
2. Search for `[db] query failed` (the slow-query observability we added in `545197a`).
3. Report:
   - Count of failed queries last 30 min
   - Verbatim 1-2 most recent failure lines (will tell us if Vercel can currently reach Postgres)

If Vercel logs show many `query failed` lines, prod is currently degraded and we need to act fast. If 0, Postgres recovered cleanly.

## Step 6 — Volume / disk hypothesis check

If Step 2 showed disk at >85% full, that's likely the root cause. Postgres needs free space for WAL + temp tables. Once the volume fills, writes start failing → service may force-restart.

Report Volume %. If high, flag for immediate user action (Railway → Postgres → Settings → upgrade volume size).

## Report back

```
## Step 1. Service status
- Service A: <name> — <status, restart count>
- Service B: <name> — <status>
- Service C: <name> — <status>

## Step 2. Postgres deep-dive
- Status: <…>
- Uptime: <…>
- Last restart: <ts>
- Restarts (24h): <N>
- Memory %: <…>
- Disk %: <…>
- CPU trend during crash: <…>
- Volume size / used: <…>

## Step 3. Postgres crash logs
- First fatal line: <verbatim + ts>
- Crash type (OOM / disk-full / other): <…>
- Restart timestamp: <…>

## Step 4. Scraper impact
- Most recent ✓ scrape iteration: <ts>
- Failed steps since crash: <list>
- Scrape-loop alive: y/n

## Step 5. Vercel→Postgres connectivity now
- "[db] query failed" count last 30m: <N>
- Verbatim recent failure: <…>

## Step 6. Disk hypothesis
- Disk %: <…>
- Verdict: disk-full root cause / not disk / unclear

## OVERALL DIAGNOSIS
- What crashed: <…>
- When: <…>
- Why: <…>
- Currently up: y/n
- User action needed: <none / increase volume / increase memory / other>
```
