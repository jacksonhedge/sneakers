# Sneakers Terminal — Diagnose infra causing 40% 503 rate on RSC

The site is on Vercel, backed by Supabase. After three frontend QA passes, ~40% of all `_rsc` prefetch requests are returning 503 Service Unavailable. The 503s hit non-dashboard URLs too (`/?_rsc=…`, `/students?_rsc=…`), so it's not a route-specific bug — it's server-side capacity. Your job is to figure out which capacity ceiling we're hitting, in this order. Be specific. Read numbers off screens, don't paraphrase.

## 1. Vercel plan + concurrency limit (the most likely cause)

1. Go to `https://vercel.com/dashboard`. Sign in if needed (the user's account; ask if creds aren't given).
2. Find the project for `sneakersterminal.com` (it might be named "sneakers-trading" or similar).
3. Click into the project → Settings → **Billing** (or "General" → look for plan tier).
4. Report:
   - **Plan name** verbatim (Hobby / Pro / Enterprise / Free).
   - The "Function Invocations" or "Concurrency" line if visible.
   - Any line that mentions a quota approaching or over the limit.
5. Then go to Logs (sidebar) → filter to **last 24 hours** → status filter set to **5xx**:
   - How many 5xx events fired in the last 24h?
   - Open one (any one). Copy the **full error message** verbatim — particularly anything with words like `timeout`, `concurrency`, `memory`, `cold start`, `Connection reset`, `Service Unavailable`. The exact wording tells us which limit was hit.

If the plan is **Hobby**, that's almost certainly the answer. Hobby caps function concurrency very low and an RSC prefetch storm will saturate it. Note this and stop — no need to dig into Supabase.

## 2. Supabase connection pooler (second most likely)

1. Go to `https://supabase.com/dashboard`. Sign in if needed.
2. Find the project (likely the only one).
3. Sidebar → **Project Settings** → **Database** → scroll to **Connection Pooler** section.
4. Report:
   - Is "Connection Pooler" enabled? Yes/No.
   - The **pooler connection string** (just the host and port, e.g. `aws-0-us-east-1.pooler.supabase.com:6543`).
   - The **direct connection string** for comparison (e.g. `db.<project>.supabase.co:5432`).
5. Then sidebar → **Database** → **Database health** (or "Roles" / "Connections"):
   - Current active connections vs. max.
   - Any "max connections reached" warnings.
6. Also from sidebar → **Settings** → **Logs** → filter for the last hour:
   - Any `connection refused`, `too many clients`, or `pool timeout` messages?

The thing to confirm: is Vercel set up to talk to the **pooler** (port 6543, transaction mode), or directly to Postgres (port 5432)? Direct connections cap around 60-100 even on Pro plans; pooler scales to thousands. To check, in Vercel → Settings → Environment Variables, look for any var with `supabase.co:5432` in it — that's the direct port and it's the wrong one for serverless.

## 3. Vercel env var sanity check

1. Vercel → project → Settings → Environment Variables.
2. Find anything with `SUPABASE` or `DATABASE` in the name.
3. For each, report:
   - Variable name
   - Whether the value contains `:5432` (direct, bad for serverless) or `:6543` (pooler, good)
   - Whether it's set on Production / Preview / Development (all three is correct)
4. Also confirm `ANTHROPIC_API_KEY` exists and is set on Production. The OToole chat is failing with "no API key configured for anthropic" — this is the var that fixes it.

## Report format

```markdown
## Vercel
- Plan: <verbatim>
- Function concurrency limit (if visible): <number>
- 5xx events last 24h: <count>
- Sample error message: "<exact text>"

## Supabase
- Pooler enabled: yes/no
- Pooler URI: host:port
- Direct URI: host:port
- Active connections: X / Y
- Pool warnings: <any verbatim>

## Env vars
- Each `*SUPABASE*` / `*DATABASE*` var: name + ":5432" or ":6543" + scope
- ANTHROPIC_API_KEY present on Production: yes/no

## Verdict (one line)
"The bottleneck is <X> because <Y>." If unsure, list the top 2 candidates with evidence.
```

## Anti-fluff guardrails

- No suggestions, no "you might want to consider…" — just facts read off screens.
- If you can't reach Vercel or Supabase, stop and tell the user which login is missing.
- Under 400 words.
