# Spare Change Millionaire: Friday payouts

Everything a member is owed is a row in the ledger, `public.sc_rewards` (migration 049): the welcome dollar (`kind = 'welcome'`, added when they save a Venmo username on the claim page), each day's reward (`kind = 'daily'`, added when a slip is verified), and any correction made by hand (`kind = 'adjustment'`). A row is owed while `paid_at` is empty.

Nothing pays anyone automatically. Every Friday someone pays on Venmo by hand, then marks the rows paid. The site only keeps the record: it never moves money.

Run the SQL in the Supabase SQL editor. (`newsletter_waitlist.paid_at` from the first version of this runbook is no longer used; the migration carried any value over into the ledger.)

## Each Friday

1. **Pick a cutoff and a batch label**, and use the same ones in every query below, so a reward that arrives while you are paying waits for next week. The examples use Friday noon Eastern and the label `2026-11-27`; change both.

2. **See who is owed.** One row per member: only people who have given a Venmo username and have not been removed.

   ```sql
   select name, venmo_handle, state, age_at_signup as age,
          unpaid_count, unpaid_cents / 100.0 as dollars, oldest_earned_at
   from public.sc_payouts_due
   order by oldest_earned_at;
   ```

   The view counts everything unpaid. For exactly what this batch will cover (up to the cutoff), per member:

   ```sql
   select m.name, m.venmo_handle,
          count(*) as rewards,
          sum(r.amount_cents) / 100.0 as dollars,
          string_agg(r.kind || coalesce(' ' || r.issue_date, ''), ', ' order by r.earned_at) as what
   from public.sc_rewards r
   join public.newsletter_waitlist m on m.id = r.member_id
   where r.paid_at is null
     and m.venmo_handle is not null
     and m.status <> 'removed'
     and r.earned_at <= timestamptz '2026-11-27 12:00 America/New_York'
   group by m.id, m.name, m.venmo_handle
   order by min(r.earned_at);
   ```

3. **Pay each person their total on Venmo**, to the `venmo_handle` shown, with the note **Spare Change reward**. Check the name on the Venmo profile looks like the `name` in the row before you send. If a username does not exist on Venmo, skip it and write it down.

4. **Mark the batch paid.** Same cutoff, your batch label. Put any usernames you could not pay in the `not in` list (lower-case), or leave it as `('')` if you paid them all. `paid_to` records the username the money went to, as it was at that moment.

   ```sql
   update public.sc_rewards r
   set paid_at = now(),
       pay_batch = '2026-11-27',
       paid_to = m.venmo_handle
   from public.newsletter_waitlist m
   where m.id = r.member_id
     and r.paid_at is null
     and m.venmo_handle is not null
     and m.status <> 'removed'
     and r.earned_at <= timestamptz '2026-11-27 12:00 America/New_York'
     and m.venmo_handle_key not in ('')
   returning m.name, r.paid_to, r.kind, r.issue_date, r.amount_cents;
   ```

   The rows it returns should add up to exactly what you sent. Check with:

   ```sql
   select paid_to, count(*) as rewards, sum(amount_cents) / 100.0 as dollars
   from public.sc_rewards
   where pay_batch = '2026-11-27'
   group by paid_to
   order by paid_to;
   ```

   If something is off, put a row back on the list by clearing all three fields together: `update public.sc_rewards set paid_at = null, pay_batch = null, paid_to = null where id = '...';`

### The same thing through the site

Signed in as an admin (an email in `ADMIN_EMAILS`), `GET /api/spare-change/admin/payouts` returns the same due list plus the unpaid ledger rows with their ids, and `POST /api/spare-change/admin/payouts` with `{ "reward_ids": [...], "batch": "2026-11-27" }` marks those rows paid. It refuses a row that is already paid or whose member has no Venmo username, and says which. There is no page for this yet; the SQL above is the way to do it today.

## Things that come up

- **A welcome dollar is missing from the ledger.** The claim page adds the ledger row right after it saves the username; if that second write failed, the claim is there and the row is not. This adds any that are missing and is safe to run at any time (each member can only ever have one):

  ```sql
  insert into public.sc_rewards (member_id, kind, amount_cents, note, earned_at)
  select m.id, 'welcome', 100, 'Welcome dollar', m.claimed_at
  from public.newsletter_waitlist m
  where m.claimed_at is not null
  on conflict do nothing;
  ```

- **"Wrong username."** The claim page tells people to reply to their welcome email. Clear their claim and they can reopen the same link and type it again. Their welcome dollar stays in the ledger (one per member, whatever happens to the claim), and an unpaid reward is paid to whatever username is on the row when you pay.

  ```sql
  update public.newsletter_waitlist
  set venmo_handle = null, venmo_handle_key = null, claimed_at = null
  where email = 'person@example.com';
  ```

- **"Reply STOP."** Removal is by hand. Mark the member removed; do not delete the row (a member with rewards in the ledger cannot be deleted, and the record of what was paid has to stay). A removed member drops off the due list, earns nothing and their tracked links stop working.

  ```sql
  update public.newsletter_waitlist
  set status = 'removed', unsubscribed_at = now()
  where email = 'person@example.com';
  ```

  To pause someone without removing them (they keep getting the email but earn nothing), use `status = 'paused'`.

- **A correction.** Add an adjustment row, positive or negative, with a note saying why. It is paid (or netted off) with the member's next batch.

  ```sql
  insert into public.sc_rewards (member_id, kind, amount_cents, note)
  select id, 'adjustment', -100, 'Daily reward for 2026-11-24 granted by mistake'
  from public.newsletter_waitlist where email = 'person@example.com';
  ```

- **A tester on a different amount, or a different number of days.** These are on the member row and apply from the next verified slip: `daily_reward_cents` (0 to 1000), `reward_days` (0 to 365), `tester`.

  ```sql
  update public.newsletter_waitlist
  set tester = true, daily_reward_cents = 500
  where email = 'person@example.com';
  ```

- **How many welcome dollars are gone.** The round stops taking claims at `SPARE_CHANGE_CLAIM_CAP` (default 100).

  ```sql
  select count(*) filter (where claimed_at is not null) as claimed,
         count(*) as subscribers
  from public.newsletter_waitlist;

  select kind, count(*) as rewards,
         sum(amount_cents) / 100.0 as dollars,
         sum(amount_cents) filter (where paid_at is null) / 100.0 as unpaid_dollars
  from public.sc_rewards
  group by kind;
  ```

- **What happened with a ticket** (taps, slips in, verified):

  ```sql
  select issue_date, "position", site, name, result, taps, tap_total, submitted, verified, rejected
  from public.sc_ticket_summary
  order by issue_date desc, "position";
  ```

- **People who never got a welcome email** (no email key was set, or the send failed; the page told them it was "on its way"). Nothing retries on its own. Signing up again with the same email sends it, or send to this list by hand:

  ```sql
  select name, email, created_at
  from public.newsletter_waitlist
  where welcome_sent_at is null
  order by created_at;
  ```
