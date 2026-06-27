## Quick check — admin tier debug endpoint

Sign in as jackson@hedgepayments.com. Open this URL in the browser:

```
https://sneakersterminal.com/api/admin-tier-debug
```

Paste back the full JSON response verbatim. The endpoint strips emails — only domains, lengths, and first chars come back, so it's safe to share.

Looking for:
- `signals.mismatch` — true means the two libraries disagree
- `env.parsedCount` — how many admin emails the runtime sees
- `env.entryDomains` — sorted list of domains in the env
- `signals.isAdminAuthLib` vs. `signals.isAdminOtooleUsage` — which side returns true

That's it. One paste-back.
