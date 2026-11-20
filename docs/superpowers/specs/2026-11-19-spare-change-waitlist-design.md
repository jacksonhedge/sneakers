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
