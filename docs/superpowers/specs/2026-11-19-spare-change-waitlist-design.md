# Spare Change Millionaire waitlist on sneakersterminal.com (design, draft for approval)

**Date:** 2026-11-19. **Asked for by Jackson:** a waitlist on the Sneakers site that shows the "Spare Change Millionaire" newsletter is coming, and doubles as the "tell me when Sneakers is ready" list.

## What exists

- The landing site is this repo (`apps/platform`, branch `landing-sneakers-p2p`). Sign up on the homepage opens `/launching-soon`.
- `/launching-soon` posts an email to `POST /api/sneakers-waitlist`, which adds a row to the shared Supabase `waitlist` table with `source = 'sneakers-p2p-landing'`, a referral code and an optional `referred_by_code`. One row per email.
- After joining, the person gets their own link, their place in line and a count of friends who joined.
- Nothing about the newsletter exists on the site. The newsletter itself is designed (beehiiv, daily, four long-shot parlays, 21+).

## Intent

One form, two lists. Someone who signs up for the newsletter is also on the Sneakers waitlist, with no second step. Someone who only wants Sneakers is not put on the newsletter.

## Goals

- A page for the newsletter on the Sneakers site with one signup form.
- Every newsletter signup also lands on the Sneakers waitlist, with the same referral link and place in line as today.
- A record of who asked for the newsletter, their state, and that they confirmed 21+, ready to import into beehiiv.

## Non-goals

- Sending any email. No confirmation email, no beehiiv sync, no first issue.
- Paying anyone. No Venmo payouts, no Sneakers rewards.
- Changing the Sneakers app, its API, or anything the iPhone calls.

## Anti-goals

- Putting an under-21 on the newsletter list.
- Adding existing Sneakers waitlist people to the newsletter without them asking.
- Promising the $1 a day on the page before the owner signs off on the wording.

## How it works

1. **New page `/spare-change`.** Headline, one example ticket ("$1.00 → $1,800"), one line on what the email is, the form, the Sneakers line ("You're also first in line for Sneakers").
2. **Form fields:** email, state, and a required "I'm 21 or older" checkbox.
3. **New route `POST /api/spare-change-waitlist`:**
   - validates email, state (two-letter US code) and the 21+ box;
   - adds the person to the Sneakers waitlist through the existing `addToSneakersWaitlist` (already on it is fine);
   - upserts a row in a new table `newsletter_waitlist` (`email` unique, `state`, `confirmed_21_at`, `source = 'spare-change'`, `referred_by_code`, `created_at`);
   - returns the same referral link and standing as the Sneakers waitlist when the person is new to it.
4. **New table, not new columns on `waitlist`.** `waitlist` is one row per email and is shared with other products; a separate table keeps the newsletter's age and state data apart and lets someone already on the Sneakers list opt in.
5. **`/launching-soon` gets an optional checkbox** ("Also send me Spare Change Millionaire, our daily long-shot parlay email. 21+ only") that reveals the state field and the 21+ box. Unchecked, the page behaves exactly as today.
6. **Homepage:** one band that names the newsletter and links to `/spare-change`, behind a flag (`NEXT_PUBLIC_SPARE_CHANGE=on`), off by default.

## Slices

1. Table migration + `spare-change-waitlist` lib and route, with tests (validation, already-on-Sneakers-list, under-21 refused, duplicate).
2. `/spare-change` page and form.
3. Checkbox on `/launching-soon`.
4. Homepage band behind the flag.

## Open decisions (recommended default in bold)

1. **Is the page linked from the homepage while the iPhone app is in App Review?** **No: build it, keep it unlinked and `noindex` until Apple answers, then switch the flag on.** Apple reviews the app's marketing site, the app was rejected under 5.6 once, and it is described to Apple as play money with no wagering.
2. **Collect the Venmo handle on the waitlist?** **No: ask for it when the newsletter actually starts.** Fewer fields means more signups, and it is one less piece of personal data to hold.
3. **Someone unchecks 21+?** **They join the Sneakers waitlist only**, and the page says the newsletter is 21+.
4. **Words on the page.** **"Long-shot parlays", "buy-in" and "payout".** Not "bet", "sportsbook", "winnings" or "cash", to stay inside the wording the rest of the Sneakers site keeps.
5. **Does the page promise the $1 a day?** **Not yet: it says "rewards for subscribers at launch".** A dollar figure is a commitment to real people.
6. **States.** **Take any state on the waitlist**, and decide who gets which tickets at send time, because the list of legal states per site keeps changing.

## Checks before it is called done

- Tests for the lib and route pass; typecheck and lint pass.
- Looked at in a browser at 390px and desktop width.
- The existing `/launching-soon` flow still works unchanged with the box unchecked.
- The migration is written but **not applied**; applying it to Supabase and deploying are the owner's call.

## Change, 2026-11-19 (evening)

The owner changed the signup requirements after the first build. Where this section and the text above disagree, this section wins.

- **Fields are now Name, Email, State, Age.** The "I'm 21 or older" checkbox is gone from `/spare-change` and from the optional newsletter section on `/launching-soon`.
  - Name: required for the newsletter, trimmed, 1 to 80 characters, stored as typed.
  - Age: a whole number the person types (numeric keypad on phones). Anything that is not a whole number from 13 to 120 is refused as a typing mistake (`invalid_age`).
  - State: still required, same two-letter list with DC.
- **The newsletter is 18+, not 21+.** Someone who types 13 to 17 is not added to the newsletter list; they join the Sneakers waitlist exactly as the old "box not ticked" path did, their name, age and state are not stored, and the page says the newsletter is 18+ only. Page copy that said 21+ now says 18+.
- **Route.** `POST /api/spare-change-waitlist` takes `name`, `email`, `state`, `age`, `ref`. It answers `newsletter: true | false`, with `reason: "under_18"` when false. Error codes: `invalid_email`, `invalid_age`, `invalid_name`, `invalid_state`, plus `too_many` and `server_error` as before.
- **Table.** Migration 048 had not been applied anywhere, so it was edited in place: `confirmed_21_at` is replaced by `name text not null` and `age_at_signup smallint not null check (age_at_signup >= 18 and age_at_signup <= 120)`. Everything else is unchanged. It is still **not applied**.
- **Referral cap of 5.** Each person is credited for at most 5 friends who join with their link (`creditedReferrals(n) = min(max(n, 0), 5)`, `MAX_CREDITED_REFERRALS = 5`). After a newsletter signup the page shows "N of 5 friends joined. Up to 5 friends count." The place-in-line text is unchanged, and someone who joins the Sneakers waitlist without the newsletter sees the same uncapped count as before.
- **Reward amounts are still undecided.** No page states an amount or says what a referral earns. The line stays "rewards for subscribers at launch".

Known gaps left for a later decision:

- The number shown is the person's Sneakers waitlist count (friends who joined the waitlist with their link), capped at 5. It does not yet check that each of those friends also joined the newsletter. `newsletter_waitlist.referred_by_code` holds what is needed to count that exactly once rewards are defined.
- Age is what the person typed. Nothing verifies it.

## Change, 2026-11-19 (night): saved screen, welcome email, free-dollar claim

The owner asked for a proper confirmation screen, a welcome email with a "Claim your free dollar" button, and a page where the person gives a Venmo username. Where this section and the text above disagree, this section wins. In particular: an email is now sent (the "Sending any email" non-goal is gone for the welcome email only), a Venmo username is now collected (open decision 2 is reversed, but it is asked for after signup, not on the form), and one dollar is now promised (open decision 5: the one welcome dollar and nothing else; the page still says "rewards for subscribers at launch" and names no other amount).

### What a person sees

1. **Signup form** (`/spare-change`, and `/launching-soon` with the newsletter box ticked). Each gap is named under its own field, all at once, and the cursor moves to the first one. The button shows a spinner and cannot be sent twice. Enter submits.
2. **Saved screen** replaces the form: a check mark and "You're in, Sam." (first name only when it is plainly a name), "We saved your spot. Check your email: there's a link to claim your free dollar.", three steps (open the welcome email; tap "Claim your free dollar" and add your Venmo username; we send your dollar on Friday), then the share block as before. It takes focus and is a `role="status"` region. It is identical for a first signup and a repeat one.
   - If no welcome email went out, the second sentence is "Your welcome email is on its way shortly." The screen never says to check for an email that was not sent.
3. **Welcome email**, from "The Hedge Team", subject "🪙 You're in. Claim your free dollar": a lime band naming Spare Change Millionaire, a greeting, what the email is, one button, the same link as text, "The link is yours alone, so don't forward it.", signed "The Hedge Team". Footer: 18+ only; why they got it; "Reply STOP to this email and we'll remove you."; "Spare Change Millionaire is a Hedge, Inc. product."; and "Hedge, Inc., <address>" (just "Hedge, Inc." until `SPARE_CHANGE_POSTAL_ADDRESS` is set). HTML and plain text.
4. **Claim page** `/spare-change/claim?t=<token>` (noindex, no referrer):
   - good link, not claimed: "Claim your free dollar", one field (Venmo username, `@` shown in front), "We'll send $1 to this Venmo on Friday. Double-check the spelling.", Save;
   - already claimed: "You're all set." with the username masked (`@sa•••ld`) and "Wrong username? Reply to your welcome email." No editing;
   - missing, malformed or unknown link: "That link doesn't work. Open the newest welcome email and tap the button again.";
   - round full: "All the free dollars for this round have been claimed. You're still on the list.";
   - after saving: "Saved. Your dollar goes to @username on Friday." and the person's share block (or a link back when their waitlist code cannot be found).

Under 18 is unchanged: Sneakers waitlist only, no welcome email, no claim link, no dollar. `/launching-soon` with the box unticked is unchanged.

### How it works

- **Token.** Every newsletter row gets `claim_token`: 24 random bytes (192 bits) from the platform's cryptographic generator, 32 URL-safe characters, unique. An email already on the list keeps its first token. The link is built from `NEXT_PUBLIC_SITE_URL`; without it, from the request's own host only when that is `sneakersterminal.com`, a subdomain of it, or local; otherwise `https://sneakersterminal.com`. A request's Host header is never trusted blindly, because the link is a secret.
- **Welcome email, at most once per 24 hours per address.** After both list writes succeed, the route reads the row. If `welcome_sent_at` is inside the last 24 hours nothing is sent. Otherwise it takes the slot first (`welcome_sent_at` is swapped from its old value to now in one conditional update, so two signups at once cannot both send), sends through the existing Resend helper, and puts the old value back if the send fails. With no `RESEND_API_KEY` nothing is reserved or sent and `welcome_sent_at` stays empty. The signup succeeds either way.
- **The route's answer** gains `welcome: "sent" | "pending"` for a newsletter signup. "sent" means a welcome email went to that address now or within the last 24 hours, so a repeat signup gets the same answer as the first and the screen does not reveal whether the address was already listed. (The existing rule stands: an address already on the Sneakers waitlist gets no code back.)
- **`GET /api/spare-change-claim?t=`** tells the page what to show. Known and unknown tokens do the same two reads (the row and the claim count, side by side); the one extra write for a known token (`email_confirmed_at`, the first time only) runs after the response. A malformed token is answered without touching the database. Opening the link is what counts as confirming the email address.
- **`POST /api/spare-change-claim` `{ t, venmo }`.** The username is trimmed, a leading `@` or a pasted venmo.com link is dropped, and it must be 5 to 30 letters, digits, hyphens or underscores. Display case is kept in `venmo_handle`; the lower-cased form goes in `venmo_handle_key`. One conditional update sets `venmo_handle`, `venmo_handle_key` and `claimed_at` where the token matches and `claimed_at is null`.
- **Table** (migration 048, edited in place, still not applied): `claim_token text not null unique`, `welcome_sent_at`, `email_confirmed_at`, `claimed_at`, `venmo_handle`, `venmo_handle_key text unique`, `paid_at`; checks that the username, its key and `claimed_at` are all set or all empty, that the key is the lower-cased username, and that only a claim can be paid. RLS on, no policies.

### Abuse controls

- **The email link is required.** The claim page works only with the token, and the token is only ever sent to the address that signed up. A made-up address cannot claim.
- **One claim per link.** The conditional update (`claimed_at is null`) lets exactly one write through. A double tap or a second tab gets "You're all set" with what the first one saved.
- **One dollar per Venmo username.** `venmo_handle_key` is unique. A second person using the same username is told "That Venmo username has already been used for a free dollar." Nothing says whose it was.
- **A cap on the round.** `SPARE_CHANGE_CLAIM_CAP` (default 100; 0 closes the round). The route counts claimed rows and refuses at the cap, storing nothing. It is "count, then write", so claims that arrive in the same instant as the last dollar can each get through: the overshoot is at most the number of claims in flight at that moment, and each of those still needs its own emailed link and its own unused username. If an exact cap ever matters, move the count and the update into one database function under an advisory lock.
- **Rate limits.** Per address, per minute, per server: 5 saves and 10 link checks on the claim route; the signup route keeps its 5. Cross-site posts are refused by the existing proxy check.
- **Nothing leaks.** Unknown, malformed and missing tokens get one identical answer. A claimed username is only ever shown masked. Tokens, emails and usernames are not logged.
- **Name in the email.** Only the first word of the name is used, and only when it is letters, apostrophes, hyphens or dots; otherwise the email says "Hi there,". So the form cannot be used to mail someone a link or a message.

What these do not stop: one person with several real email addresses and several Venmo accounts. The cap bounds the cost of that at the size of the round.

### Still manual

- **Paying.** Nobody is paid automatically. Each Friday the owner runs the two queries in `docs/launch/spare-change-friday-payouts.md`: list unpaid claims, pay each $1 on Venmo with the note "Spare Change welcome reward", mark the batch paid.
- **Unsubscribes.** The email says "Reply STOP". Removing the row is done by hand (the runbook has the query). There is no unsubscribe link yet; one is needed before the daily newsletter itself is sent.
- **Wrong usernames.** The person replies to the welcome email; the owner clears the claim by hand so the same link works again.
- **Unsent welcome emails.** If the send fails or no key is set, nothing retries. The runbook has a query for rows with no welcome email; signing up again also sends it.
- **Replies need an inbox.** Both "Reply STOP" and "Reply to your welcome email" assume the From address is read by a person. Set `SPARE_CHANGE_REPLY_TO` when it is not (the fallback sender `onboarding@resend.dev` cannot receive mail).
- **Postal address.** `SPARE_CHANGE_POSTAL_ADDRESS` is not set and none was invented. A street address in the footer is required before sending at scale.

### Checks made

- Tests written first for: Venmo parsing, validation and masking; token shape; claim decisions (open, claimed, unknown, cap reached, duplicate username, double tap) against injected store functions; the email builders (subject, claim link and 18+ line in both bodies, no avoided words, no script); the 24-hour rule and the reserve-then-send order; the saved screen's two wordings; the per-field form checks.
- Looked at in headless Chrome at 390px and 1280px with the database-backed routes stubbed. The welcome email was rendered to an image at 600px.
- Not checked against a real database or a real inbox: the migration has not been applied and no email was sent.
