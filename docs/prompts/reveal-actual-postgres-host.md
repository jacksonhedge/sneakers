# Vercel — reveal the actual POSTGRES_URL host (saved + runtime) to resolve the "base..." ambiguity

Background: code grep confirmed `apps/platform/src/lib/db.ts:26` reads ONLY `process.env.POSTGRES_URL` to build the connection that emits `[db] query failed, falling back: getaddrinfo ENOTFOUND base...`. So the failing hostname IS whatever's actually in `POSTGRES_URL` at runtime. We need to verify two things and confirm they match:

1. The hostname currently visible in the truncated `getaddrinfo ENOTFOUND base...` log line (full, untruncated)
2. The hostname stored in the Vercel env-var `POSTGRES_URL` row

If both = `shortline.proxy.rlwy.net` → the value is right; the lookup failure is something else (DNS propagation, IPv6, etc).
If both start with literal `base` → the save didn't actually take, or a paste error stored a different value.
If they differ → the runtime is reading something other than the env-var row (cache, integration, etc).

**SECRET HANDLING:** when revealing the env value, report ONLY the host portion (between `@` and `:`). Do NOT report the password (between `://postgres:` and `@`), the user, the path, or the full URL. The host is not a secret on its own.

## Step 1 — Expand a runtime log row to see the FULL failing hostname

1. Vercel → sneakers-terminal → Logs → Runtime tab → filter to last 30 minutes.
2. Find a recent row containing `[db] query failed, falling back: getaddrinfo ENOTFOUND`.
3. Click the row to expand it. The detail pane should show the full untruncated message.
4. Report the FULL hostname after `ENOTFOUND ` and before any trailing punctuation/whitespace.

## Step 2 — Reveal the saved POSTGRES_URL host (no save)

1. Settings → Environment Variables → click the `…` menu on the `POSTGRES_URL` row → **Edit**.
2. The edit dialog should show the value field with the actual stored value (Vercel reveals Sensitive values inside the edit dialog; the field will likely be a textarea or eye-toggle).
3. If there's an eye/show toggle, click it.
4. Read the URL.
5. **Report ONLY the host portion** — the substring between `@` and `:`. Example: for `postgresql://postgres:xxxxx@shortline.proxy.rlwy.net:18882/railway`, you'd report `shortline.proxy.rlwy.net`.
6. **Cancel** the dialog (do NOT click Save). Do not modify the value.

## Step 3 — Compare

If host from Step 1 == host from Step 2: the save is correct; the failure is downstream (DNS, network, port).
If host from Step 1 starts with `base` AND host from Step 2 = `shortline...`: the runtime is reading a stale/cached value.
If host from Step 2 also starts with `base`: the save did not take, despite the UI's "Updated 5m ago" timestamp.

## Report back

```
## Step 1. Runtime log full hostname
- Full message verbatim: <…>
- Hostname after ENOTFOUND: <…>

## Step 2. Saved POSTGRES_URL host
- Host portion only (between @ and :): <…>
- (Did NOT save — clicked Cancel)

## Step 3. Comparison
- Match: <yes / no>
- VERDICT: <save-correct-but-DNS-fails / runtime-reading-stale / save-didn't-take / other>
```
