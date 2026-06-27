# Sneakers Terminal — Switch POSTGRES_URL to pooler + add ANTHROPIC_API_KEY

You're a config agent for the user's Sneakers Terminal deployment. We diagnosed that `POSTGRES_URL` on Vercel is pointing at the direct Postgres port (`:5432`) instead of the pgBouncer pooler (`:6543`). 14/60 direct connections are pinned at all times while the pooler is idle. This needs to be flipped, plus `ANTHROPIC_API_KEY` is missing on Production. Two env-var changes total.

**Do them in this exact order — do not skip steps.** If any step fails or asks for a password the user hasn't given you, stop and ask before guessing.

## Step 1 — Get the new pooler URI from Supabase

1. Go to `https://supabase.com/dashboard`. Sign in if needed.
2. Open the **Sneakers** project.
3. Sidebar → **Project Settings** → **Database**.
4. Scroll to the **Connection string** section. There are tabs: **URI**, **PSQL**, **Golang**, etc., and another row of tabs for **Direct connection** vs **Transaction pooler** vs **Session pooler**.
5. Click **Transaction pooler** (NOT Direct, NOT Session). This is what serverless functions need — port `6543`, statement-level pooling.
6. Copy the full URI. It looks like `postgres://postgres.<projectRef>:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres`. The password is shown inline (Supabase reveals it while you're logged in).
7. Append `?pgbouncer=true` to the end so pg-node knows to skip prepared statements that pgBouncer transaction mode can't handle. The full string should now end with `…/postgres?pgbouncer=true`.
8. Hold this string somewhere — clipboard or a note. You'll paste it in Step 2.

## Step 2 — Paste it into Vercel

1. Go to `https://vercel.com/dashboard`.
2. Open the **Sneakers Terminal** project (or `sneakers-trading`).
3. Settings → **Environment Variables**.
4. Find **`POSTGRES_URL`** (sensitive, marked Production + Preview).
5. Click the **⋯** menu → **Edit**.
6. Replace the existing value with the pooler URI from Step 1 (the one ending in `?pgbouncer=true`).
7. Make sure all three environment scopes stay checked: **Production**, **Preview**, **Development**.
8. **Save**.

## Step 3 — Add the Anthropic API key

1. While still on the Environment Variables page, click **Add New**.
2. Get the key from the user. It starts with `sk-ant-api…`. If they haven't given it, **stop and ask** — do not invent or copy a key from anywhere else. Tell them they can find or generate one at `https://console.anthropic.com/settings/keys`.
3. Set:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api…` (the user's key)
   - **Environments:** check all three (Production, Preview, Development)
4. Save.

## Step 4 — Trigger a redeploy

Vercel sometimes redeploys automatically on env-var change, sometimes it doesn't. To be safe:

1. Sidebar → **Deployments** → find the most recent Production deployment.
2. Click its **⋯** menu → **Redeploy** → confirm with **Use existing Build Cache: OFF** (uncheck the cache). Reason: env vars are baked into the build only sometimes; a cache-less redeploy guarantees the new values land.
3. Wait until the deployment status flips to **Ready** (~2 min).

## Step 5 — Verify the pooler is being used

1. Back to Supabase → Sneakers → **Database** → **Database Health** (or **Roles** / **Connections**).
2. After a few minutes of normal site traffic, the **Pooler client connections** count should rise above 1 (where it was stuck), and the **direct connections** count should drop toward 0.
3. The user can also open `sneakersterminal.com/dashboard` and click around — the QA's earlier ~40% 503 rate on `_rsc` should drop near 0.

## Report back

Reply with:

```
- POSTGRES_URL updated: yes/no, ends with `?pgbouncer=true`: yes/no
- ANTHROPIC_API_KEY added: yes/no, set on Production: yes/no
- Redeploy completed: yes/no, deployment status: <Ready/Error/...>
- Verified pooler in use (Supabase shows pooler conn > direct conn): yes/no/too early to tell
- Anything that didn't work: <verbatim>
```

## Hard guardrails

- **Never paste an Anthropic key you find lying around** anywhere except the user's own clipboard / a value they explicitly hand you. If unsure, stop.
- **Never edit any other env var** besides `POSTGRES_URL` and `ANTHROPIC_API_KEY`.
- **Never delete any env var.**
- **Don't run any SQL** in the Supabase SQL editor — migrations are out of scope for this prompt.
- If Vercel asks for 2FA / re-auth, stop and ask the user.
