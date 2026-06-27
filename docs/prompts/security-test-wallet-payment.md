# Sneakers Terminal — wallet / payment security test

You're a security QA tester. Sign in, open DevTools → Console, and run six probes against the API. Each probe has an **expected result** — call out any deviation as a finding. Don't try to access another user's data; the test is about whether the server enforces the rules it claims to.

Site: https://sneakersterminal.com

## Sign in first

1. Go to `/login`. Use the credentials the user provides (or stop and ask).
2. Land on `/dashboard`. Hard refresh (Cmd+Shift+R).
3. Open **DevTools → Console** (Cmd+Opt+J).

For each probe, paste the snippet, hit Enter, capture the response status + JSON body. Report verbatim.

## Probe 1 — Cross-user draft execution

Try to confirm a draft you don't own. Should 4xx with "draft does not belong to this user" or "not found".

```js
fetch('/api/otoole/execute-trade', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ draftId: '00000000-0000-0000-0000-000000000000' })
}).then(async r => ({ status: r.status, body: await r.json() }))
```

**Expected:** status 4xx, `ok: false`. Anything that 200's or returns "executed" is a critical finding.

## Probe 2 — Cap bypass (per-trade)

Try to set the per-trade cap to $999,999. Migration says max is $5,000.

```js
fetch('/api/otoole/autotrade-settings', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ perTradeCapUsd: 999999 })
}).then(async r => ({ status: r.status, body: await r.json() }))
```

**Expected:** status 400, error mentions the cap. If it 200's, the server-side validation is missing.

Repeat for `dailyCapUsd: 999999` — same expectation (max $25K).

## Probe 3 — Avatar URL injection

Try to point your avatar at an off-domain URL. The endpoint should reject anything not on Supabase Storage.

```js
fetch('/api/profile/avatar', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://evil.example.com/pwn.png' })
}).then(async r => ({ status: r.status, body: await r.json() }))
```

**Expected:** status 400, error like "URL must point at the avatars bucket".

Also try `javascript:alert(1)` and `data:image/png;base64,xxx` — both should reject.

## Probe 4 — Locked-model bypass

The model picker visually locks Sonnet/Opus to free users, but the server should also enforce it.

```js
fetch('/api/otoole/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'hi' }],
    model: 'claude-opus-4-7'
  })
}).then(async r => ({ status: r.status, body: await r.json() }))
```

**Expected:** status 403 with message about tier upgrade. (If your test account is on Elite or higher, you'll get a real reply — that's fine, just note the tier.)

## Probe 5 — Credential read-back

Any endpoint that touches Polymarket creds should return ONLY balances + metadata, never the secret.

```js
fetch('/api/autotrade/balance').then(async r => ({ status: r.status, body: await r.json() }))
fetch('/api/autotrade/credentials').then(async r => ({ status: r.status, body: await r.json() }))
```

**Expected:** body contains `usdcCents` (or 404 if no creds saved). Body must NOT contain any of: `private_key`, `apiKey`, `apiSecret`, `passphrase`, `privateKey`, `funderAddress` (the funderAddress is OK as metadata; the others are NOT).

## Probe 6 — Kill switch enforced on confirm

Toggle autotrade OFF via the chip, then try to confirm any pending draft (if you have one — if not, skip this probe).

```js
// step 1: kill switch ON
fetch('/api/otoole/kill-switch', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ active: true, reason: 'security test' })
}).then(async r => ({ status: r.status, body: await r.json() }))

// step 2: list pending drafts
fetch('/api/otoole/pending-drafts').then(async r => r.json())

// step 3: try to confirm one (paste a real draftId from step 2)
fetch('/api/otoole/execute-trade', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ draftId: 'PASTE_DRAFT_ID_HERE' })
}).then(async r => ({ status: r.status, body: await r.json() }))

// step 4: re-enable
fetch('/api/otoole/kill-switch', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ active: false })
}).then(async r => r.json())
```

**Expected:** step 3 returns `ok: false`, `verdicts[0].gate === 'kill_switch'`, `pass: false`. The trade must NOT execute.

## Report format

```markdown
## Probe 1 — cross-user draft
- Status: <code>
- Body: <verbatim>
- Verdict: PASS / FAIL

## Probe 2 — cap bypass
- per-trade 999999: status / verdict
- daily 999999: status / verdict

## Probe 3 — avatar URL injection
- evil.example.com: status / verdict
- javascript:: status / verdict
- data:: status / verdict

## Probe 4 — locked-model bypass
- Tier of test account (note from /api/me or profile page): <free/pro/elite>
- claude-opus-4-7 status: <code>
- Verdict: PASS / FAIL

## Probe 5 — credential read-back
- /balance body: <verbatim>
- /credentials body: <verbatim>
- Any of {privateKey, apiKey, apiSecret, passphrase} present? yes/no
- Verdict: PASS / FAIL

## Probe 6 — kill switch
- Step 1 (ON): <code>
- Step 3 (confirm): <code> + verdicts
- Verdict: PASS / FAIL / SKIPPED (no pending drafts)

## Critical findings
- <anything that FAILED, with a one-line explanation>
```

Under 400 words. If any probe 500s instead of returning JSON, that's also a finding (server crash on bad input).
