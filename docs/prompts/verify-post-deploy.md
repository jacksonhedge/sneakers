# Sneakers Terminal — verify the pooler + Anthropic-key deploy

## What we just shipped

Two production env-var changes on Vercel, then a redeploy with build cache off:

1. `POSTGRES_URL` was pointing at the direct Postgres port (`:5432`) which on a Vercel Fluid runtime exhausted Supabase's 60-direct-connection cap and was causing ~40% 503s on RSC prefetches across the whole site. New value points at the **Supavisor shared pooler** at `aws-0-us-east-1.pooler.supabase.com:6543` with `?pgbouncer=true` so pg-node skips prepared statements.
2. `ANTHROPIC_API_KEY` was missing on Production entirely, which is why the O'Toole chat panel was responding "no API key configured for anthropic" on every message.

The corresponding code change (`db.ts`) was already shipped — pool size auto-detects pooler vs direct and uses `max:1` in pooler mode so each Vercel function holds one slot, pgBouncer fans out across instances.

## What you need to do now (verify the deploy worked)

The user just clicked Redeploy. Wait for the deployment to flip to **Ready** in Vercel, then run all four checks below. If any of them fails, stop and report which one.

### 1. Deploy is live

- Go to Vercel → Sneakers Terminal → Deployments. Confirm the most recent Production deploy shows status **Ready** (green check). Note the deployment ID.

### 2. Supabase pooler is being used

- Go to Supabase → Sneakers project → **Database** (left sidebar) → look for "Connection pooling" or "Database Health" subpage.
- Read the **active connections by mode**: there should be a "Pooler client connections" or "Supavisor" count and a "Direct connections" count.
- **Expected:** pooler client count above 1 (climbing as the site gets traffic), direct connection count dropping toward 0.
- **Bad:** if the direct count is still pinned at ~14 with pooler at 1, the new env var didn't take effect — likely Redeploy didn't run with cache off, or POSTGRES_URL still points at `:5432`.

### 3. O'Toole chat works

- Go to `https://sneakersterminal.com/dashboard`. Sign in if needed.
- In the left chat panel, type: `find me Polymarket markets where the YES is between 10 and 35 cents` and press Enter (or click the send arrow).
- **Expected:** O'Toole responds with actual content within 5–10 seconds. May propose a trade card.
- **Bad:** any response containing "no API key configured for anthropic" — the env var didn't bake in.

### 4. 503 rate is down

- Open DevTools → Network tab → filter for `_rsc`.
- Click around: `/dashboard` → click a topbar filter pill (Sports / Politics / Crypto) → click a market row in Biggest Volume → click back → click another pill.
- After ~6 navs, count the `_rsc` requests with status **503** vs **200**.
- **Expected:** 503 rate near 0%. Last QA pass was ~40%.
- **Bad:** still 25%+ 503s — server is still saturating somehow.

## Report back

```
- Deploy ID: <id> · status: Ready/Error
- Supabase pooler count: <N> · direct count: <M>
- O'Toole replied with content (not "no API key"): yes/no · latency: <Xs>
- _rsc 503 rate sampled: <X / Y> = <pct>%
- Anything unexpected: <verbatim>
```

Under 200 words.
