# Quick check — did the POSTGRES_URL save go through on Vercel?

You're already on tab 690949228 (Vercel sneakers-terminal Environment Variables). I just clicked Save in the POSTGRES_URL edit dialog but the UI confirmation was ambiguous.

Do this:

1. Hard-refresh the env-var page (Cmd+Shift+R).
2. Locate the POSTGRES_URL row again.
3. Report:
   - **"Updated" / "Last edited" timestamp** on the row — should be within the last few minutes
   - **Scope** — should still read Production + Preview (NOT narrowed to Production-only, NOT expanded to Development)
   - **Sensitive flag** — should still be marked Sensitive
   - **Host prefix indicator** — Vercel sometimes shows the first few chars of even Sensitive values in the row, or in a hover tooltip; if visible, confirm it now starts with `shortline` (the new value) and NOT `base` (the old value). If neither is visible, just say "host prefix not exposed in UI."
4. If there's any banner saying "Unsaved changes" or "Pending" anywhere on the page, quote it verbatim.

Don't open the edit dialog or otherwise modify anything. Read-only check.

Report:

```
- Updated timestamp: <…>
- Scope: <…>
- Sensitive: <y/n>
- Host prefix visible: <shortline / base / not visible>
- Unsaved/Pending banners: <verbatim or NONE>
- VERDICT: SAVED / NOT SAVED / UNCLEAR
```
