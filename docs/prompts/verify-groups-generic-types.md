# Verify Groups generic type switcher (PR #14, commit 6465c8f)

Background: The first cut of the group preview ('/chapter-preview') locked the preview to Greek life. This PR generalizes it to four group archetypes — **Friends / Fantasy League / Finance Club / Greek Chapter** — switchable via a tab strip in the sticky banner at the top of the preview. Each preset adapts name, leader title, member noun, mock roster, invite copy, SOON-card titles + descriptions, and the bottom conversion CTA. Default type when no query param is `friends`.

Old `/chapter-preview` route is deleted. Landing tile + `/join` invalid-card copy updated to be generic.

**Base URL (preview):** `https://sneakers-terminal-5p9ixoyce-jackson-fitzgeralds-projects.vercel.app`

## ⛔ HARD RULE — no payment / billing / subscription / trial clicks

Same as the prior preview. Do NOT click any "Start your chapter / Start your group / Start your league / Start your club / Trial / Subscribe / Upgrade / Pay / Checkout" CTA past whatever opens immediately on the same page. Observation-only on those. The org-signup modal on the landing in particular is in-scope for this rule — do not progress past its first screen.

## Step 0 — No sign-in required

The preview + landing surfaces are public. If anything redirects to `/login` or `/signup` when it shouldn't, that's a finding.

## Step 1 — Old /chapter-preview is gone

Go to `<BASE>/chapter-preview`.

Report:
- HTTP status / what renders: <…>  (expect: bare Next 404 "This page could not be found" — file was deleted in this PR)

## Step 2 — Landing tile copy updated

Go to `<BASE>/`. Find the GROUPS tile.

Report:
- Verbatim tile copy (the long sentence, including the underlined link):
- Does the bolded emerald list include all four types? Expect: **friends, fantasy league, finance club, or chapter**. Verbatim text inside the emerald span: <…>
- "See the preview →" link `href`: <…>  (expect `/group-preview`)

## Step 3 — /group-preview default (no query param)

Click "See the preview →" from the landing tile (or go to `<BASE>/group-preview`).

Report:
- Landed URL (does the app silently rewrite with ?type= or stay clean?): <…>  (expect clean `/group-preview`, no auto-redirect)
- Sticky banner verbatim (the 👀 line + tab strip + START button):
- Banner left label before the tabs: <…>  (expect "YOUR GROUP IS A …")
- All four type tabs present? List them verbatim left-to-right: <…>  (expect FRIENDS · FANTASY LEAGUE · FINANCE CLUB · GREEK CHAPTER)
- Which tab is highlighted as active by default? (expect FRIENDS)
- START button on the right of the banner reads: <…>  (expect "START YOUR GROUP →" since default type is friends)

## Step 4 — Friends preset content

Still on the default `/group-preview`. Walk the page top-to-bottom and capture:

- Eyebrow above h1: <…>  (expect "STARTER · FRIENDS")
- h1: <…>  (expect "The Crew")
- Subline: <…>  (expect "Brooklyn · started Apr 2026")
- Leader line: <…>  (expect "Started by: Sam K.")
- Roster header: how many entries + the column header (expect "12 FRIENDS")
- First roster row name + email: <…>  (expect "Julia M." + "julia.m@gmail.com")
- Emails — quick spot check: do they look like real personal addresses (@gmail, @icloud)? y/n
- Invite card header: <…>  (expect "Invite your friends")
- Textarea placeholder hint: does it show personal-looking example emails (gmail)? y/n
- Share-link card header: <…>  (expect "Your group join link")
- SOON card titles (in order, left-to-right then row by row): <list 4>  (expect "Group leaderboard" / "Activity feed" / "Group chat" / "Group pool")
- Bottom CTA eyebrow + heading + button label: <…> / <…> / <…>  (expect "READY TO DO THIS FOR REAL?" · "Start your group." · "START YOUR GROUP →")
- Bottom CTA fine print: <…>  (expect "Early access · we ship the rest as we go")

## Step 5 — Click into FANTASY LEAGUE tab

Click the FANTASY LEAGUE pill in the sticky banner.

Report:
- Landed URL: <…>  (expect `/group-preview?type=fantasy`)
- Banner START button now reads: <…>  (expect "START YOUR LEAGUE →")
- Eyebrow above h1: <…>  (expect "COMMISSIONER · FANTASY LEAGUE")
- h1: <…>  (expect "Sunday Squad")
- Subline: <…>  (expect "12-team PPR · 6th season")
- Leader line: <…>  (expect "Commissioner: Mike Lozano")
- Roster header: <…>  (expect "12 MANAGERS")
- First two roster names: <…>  (expect "Dave Park" + "Kevin Hwang")
- Email-domain feel: do the rows lean @gmail.com / @yahoo.com (NOT .edu)? y/n
- Invite card header: <…>  (expect "Invite your league")
- SOON card titles (in order): <…>  (expect "League leaderboard" / "Activity feed" / "League chat" / "League pot")
- Bottom CTA eyebrow + heading + button: <…> / <…> / <…>  (expect "READY TO RUN THIS FOR YOUR LEAGUE?" · "Start your league." · "START YOUR LEAGUE →")
- Pricing fine print: <…>  (expect "Early access …", NOT "$799" / "14-day free trial")

## Step 6 — Click into FINANCE CLUB tab

Click the FINANCE CLUB pill.

Report:
- URL: <…>  (expect `?type=finance`)
- h1: <…>  (expect "Wharton Markets Society")
- Subline: <…>  (expect "Wharton · Markets practice group")
- Leader: <…>  (expect "Chair: Aiden Kim")
- Roster: "12 ANALYSTS"? y/n
- First three roster names + emails: <…>  (expect Maya Patel, Daniel Chen, Sofia Reyes — all @wharton.upenn.edu)
- Emails: do ALL rows use `@wharton.upenn.edu`? y/n
- Invite card header: <…>  (expect "Invite the analysts")
- SOON card titles (in order): <…>  (expect "Club leaderboard" / "Activity feed" / "Club channel" / "Club fund")
- Bottom CTA: <…> / <…> / <…>  (expect "READY TO RUN THIS FOR YOUR CLUB?" · "Start your club." · "START YOUR CLUB →")

## Step 7 — Click into GREEK CHAPTER tab

Click the GREEK CHAPTER pill.

Report:
- URL: <…>  (expect `?type=chapter`)
- h1: <…>  (expect "Beta Theta Pi")
- Subline: <…>  (expect "Fraternity · Yale University")
- Leader: <…>  (expect "Captain: Jackson F.")
- Roster: "12 BROTHERS"? y/n
- First roster name: <…>  (expect "Tucker H." — preserved from the prior preview)
- Emails: do rows use `@yale.edu`? y/n
- Invite card header: <…>  (expect "Invite your brothers")
- SOON card titles (in order): <…>  (expect "House leaderboard" / "Activity feed" / "House chat" / "House treasury")
- Bottom CTA: <…> / <…> / <…>  (expect "READY TO DO THIS FOR YOUR HOUSE?" · "Start your chapter." · "START YOUR CHAPTER →")
- Pricing fine print: <…>  (expect "$799/mo …" mention back + "14-day free trial · first 10 …")

## Step 8 — Roster math holds across types

For each of the 4 types, the right-side header counts should read "6 accepted · 4 pending · 2 sent" (6/4/2 split, unchanged from the prior preview's fix).

Report:
- Friends counts: <…>
- Fantasy counts: <…>
- Finance counts: <…>
- Chapter counts: <…>

## Step 9 — /join invalid landing copy is now generic

Visit `<BASE>/join/abc`.

Report:
- Renders the InvalidInviteCard (not bare 404)? y/n
- Body verbatim (first sentence): <…>  (expect references to "the person who sent it" / "start your own group" — NOT "captain" / "chapter")
- Primary CTA button label: <…>  (expect "START YOUR OWN GROUP →", NOT "START YOUR OWN CHAPTER →")
- Secondary CTA label: <…>  (expect "See the group dashboard preview →")
- Clicking secondary lands you at `/group-preview` (default friends preset)? y/n

Then try `<BASE>/join/00000000-0000-0000-0000-000000000000`:
- Body verbatim (first sentence): <…>  (expect "The group may have changed leaders, or the link expired…")

## Step 10 — Deep-link sanity

Type each URL directly in the address bar and confirm the preset matches:

- `<BASE>/group-preview?type=friends` → h1 "The Crew"? y/n
- `<BASE>/group-preview?type=fantasy` → h1 "Sunday Squad"? y/n
- `<BASE>/group-preview?type=finance` → h1 "Wharton Markets Society"? y/n
- `<BASE>/group-preview?type=chapter` → h1 "Beta Theta Pi"? y/n
- `<BASE>/group-preview?type=BOGUS` → falls back to Friends preset (h1 "The Crew")? y/n  (server should ignore unknown values and pick the default)

## Report back

```
## Step 1. Old route gone
- /chapter-preview returns: <…>  (expect 404)

## Step 2. Landing tile
- Verbatim tile copy: <…>
- Emerald span includes all 4 types: y/n
- "See the preview →" href: <…>  (expect /group-preview)

## Step 3. Default (Friends)
- URL: <…>
- Sticky banner verbatim: <…>
- 4 tabs left-to-right: <…>
- Active tab: <…>
- Banner START button: <…>

## Step 4. Friends content
- Eyebrow / h1 / subline / leader: <…>
- Roster header / first row: <…>
- Email feel (personal addresses): y/n
- Invite header: <…>
- SOON card titles: <…>
- Bottom CTA eyebrow / heading / button / fine print: <…>

## Step 5. Fantasy
- URL: <…>
- h1 / subline / leader / roster header / first 2 names: <…>
- Email feel (@gmail/@yahoo): y/n
- Invite header / SOON titles / bottom CTA: <…>
- No $799 in fine print: y/n

## Step 6. Finance
- URL: <…>
- h1 / subline / leader / roster header: <…>
- All emails @wharton.upenn.edu: y/n
- Invite header / SOON titles / bottom CTA: <…>

## Step 7. Chapter (Greek)
- URL: <…>
- h1 / subline / leader / roster header / first name: <…>
- Emails @yale.edu: y/n
- Invite header / SOON titles / bottom CTA: <…>
- $799 line back in fine print: y/n

## Step 8. Counts hold (6/4/2 each)
- Friends / Fantasy / Finance / Chapter: <…>

## Step 9. /join generic copy
- /join/abc body verbatim: <…>
- Primary CTA: <…>  (expect "START YOUR OWN GROUP →")
- Secondary CTA → URL: <…>  (expect /group-preview)
- /join/000…000 body verbatim: <…>

## Step 10. Deep-link sanity
- ?type=friends / fantasy / finance / chapter / BOGUS: <h1 of each>

## VERDICT
- Generic type switcher: <SHIPS / PARTIAL / BROKEN>
- Issues observed: <NONE | list>
- Which preset felt strongest as a conversion pitch (your honest read): <…>
- Which preset felt weakest or thinnest: <…>
```
