# Test Spare Change Millionaire end to end: subscribe, the welcome email, the Slack alert, and a referral signup

Paste everything below the line into the Chrome agent.

---

You're testing the signup flow for **Spare Change Millionaire**, Jackson's daily long-shot parlay email, on the live site, as a subscriber would. You'll make **two test signups** with Jackson's own email (Gmail "+" addresses, so both land in his inbox; the phone is a fake 555 number), then check the welcome email and the Slack alerts. Jackson is signed in to Gmail and Slack in this browser.

## Hard rules

1. **Exactly two signups**, with exactly the details below. No others, and don't resubmit if one already went through.
2. **Don't claim the dollar.** The welcome email has a "Claim your free dollar" link to a page that asks for a Venmo username. You may open that page to look at it, but **don't type a Venmo username and don't submit it**: that creates a real $1 payout.
3. Don't click the partner logo tiles or the "Open on…" / "Source" links, don't reply to or forward any email, and don't post, react or change anything in Slack.
4. Don't sign in anywhere or type a password or code. If something asks, stop and tell Jackson.

## Test details

| | Signup 1 | Signup 2 (the referral) |
|---|---|---|
| Name | `Jackson Test` | `Jamie Test` |
| Email | `jacksonfitzgerald25+sctest3@gmail.com` | `jacksonfitzgerald25+sctest4@gmail.com` |
| State | New Jersey | New Jersey |
| Birthday | `06/15/1995` | `03/10/1996` |
| Phone | `(412) 555-0123` | leave blank |
| Who referred you? | leave blank | leave blank (the link does the referring) |
| Boxes | tick all three | tick "Email me…" and "I agree to the Terms…" only |

## Steps

1. **The page.** Open https://sneakersterminal.com/waitlist. Note what you see:
   - the example ticket ($0.25 → $80,000)
   - the Terms of Service and Privacy Policy links (they open hedgepayments.com; just check they open, then close them)
   - the lime "Subscribers get a free $0.25 a day." pill
   - the white form fields, the phone box, and the three tick boxes (Email me…, I agree to the Terms…, Tell me when the Sneakers app launches)
   - the real X posts (Hard Rock Bet $96,473.44, B/R Betting $532K, and the 89-cent one with its "missed" caption)
   - the "More real long shots" cards
   - the footer with 1-800-GAMBLER

   Take a screenshot.
2. **Signup 1.** First click **Claim Free $1** with the form empty and note the red error messages (take a screenshot). Then fill in Signup 1's details, tick the boxes, and click **Claim Free $1**. Wait for the saved screen. Write down exactly what it says, and copy the **share link** it shows (it ends in `?ref=` and a code). Take a screenshot.
3. **Slack, new subscriber.** In Slack (FraternityBase workspace), open **#spare-change-subscribers**. Within about a minute there should be a new message like "New Spare Change subscriber: *Jackson T.* (NJ, 31) · N subscribers". Note the exact text and time.
4. **The welcome email.** In Gmail (jacksonfitzgerald25@gmail.com), search `to:jacksonfitzgerald25+sctest3@gmail.com`. There should be a welcome email from "The Hedge Team". Note the subject, the From line, how it looks on screen, and whether the claim link is there.
   - Open the claim link in a new tab and note what the page shows and asks for.
   - Then close it without typing anything.
   - Take screenshots of the email and the claim page.
5. **Signup 2, through the share link.** Open the share link from step 2 in a new tab. Fill in Signup 2's details, tick the two boxes, and click **Claim Free $1**. Note the saved screen.
6. **Slack, the referral.** In **#spare-change-subscribers**, the new message for Jamie should say "referred by *Jackson T.* (link)". Note the exact text.
   - Also glance at **#spare-change-referrals**. Nothing new is expected there: a referral only pays out (and posts) once the friend's first slip is verified.
7. **The second welcome email.** In Gmail, search `to:jacksonfitzgerald25+sctest4@gmail.com` and note that it arrived.

## What to send back

1. One line: did both signups, both welcome emails and both Slack messages work?
2. For each step: what you saw (exact text for the saved screens, the Slack messages and the email subject), anything that looked broken, slow, confusing or ugly, and how long the Slack message and the email took to arrive.
3. The screenshots, labeled by step.
4. Anything on the page or in the email that didn't match the details above.

Then stop. Don't claim anything, and don't delete the test signups: Jackson will remove them, and Claude Code will check the phone and the boxes were saved.
