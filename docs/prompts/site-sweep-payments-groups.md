# Site sweep — Sneakers Terminal — speed + UX, biased on payments & groups

Background: Sneakers Terminal positions itself as **the trading terminal for college students and groups** — embedded AI co-pilot ("O'Toole"), prediction-market terminal, and an embedded wallet that's intended to double as a consumer spend product. The sweep is to get an honest, user-eye read of the live site **right now**, with two emphases:

1. **Speed of function** — does every surface load fast and feel responsive, or does it stall / jank / dead-end?
2. **"What would a user actually want to do here?"** — for a college student or a fraternity/sorority leader, do the obvious actions surface obviously, or are they buried / missing / broken?

**Audience to inhabit:** a 20-year-old college junior, member of a Greek house, who heard about this from a friend in their chapter. Smart, impatient, won't tolerate friction. Knows what Robinhood / Venmo / DraftKings feel like.

**Base URL:** `https://sneakersterminal.com` (production — not a preview).

## ⛔ HARD RULE — do NOT click any payments / billing / subscription / trial CTA

Every **"Start trial"**, **"Start 7-day trial"**, **"Subscribe"**, **"Upgrade"**, **"Pay"**, **"Buy"**, **"Manage subscription"**, **"Checkout"**, **"Add payment method"** button on this site triggers **real billing state on a live Stripe account**. Clicking even once consumes a trial slot or otherwise breaks the live setup. **Observation-only on every payments/billing/subscription/trial CTA — do not click them, do not follow them.**

Also do not navigate to URLs containing `/checkout`, `/billing`, `/subscribe`, `/upgrade`, `/trial`, `/manage-subscription`, or any Stripe-hosted domain (`checkout.stripe.com`, `billing.stripe.com`).

**What to do instead:** describe the button (verbatim text, color, position on the page), copy its `href` if you can read it from the DOM (right-click → inspect), infer what it *appears* to do from the surrounding copy — but stop short of activating it. The user verifies billing flows manually.

This is non-negotiable. **If you're not sure whether a button is a payment trigger, don't click it.** Note it in your report as "ambiguous CTA, did not click" and move on.

## Auth handling

This is a real product behind a magic-link / password gate. **Do an unauthed sweep first** (Pass 1–3 + Pass 5) — that's the experience a new visitor gets, and it's the most honest read on the site's clarity. If at the end the user signs in for you, do Pass 6 (authed surfaces). **Do not drive magic-link auth yourself** — stop and hand the tab back if auth is required.

## Pass 1 — Public surfaces, in order

For each, record: (a) load feel (instant / slow / janky), (b) what the page is *trying* to say in one sentence, (c) friction or confusion you'd flag as a 20-year-old visitor.

Navigation is fine on these pages — just **don't click any payment/trial/subscribe CTAs** you encounter (see Hard Rule).

- `/`  (landing)
- `/venues`
- `/pricing` ← **observation-only; do not click any tier button**
- `/students`
- `/college`
- `/leaderboard-demo` (if linked)
- `/horse-race-demo` (if linked)
- `/login`
- `/signup` (clicking the form's individual/group toggle is fine; do not submit a form)
- anything else linked from header / footer / inline CTAs (skip anything matching the Hard Rule patterns)

## Pass 2 — Payments lens (observation only)

Walk the site **looking at** the payment story end-to-end. **Do not click anything.** A college student wants to (a) see the price, (b) pay, (c) manage their subscription, and possibly (d) use a Sneakers-wallet balance to spend — we want to know whether the *visible UI* tells that story.

For each, report URL + verbatim text + your take, **without clicking**:

- Where is pricing actually presented? On `/pricing`? Inline on the landing? Both? Consistent numbers, or drift between surfaces?
- Is there a clearly visible **upgrade / subscribe / pay / trial** CTA? Where? Read the button's verbatim text, its position, and its `href` from the DOM. Based on the `href` + surrounding copy, what does it *appear* it would do? (**Do not click to verify.**)
- Are there any visual indicators that a payment CTA is broken (greyed-out, disabled state, "Not available" / "Coming soon" text near it)? Report observed signals only — no clicks.
- Is there any mention of a **Sneakers wallet** (the embedded spend product) anywhere on the public site? If yes, quote verbatim what it claims it does.
- Is the relationship between "trial", "subscription", and "wallet" explained anywhere? Quote it.

End Pass 2 with a one-paragraph answer to: **"From what's visible on the page (without clicking anything), what would a user understand they need to do to pay?"** Be honest about the gaps.

## Pass 3 — Groups / Greek life lens

Sneakers' stated GTM wedge is **fraternities & sororities first**, then broader campus groups. A chapter leader (the "captain") wants to (a) sign up the chapter as a group, (b) invite their members, (c) see who joined, (d) understand what their members are doing.

For each, report URL + verbatim text + your take:

- Anywhere on the site does the word **fraternity / sorority / Greek / chapter / captain / team / group / organization** appear in a user-facing way? List every occurrence with surrounding context.
- On the signup CTA dropdown, is there an **organization / group** signup option distinct from individual signup? You can open the dropdown and read the options — but don't submit any signup form.
- Try `/join/abc` (any bogus org id) — does it explain itself, error helpfully, or just 404? (Visiting the URL is fine; do not submit any form.)
- Is there a clearly visible **"start a chapter"** / **"bring this to my house"** path? Where?
- Pretend you're the chapter leader. What's missing for you to confidently say "yes I'll set this up for my 60 brothers"?

End Pass 3 with: **"If I'm a fraternity captain looking at this site, what do I do?"**

## Pass 4 — Speed

For the highest-traffic / most-likely-to-be-hit routes you visited (`/`, `/pricing`, `/login`, `/signup`, `/venues`, and the dashboard if you authed), record:

- **Time to first meaningful content** — eyeball is fine, but be honest (instant / ~1s / ~3s / slow)
- **Time to interactive** — when can you actually click something?
- **Layout shift** — does content jump after first paint? (font swap, late images, etc.)
- **Spinners / skeleton screens** — do they appear and never resolve, or resolve fast?
- **Visible console errors** in DevTools — copy any red ones verbatim with the URL they fired on.
- **Network panel** — are there any obviously huge JS bundles or slow waterfall requests on the first paint? (Top 3 by size or time.)

End Pass 4 with **the slowest 3 surfaces** ranked, with your guess at *why* (big image? client-side data fetch? blocking script?).

## Pass 5 — "What I'd want to do" gaps

Now zoom out. Pretend you're a college junior whose fraternity brother told you "this is the trading terminal that's gonna beat hedge funds." You went to the site to figure out what it is.

List **5 things you'd reasonably want to do that the site doesn't make obvious**. For each:
- The desire in plain English ("see what trades it'd make for me before I sign up", "check if my favorite sportsbook is supported", "see what other students are making", etc.)
- Where in the IA it *should* live
- Whether anything related currently exists (linked or buried)

## Pass 6 — Authed surfaces (only if signed in by the user)

Skip if you couldn't auth. If signed in, walk:

- `/dashboard` — what's the first thing you see? Does it answer "what do I do here?"
- `/dashboard/settings` (if exists), `/dashboard/settings/otoole` (the AI memory area)
- The O'Toole chat / panel — try one real question. Does it answer usefully or vaguely?
- `/dashboard/markets` — does it load with real prices?
- Any place to pay / upgrade / manage subscription — **describe what's visible, do NOT click** (Hard Rule still applies authed).
- Any place to invite a friend / your group — does the share affordance feel obvious? (Reading and previewing is fine; do not actually send invites.)

## Report back

Don't free-form. Use this exact shape:

```
## TOP 3 to fix
1. <surface + what's broken/missing + why it matters most>
2. <…>
3. <…>

## 5 quick wins
- <single-surface copy/CTA tweak with URL>
- <…>
- <…>
- <…>
- <…>

## 3 questions for the team
- <a "what is this supposed to do?" question with the URL that raised it>
- <…>
- <…>

## Payments verdict (observation-only)
- "From what's visible, what would a user understand they need to do to pay?" → <honest one-paragraph answer>
- CTAs observed but NOT clicked: <list with URL + verbatim text + href>
- Wallet/spend-product visibility: <none / mentioned where + verbatim>

## Groups verdict
- "If I'm a fraternity captain, what do I do?" → <honest one-paragraph answer>
- Greek / chapter / group vocabulary appearances: <list with URLs>
- Org signup vs individual signup: <clear / unclear / missing>

## Speed verdict
- Slowest 3: 1) <url + feel + guess>  2) <…>  3) <…>
- Console errors: <NONE | list>
- Worst layout shift: <url + what shifted>

## Overall vibe (one paragraph)
<As the 20-year-old persona — would you sign up after this visit? What would push you to share it with your house?>
```

Be specific. **URL + verbatim text + one-line take** for every finding. Vague reports get sent back. And remember: **no clicking payment/billing/subscription/trial CTAs, ever.**
