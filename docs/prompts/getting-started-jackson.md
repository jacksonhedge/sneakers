# Chrome prompt — first-time getting-started tour for jackson@hedgepayments.com

This is the **founder's own first walkthrough** of the production dashboard at `https://sneakersterminal.com`. The account is already provisioned (auth user from 2026-04-21, invite code burned by ops, full access granted). Goal: sign in, kick the tires on every major surface, set up one real alert, try O'Toole chat, change the temp password, and return a punch list of what's polished vs. rough.

This is NOT a smoke-test — it's the founder using the product like a user. Lean qualitative: how does it FEEL, where is it confusing, what would you change.

---

**Required inputs from the user before you start** — ask in chat first if missing:

- `password` — the temp password ops set (`nSQ2MtJCE3PP` — but DON'T hardcode that here; the user pastes it). If they've already changed it, use the new one.

If missing, STOP and ask.

---

## Step 1 — Sign in (incognito, fresh window)

1. Open `https://sneakersterminal.com/login` in incognito (no cached state).
2. Email: `jackson@hedgepayments.com` · Password: from inputs.
3. Click `SIGN IN →`. Should land on `/dashboard`.

If it 500s or redirects unexpectedly, screenshot + STOP. (Dashboard was fixed earlier today — this should not happen, but flag it loudly if it does.)

## Step 2 — Top-level dashboard sweep (`/dashboard`)

Spend ~2 minutes here. Don't click into anything yet — just look.

Note for each:

- **Topbar** — does the email render? Snapshot date? Market count?
- **Sidebar** — what nav links are present? Position number? Referral count? Does anything look broken (missing icons, weird counters)?
- **OToole spotlight card** — does it render the 3 pillars (Configure / Teach / Execute)? Are the CTA buttons obviously clickable?
- **Wallet status card** — what does it say? (We don't have a wallet yet — Phase 1B.)
- **Category cards** (Sports / Politics / Crypto / etc.) — counts plausible? Avg-prob numbers reasonable?
- **Biggest Volume** — 6 markets shown? Sparklines visible on each row? Volume numbers formatted readable ($1.2K vs raw 1234)?
- **Arbitrage panel** — any candidates listed? If empty, what does the empty state look like?
- **Performance chart** — does it render at all? What's it showing?
- **Big Movers** — rows with sparklines? Delta visible?
- **Upcoming Resolutions** — any markets listed?
- **My Positions** — empty (we have no positions yet) — what does the empty state say?
- **Right sidebar O'Toole chat** — input box visible? Welcome message?

Flag anything that looks broken, blank, or "I don't know what this is supposed to be."

Capture **one full-page screenshot** of `/dashboard` for the record.

## Step 3 — Try O'Toole chat (right sidebar)

1. Type a real question: `"What's the highest-volume market on Polymarket right now?"`
2. Submit. Wait for response.
3. Note: did it answer with a real market? Did it use tools? Did it stream? How fast?
4. Follow-up: `"Make me an alert for any Kalshi NBA market that drops below 0.30."`
5. Note: does O'Toole offer to create the alert? Does it actually create one? Or does it punt to "go to /dashboard/alerts"?

Capture O'Toole's responses verbatim in the report.

## Step 4 — Manual alert creation (`/dashboard/alerts/new`)

1. Click the alerts link in the sidebar (or navigate to `/dashboard/alerts`).
2. Click "New alert" or equivalent.
3. Try to set up a real alert:
   - Market: any liquid market (e.g., a Polymarket presidential market or NFL futures)
   - Trigger: price crosses a specific threshold (e.g., yes_ask < 0.40)
   - Channel: email
4. Save.
5. Confirm it appears in `/dashboard/alerts` with the right details.

Note: how many clicks? Is it intuitive? What was confusing?

## Step 5 — Markets browser (`/dashboard/markets` or `/markets`)

1. Visit `/dashboard/markets` (gated) and `/markets` (public).
2. Click into 2–3 individual markets. Confirm:
   - Robinhood-style chart loads
   - Timeframe pills (1H / 1D / 1W / etc.) work without a server roundtrip
   - "Trade on" venue links go somewhere reasonable (or are obviously stubbed)
   - YES/NO prices match what's on the source platform (spot-check one Polymarket market against polymarket.com)

## Step 6 — Profile (`/dashboard/profile`) + change the temp password

1. Visit `/dashboard/profile`.
2. Confirm you can see: email, referral code, queue position (or "you're in"), tier badge.
3. Find the change-password UI (or the "request magic link" path if no inline change-password exists).
4. Change the password from the temp `nSQ2MtJCE3PP` to something memorable.
5. Confirm the change worked by signing out + signing back in with the new password.

If there's NO inline change-password UI, that's a finding — flag it.

## Step 7 — Other surfaces (quick visit only — 30s each)

Visit each, screenshot, note any obvious breakage:

- `/dashboard/minute` — sub-hour Minute Markets
- `/dashboard/leaderboard` — does it render? populated with real names?
- `/dashboard/connections` — affiliate-link surfaces
- `/dashboard/billing` — pricing/upgrade UI
- `/dashboard/settings` — settings hub
- `/dashboard/settings/otoole` — O'Toole config (model picker, voice, scope)

## Step 8 — Final report

Return as:

```
## First impressions (1-3 sentences)
What does it feel like to use? What's the most surprising / confusing / exciting part?

## Surfaces visited
For each: rendered? broken? notable?
- /dashboard
- /dashboard/alerts
- /dashboard/markets
- /dashboard/profile
- /dashboard/minute
- /dashboard/leaderboard
- /dashboard/connections
- /dashboard/billing
- /dashboard/settings/otoole
- O'Toole right-sidebar chat

## What worked well
(things that delighted)

## What's rough
(things that confused or annoyed — be specific, name the surface)

## Bugs or visible breakage
(empty data, layout glitches, broken links, 404s, console errors)

## Password change
- Inline change-password UI exists: yes / no
- Successfully changed: yes / no
- Sign-in with new password: yes / no

## Top 5 next-thing-to-fix
Ranked, ruthless. What would you change tomorrow morning?
```

---

## Boundaries

- DO NOT submit /signup again on this email — it 409s every time (account already exists).
- DO NOT click external venue links (Polymarket, Kalshi, etc.) — out of scope, and they'll burn the agent's session.
- DO NOT post in O'Toole chat anything that mentions credentials or the temp password.
- Redact passwords from any screenshots.
- Render times can vary — first dashboard load may be slow (~15-20s) due to a known DB-scan cost; flag if any single page takes >30s, otherwise treat as expected.
- This is a first-pass tour, NOT a comprehensive QA. ~20-30 minutes total. Don't dive deep into any one thing — keep moving.
