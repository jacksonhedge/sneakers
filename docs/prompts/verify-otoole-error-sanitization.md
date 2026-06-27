# Verify O'Toole error sanitization (commit 5e10322)

Background: O'Toole chat was leaking raw upstream provider errors directly into the chat as the assistant's reply — most damagingly `"Anthropic 400: 400 {...credit balance is too low to access the Anthropic API...}"`. To a 20-year-old reading their first O'Toole reply, that looks like the product is broken AND tells them the company's out of API credits. Worst possible first impression.

Fix at commit `5e10322` on branch `fix/otoole-sanitize-error-leak`: `apps/platform/src/app/api/otoole/chat/route.ts` catches the adapter error, keeps the full error in the server log, and returns a calm assistant message (stub:true) keyed off the error category — credit/quota/billing, rate limit, auth, upstream 5xx, or generic fallback.

**Base URL (preview):** `https://sneakers-terminal-9430711po-jackson-fitzgeralds-projects.vercel.app`

**Note on what triggers the failure path:** The underlying Anthropic credit balance is still depleted (that's what caused the original leak). So any real O'Toole question on this preview *should* hit the catch block — making this verify naturally reproducible right now. If credits have been topped up since, O'Toole will just answer normally and the error path isn't exercised; that's a different signal but still useful.

## ⛔ HARD RULE — observation-only on payments

Do NOT click any **trial / subscribe / upgrade / pay / manage subscription / buy** CTA anywhere on the preview. Same rule as the site-sweep prompt. See `docs/prompts/site-sweep-payments-groups.md` if you need the longer version.

## Step 0 — Sign in

Sign in on the preview at `<BASE>/login` (email + password, **not** magic link — the preview's random URL isn't in Supabase's redirect allowlist). If sign-in requires the user's password input, **stop and hand the tab back** — user signs in, then tells you continue.

Once authed, navigate to `<BASE>/dashboard`.

## Step 1 — Open O'Toole chat

Find the O'Toole chat affordance on the dashboard (chat panel, spotlight, or floating button). Open it.

Report:
- Where on `/dashboard` did you find O'Toole? (panel / spotlight / fab / other)
- Any pre-existing system/welcome message — verbatim first 80 chars.

## Step 2 — Ask a question that requires a real chat call

Send this exact prompt:

```
What is the highest-volume Kalshi market right now and what's the current yes price?
```

Wait for the response.

## Step 3 — The assertion

**Report the assistant's reply, verbatim, in full.**

Then evaluate against the fix:

- Does the reply contain the substring **"Anthropic"**? (should be NO)
- Does it contain **"400"** with curly-brace JSON / **"credit balance"** / **"insufficient_quota"** / **"request_id"**? (should be NO)
- Does it contain a friendly, brand-consistent message like **"O'Toole is temporarily unavailable"** / **"rate-limited"** / **"provider is having issues"** / **"try again"**? (should be YES — one of these)
- Is the reply rendered as a normal assistant chat bubble (same style as a working reply), or as a red error banner? (should be: normal chat bubble)

## Step 4 — Try a follow-up to confirm chat keeps working

Send: `Try again — anything you can show me?`

Report:
- Did the chat accept the follow-up (input field still works, button still active)?
- What did O'Toole reply this time (verbatim)?
- Same evaluation: any "Anthropic" / raw JSON / "credit balance" leak? (should still be NO)

## Step 5 — Sanity: the rest of the dashboard still loads

Quick eyeball pass — no clicks on any payment CTA.

- Does `/dashboard` itself render its cards (balance / markets / etc.) cleanly?
- Any new console errors in DevTools that look related to chat? (NETWORK panel: the `/api/otoole/chat` request — what status code does it return now? Should be **200** with `stub: true` in the JSON, not 500.)

## Report back

```
## Step 1. Chat open
- Affordance location: <…>
- Pre-existing message (first 80 chars): <…>

## Step 2–3. The fix
- Full assistant reply (verbatim): <…>
- Contains "Anthropic": y/n  (expect n)
- Contains raw JSON / "credit balance" / "request_id": y/n  (expect n)
- Contains friendly "temporarily unavailable" / "rate-limited" / etc.: y/n  (expect y)
- Rendered as normal chat bubble (not red error banner): y/n  (expect y)

## Step 4. Follow-up
- Chat still functional: y/n
- Second reply (verbatim): <…>
- Second reply still sanitized: y/n  (expect y)

## Step 5. Sanity
- /dashboard renders: y/n
- /api/otoole/chat status code: <…>  (expect 200)
- Console errors related to chat: <NONE | list>

## VERDICT
- Sanitization: <WORKS / PARTIAL / BROKEN>
- Leak still present anywhere: <NONE / where>
```
