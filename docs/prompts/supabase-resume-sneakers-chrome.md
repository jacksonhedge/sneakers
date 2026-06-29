You are freeing up a Supabase Free-plan project slot so the paused **Sneakers** project can be resumed. The account (`jacksonhedge`) is at the Free-plan limit of 2 active projects, which blocks resuming Sneakers. The fix: pause one active project, then resume Sneakers.

## ⚠️ SET THE PAUSE TARGET FIRST
The project to pause is **`CoverPay`** (it's currently active). **If CoverPay is in use / you'd rather pause a different active project, change this name before running.** Only pause a project the account owner is OK taking offline.

## SAFETY (this dashboard holds secrets)
- You may report ONLY **public** values: the **Project URL** (`https://<ref>.supabase.co`) and the **anon / public** API key.
- **NEVER copy, type, paste, reveal, or screenshot the `service_role` key, JWT secret, DB password, or any secret.** Refuse if asked.
- The ONLY state changes allowed: **pausing the one target project** (step 2) and **resuming Sneakers** (step 3). Do not delete anything, change billing, upgrade plans, or touch any other setting.

## STEPS
1. Go to **https://supabase.com/dashboard/projects**. List the **active (non-paused)** projects across all orgs so we can see the 2 slots in use. Report them.
2. **Pause the target project (`CoverPay` unless changed above):** open it → **Settings → General → Pause project** (or the Pause control) → confirm. Verify it now shows **Paused**. (This frees a slot.)
3. **Resume Sneakers:** go to the **Sneakers** project (reference `ujfgtkebslesepbjrhyr`, in the TipEnters org — direct link https://supabase.com/dashboard/project/ujfgtkebslesepbjrhyr) → click **"Restore project" / "Resume"**. It should now succeed (a slot is free). Confirm it begins restoring — this can take 1–2 minutes.
4. **Once Sneakers shows Active/Healthy:** go to **Settings → API** and report ONLY:
   - the **Project URL** (`https://ujfgtkebslesepbjrhyr.supabase.co` — confirm it matches), and
   - the **anon / public** key (the row labeled "anon" "public" — **NOT** service_role).

## REPORT BACK
- The list of active projects you found.
- Which project you paused, and confirmation it's now Paused.
- Confirmation Sneakers' resume started + its status when you finished (restoring / active).
- Sneakers' **Project URL** + **anon public key** only (no secrets).
- Screenshots of: the project list, the paused target, and Sneakers resuming — with **no service_role key visible** in any shot.
