# Chrome prompt — add localhost to Supabase redirect allowlist

Adds `http://localhost:3000/auth/callback` (and a wildcard) to the Supabase Auth redirect URL allow-list so magic-link emails sent from local dev redirect back to localhost instead of falling back to the Site URL (production).

---

Task: update the Supabase Auth URL configuration so localhost redirects are allowed for the Sneakers Terminal project.

Prerequisites:
- Logged into supabase.com with access to the Sneakers Terminal project
- Project ref: **ujfgtkebslesepbjrhyr**

---

Step 1 — Open the URL configuration page

1. Navigate to: https://supabase.com/dashboard/project/ujfgtkebslesepbjrhyr/auth/url-configuration
2. Take a screenshot of the page as-is so we have the before-state.
3. Confirm you can see two sections: **Site URL** and **Redirect URLs**.

---

Step 2 — Verify Site URL (do not change)

1. Confirm **Site URL** is set to:  `https://sneakersterminal.com`
2. If it's anything else, stop and tell me — don't change it on your own.

---

Step 3 — Add localhost entries to Redirect URLs

The **Redirect URLs** field is a list (one URL per line in some Supabase versions, or a chip/tag input in newer versions — adapt accordingly).

1. Look at the current entries. Note which of these are already present:
   - `https://sneakersterminal.com/auth/callback`
   - `https://*.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`

2. **Add any of the following that are missing**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`

   (The `**` wildcard catches any path + query string, since Supabase's matcher is sometimes strict about `?next=/admin`-style suffixes.)

3. Do NOT remove any existing entries — just add the missing ones.

---

Step 4 — Save + screenshot

1. Click **Save** at the bottom of the section.
2. Wait for the save confirmation toast.
3. Refresh the page to verify the entries persisted.
4. Take a screenshot of the saved state showing both new localhost entries.

---

Step 5 — Quick sanity check (optional, requires a second tab)

1. Open a new tab to `http://localhost:3000/login` (only if the user is running the local dev server — they'll let you know).
2. Type `jacksonfitzgerald25@gmail.com` into the email field.
3. Click **SIGN IN →**.
4. Confirm the page shows **"Magic link sent."** inline.
5. Open Gmail in another tab, find the newest "Sneakers Terminal sign-in link" email (subject starts with "> Your Sneakers Terminal sign-in link" if the branded template was applied, otherwise it's the default Supabase subject).
6. **Hover** over the SIGN IN button in the email — confirm the URL the link points to starts with `http://localhost:3000/auth/callback`. If it still says `https://sneakersterminal.com/auth/callback`, the redirect entry didn't take — re-check Step 3.
7. Screenshot the email + the hovered URL so we can verify.

---

Step 6 — Report

Summarize:
- Before-state of the Redirect URLs list (what was there)
- Which entries you added
- After-state screenshot
- (If Step 5 was run) which URL the magic-link email pointed to

Don't click the magic link — the user will do that themselves to complete the auth flow.
