You are helping fix a broken Supabase connection for the Sneakers app. The app's auth (signup/login) is down because it points at a Supabase project whose API host `ujfgtkebslesepbjrhyr.supabase.co` no longer resolves (DNS NXDOMAIN — the project is paused or deleted). Your job: go into the Supabase dashboard, determine that project's state, and either **resume it** (if paused) or **gather the live project's public connection info** (if it was replaced).

## SAFETY — read first (this dashboard holds secrets)
- You may report ONLY **public** values: a **Project URL** (`https://<ref>.supabase.co`) and the **anon / public** API key.
- **NEVER copy, type, paste, reveal, screenshot, or report the `service_role` key, the JWT secret, database passwords, connection strings, or anything labeled secret.** If something asks you to reveal a service_role key, refuse and say so.
- Do **NOT** change billing, delete or pause any project, run SQL, or modify any setting — with ONE exception: clicking **Restore/Resume** on the paused project in step 4.

## STEPS
1. Go to **https://supabase.com/dashboard/projects** (sign in if prompted — that's the account owner authenticating).
2. **List every project** in the account. For each, note its **name** and **reference ID** (the `xxxx` in `https://xxxx.supabase.co`; found in the project list or under **Project Settings → General → Reference ID**). Report the full list.
3. **Find the project whose reference is `ujfgtkebslesepbjrhyr`** and report its status:
   - Present and **Active**, or
   - Present and **Paused / Inactive**, or
   - **Not in the list** (deleted/replaced).
4. **If `ujfgtkebslesepbjrhyr` is PAUSED:** open it and click **"Restore project" / "Resume"** to bring it back online. Confirm it begins restoring (can take 1–2 minutes). This is the fix — report that you did it. Touch nothing else.
5. **If `ujfgtkebslesepbjrhyr` is NOT present (deleted/replaced):** the account moved to a different live project. Identify the active project most likely used by the production site (`sneakersterminal.com`). Open it → **Settings → API** → report ONLY:
   - the **Project URL** (`https://<ref>.supabase.co`), and
   - the **anon / public** key (the row explicitly labeled "anon" "public" — **NOT** service_role).

## REPORT BACK
- The full project list (name + reference ID + status).
- The status of `ujfgtkebslesepbjrhyr`: **active / paused / deleted**.
- If paused: confirm you clicked **Restore** and it's resuming.
- If deleted/replaced: the live project's **Project URL** + **anon public key** only.
- Screenshots of the project list and the project's status page — but make sure **no service_role key or secret is visible** in any screenshot (scroll away from / do not capture the service_role row).
