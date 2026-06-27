# Verify Groups polish — phase 1 (commit 019d73b)

Background: Phase 1 of the social/groups build, addressing three of the site-sweep findings around groups / Greek-life GTM:

1. `/join/[bogus-id]` used to bare-404 — replaced with a friendly `InvalidInviteCard` that distinguishes "bad URL format" vs "no such chapter" and offers "Start your own chapter →" + "See the chapter dashboard preview →" + sign-in fallback.
2. Landing's "Groups · Coming soon" tile is now "Groups · EARLY ACCESS" with reconciled copy ("Captains sign up now, members onboard as we ship") and a link to the new preview.
3. New public `/chapter-preview/page.tsx` — captain dashboard demo with realistic mock data + "SOON" cards for leaderboard, activity feed, house chat, house treasury. Sticky preview banner + bottom conversion CTA both point back to the landing where the org-signup modal lives. No auth gate (top-level route, not under `/dashboard/`).

No DB changes. Uses existing org infra (migrations 020 + 024).

**Base URL (preview):** `https://sneakers-terminal-3plvv853n-jackson-fitzgeralds-projects.vercel.app`

## ⛔ HARD RULE — no payment / billing / subscription / trial clicks

Do NOT click any "Start your chapter / Start trial / Subscribe / Upgrade / Pay" CTA that would actually open or submit the org-signup modal beyond step 1, or any Stripe / billing flow. Observation-only on those CTAs. You can hover, copy href, describe — but do not progress past the modal's first screen.

## Step 0 — No sign-in required

This whole flow is intentionally public — prospects don't need an account to evaluate it. If anything redirects to `/login` or `/signup` when it shouldn't, that's a finding.

## Step 1 — Landing tile copy

Go to `<BASE>/`. Find the **GROUPS** tile in the three-pillar row (LEADERBOARDS / GROUPS / 75% OFF, the order may vary).

Report:
- Verbatim text inside the GROUPS tile, including the small pill in its corner.
- Does it still say "Coming soon" anywhere? y/n  (expect n — should say "EARLY ACCESS" in the pill)
- Is there a visible "See the preview →" link inside the tile? y/n  (expect y)
- Click the "See the preview →" link. Landed URL: `<…>`  (expect `/chapter-preview`)

## Step 2 — Chapter preview page

You should now be on `<BASE>/chapter-preview`.

Report:
- Page loads? y/n
- **Sticky banner at top** — verbatim text inside it (expect a 👀 emoji + "You're previewing the captain dashboard with sample data." + a "START YOUR CHAPTER →" button on the right).
- Org header — verbatim text for:
  - Eyebrow (small label above the title): <…>  (expect "CAPTAIN · ORGANIZATION")
  - Title (h1): <…>  (expect "Beta Theta Pi")
  - Subline (type · college): <…>  (expect "Fraternity · Yale University")
  - Captain line: <…>  (expect "Captain: Jackson F.")
- Status pill on right: text + color
- Counts line: "X accepted · Y pending" — what does it say? (expect "6 accepted · 6 pending")

## Step 3 — Tab nav

Look at the tab strip (Members / Seats / Treasury / Bot / Settings).

Report:
- All 5 tabs visible? y/n
- Which tab is highlighted as active? (expect Members)
- Which tabs show a "SOON" badge? (expect Seats, Bot, Settings — NOT Treasury, NOT Members)
- Are the SOON tabs visually distinct from active/Treasury? (greyed/disabled-looking?) y/n
- Try clicking a SOON tab — does anything happen? (expect: no — these are static labels in preview)

## Step 4 — Roster table

Scroll past the invite + share-link cards to the roster table.

Report:
- Header reads what? (expect "Roster" + "12 BROTHERS")
- How many rows in the table? <N>  (expect 12)
- Status pill breakdown — count rows where status pill says:
  - ACCEPTED: <N>  (expect 6)
  - PENDING: <N>  (expect 4)
  - SENT: <N>  (expect 2)
- For the first row: paste verbatim NAME + EMAIL + STATUS + JOINED.
- Do all 12 names + emails read as realistic Greek-life names with .edu addresses? y/n

## Step 5 — Invite UI is visibly disabled

Look at the **"Invite your brothers"** card above the roster.

Report:
- Textarea visible? y/n
- Try typing in it — does it accept input? (expect: NO — disabled)
- "SEND INVITES" button visible? y/n  · Clickable / disabled? (expect: disabled)
- "UPLOAD CSV" button visible? y/n  · Clickable / disabled? (expect: disabled)
- Verbatim text of the small italic hint near the buttons (expect: "Disabled in preview · live once you start your chapter")

Same observation for the "Your chapter join link" card — code block visible? COPY button disabled?

## Step 6 — SOON cards (downstream-feature teasers)

Find the 2x2 grid of cards below the roster: **House leaderboard / Activity feed / House chat / House treasury**.

Report:
- All 4 cards visible? y/n
- Each has a "SOON" badge in its top-right? y/n
- For each, paste the first 8–10 words of its description:
  - House leaderboard: <…>
  - Activity feed: <…>
  - House chat: <…>
  - House treasury: <…>

## Step 7 — Bottom conversion CTA

Scroll to the very bottom.

Report:
- Eyebrow text: <…>  (expect "READY TO DO THIS FOR REAL?")
- Big heading: <…>  (expect "Start your chapter.")
- Paragraph mentions price + seat count? y/n  (expect: $799/mo, 25 seats)
- "START YOUR CHAPTER →" button visible? y/n  · DO NOT CLICK (Hard Rule)
- Small fine-print under the button mentions trial + early access? y/n

## Step 8 — `/join/[bogus]` graceful landing

This is the bare-404 fix. Try TWO URLs:

### 8a. Bad format: `<BASE>/join/abc`

Report:
- Page returns the bare Next 404 "This page could not be found"? y/n  (expect n)
- Does an actual styled card render? y/n  (expect y)
- Card eyebrow: <…>  (expect "INVITE NOT FOUND")
- Headline: <…>  (expect "That invite link doesn't look right.")
- "START YOUR OWN CHAPTER →" CTA visible? y/n  · DO NOT CLICK
- "See the chapter dashboard preview →" CTA visible? y/n  · Clicking it lands you back on `/chapter-preview`? y/n
- "Already in? Sign in" link visible? y/n

### 8b. Valid-format but unknown id: `<BASE>/join/00000000-0000-0000-0000-000000000000`

Report:
- Page returns bare Next 404? y/n  (expect n)
- Headline: <…>  (expect "This invite link is no longer active.")
- Body copy mentions captain may have changed leaders or link expired? y/n
- Same 3 CTAs visible (Start own chapter / See preview / Sign in)? y/n

## Step 9 — Sanity: valid `/join` still works

If you have a real org id from production, navigate to `<BASE>/join/<real-org-id>`. If you don't, skip this step.

If you do have one:
- Org card renders with org name + captain? y/n
- JoinSignupForm at the bottom renders? y/n  (expect y — DO NOT SUBMIT)

## Report back

```
## Step 1. Landing tile
- Verbatim text: <…>
- "Coming soon" gone: y/n
- "See the preview →" link present: y/n
- Click → URL: <…>

## Step 2. Preview page header
- Sticky banner verbatim: <…>
- H1: <…>
- Subline: <…>
- Captain: <…>
- Counts: <…>

## Step 3. Tabs
- All 5 visible: y/n
- Active tab: <…>
- SOON tabs: <list>

## Step 4. Roster
- Row count: <N>
- ACCEPTED / PENDING / SENT counts: <a/p/s>
- First row: <…>
- Names look realistic: y/n

## Step 5. Invite UI disabled
- Textarea disabled: y/n
- SEND INVITES disabled: y/n
- UPLOAD CSV disabled: y/n
- Hint text: <…>
- COPY button disabled: y/n

## Step 6. SOON cards
- All 4 visible: y/n
- First 8-10 words of each: <…>

## Step 7. Conversion CTA
- Eyebrow + heading + button visible: y/n
- $799 + 25 seats mentioned: y/n

## Step 8a. /join/abc
- Bare 404 gone: y/n
- Eyebrow + headline + CTAs: <…>
- "See preview" link works: y/n

## Step 8b. /join/000…000
- Bare 404 gone: y/n
- Headline matches "no longer active": y/n

## Step 9. Valid /join
- Tested: y/n  · Render OK: y/n / n/a

## VERDICT
- Phase 1 groups polish: <SHIPS / PARTIAL / BROKEN>
- Conversion flow felt: <strong / okay / weak>
- Issues observed: <NONE | list>
- Felt as a Greek-life chapter leader inhabiting the preview: <one honest sentence>
```
