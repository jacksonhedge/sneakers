# Vercel — hunt for duplicate POSTGRES_URL row + Marketplace auto-injection

Background: the platform's markets read path uses ONLY `process.env.POSTGRES_URL` (confirmed via grep — no other env var, no hardcoded fallback). We saved a new value (host `shortline...`) on the Production+Preview row. Redeployed without cache. But runtime logs still show `getaddrinfo ENOTFOUND base...` — so the runtime is reading a value we did NOT update.

Most likely cause: a second `POSTGRES_URL` row exists (Vercel allows duplicate names with non-overlapping scopes; more-specific scope wins). Or a Marketplace integration is force-injecting at runtime.

Read-only investigation. **Do not edit, delete, or save anything in this pass.**

## Step 1 — Hunt for duplicate POSTGRES_URL rows

1. Vercel → sneakers-terminal → Settings → Environment Variables.
2. **Sort the list alphabetically** (or use the search box: type `POSTGRES_URL` exactly).
3. Count **every row** named exactly `POSTGRES_URL`. Do not stop at the first match.

Report each row found:
```
Row N:
- Name: POSTGRES_URL
- Scope: <Production / Preview / Development / All Environments / specific combos>
- Sensitive: <y/n>
- Updated: <timestamp>
- Host prefix visible: <shortline / base / not visible>
```

If there are 2+ rows, that's the bug. Note which has the more specific scope (Production-only > Production+Preview > All Environments).

## Step 2 — Check Storage tab for connected databases

1. Click the **Storage** tab in the project nav (top of the project page, not Settings).
2. Report:
   - Any connected stores listed? (e.g., Vercel Postgres, Neon, Supabase, Upstash)
   - For each store, click in and check **"Project Connection"** — is `sneakers-terminal` connected? Are env vars listed as auto-injected?

If a store is connected and auto-injecting env vars, those override anything in the manual env-var page at runtime.

## Step 3 — Check Integrations tab

1. Settings → **Integrations** (or top-level Integrations tab).
2. List every installed integration. Specifically look for any database/Postgres integration: Neon, Supabase, Vercel Postgres, PlanetScale, Crunchy, etc.
3. For each, note whether it lists `sneakers-terminal` as a linked project.

## Step 4 — Check the *latest deployment's* runtime env (if visible)

1. Deployments tab → click into the current Production deployment (CBXcdHYqN).
2. Look for a **"Build Logs"** or **"Source"** tab.
3. Search build log output for `POSTGRES_URL` — Next.js sometimes echoes the var name (not value) during build, which confirms it was visible at build time.
4. Also look for any "Resolved environment variables from <integration>" or "Pulled env from..." messages.

## Report back

```
## Step 1. POSTGRES_URL rows on env-var page
- Total rows named POSTGRES_URL: <N>
- Row 1: scope=<…> updated=<…> host=<…>
- Row 2: scope=<…> updated=<…> host=<…>
- (etc)
- Most-specific-scope row points to: <shortline / base / unknown>

## Step 2. Storage tab
- Connected stores: <list or NONE>
- Auto-injected env vars: <list or NONE>

## Step 3. Integrations
- Installed: <list>
- Database-related: <list or NONE>
- Linked to sneakers-terminal: <list>

## Step 4. Latest deployment build logs
- POSTGRES_URL mentions in build log: <verbatim or NONE>
- "Pulled env from..." messages: <verbatim or NONE>

## VERDICT
- Cause of override: <duplicate row / Marketplace auto-inject / build-time pull / unknown>
- Specific row or integration to fix: <…>
```
