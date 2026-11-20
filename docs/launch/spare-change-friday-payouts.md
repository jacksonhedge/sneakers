# Spare Change Millionaire: Friday payouts

Each new subscriber can claim one welcome dollar: they open the link in their welcome email and save a Venmo username. Nothing pays them automatically. Every Friday, someone pays the claims by hand on Venmo and then marks them paid.

Run the SQL in the Supabase SQL editor (table `public.newsletter_waitlist`). Nothing on the site reads `paid_at`; it is your record.

## Each Friday

1. **Pick a cutoff** and use the same one in both queries, so a claim that arrives while you are paying is left for next week. The examples use Friday noon Eastern; change the date.

2. **List what is owed.**

   ```sql
   select name, venmo_handle, claimed_at, state, age_at_signup as age
   from public.newsletter_waitlist
   where claimed_at is not null
     and paid_at is null
     and claimed_at <= timestamptz '2026-11-27 12:00 America/New_York'
   order by claimed_at;
   ```

3. **Pay each row $1 on Venmo**, to the `venmo_handle` shown, with the note **Spare Change welcome reward**. Check the name on the Venmo profile looks like the `name` in the row before you send. If a username does not exist on Venmo, skip it and write it down.

4. **Mark the batch paid.** Same cutoff. Put any usernames you could not pay in the `not in` list (lower-case), or leave the list as `('')` if you paid them all.

   ```sql
   update public.newsletter_waitlist
   set paid_at = now()
   where claimed_at is not null
     and paid_at is null
     and claimed_at <= timestamptz '2026-11-27 12:00 America/New_York'
     and venmo_handle_key not in ('')
   returning name, venmo_handle, paid_at;
   ```

   The rows it returns should be exactly the people you paid. If the count is off, fix it before next Friday (set `paid_at = null` on a row to put it back on the list).

## Things that come up

- **"Wrong username."** The claim page tells people to reply to their welcome email. To let someone enter it again, clear their claim, and they can reopen the same link (only while unpaid):

  ```sql
  update public.newsletter_waitlist
  set venmo_handle = null, venmo_handle_key = null, claimed_at = null
  where email = 'person@example.com' and paid_at is null;
  ```

- **"Reply STOP."** Removal is by hand. Delete the row (this also gives up an unpaid claim):

  ```sql
  delete from public.newsletter_waitlist where email = 'person@example.com';
  ```

- **How many dollars are gone.** The round stops taking claims at `SPARE_CHANGE_CLAIM_CAP` (default 100).

  ```sql
  select count(*) filter (where claimed_at is not null) as claimed,
         count(*) filter (where paid_at is not null) as paid,
         count(*) as subscribers
  from public.newsletter_waitlist;
  ```

- **People who never got a welcome email** (no email key was set, or the send failed; the page told them it was "on its way"). Nothing retries on its own. Signing up again with the same email sends it, or send to this list by hand:

  ```sql
  select name, email, created_at
  from public.newsletter_waitlist
  where welcome_sent_at is null
  order by created_at;
  ```
