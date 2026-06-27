# Verify Notion roadmap database — seeded from ROADMAP.md

Background: seeded a new Notion database **"Sneakers Terminal — Roadmap"** from `~/sneakers-trading/ROADMAP.md`. All 43 roadmap items were migrated. This is currently a one-time mirror — `ROADMAP.md` is still the source of truth. We want to confirm the migration is complete and correct before deciding on a sync direction.

Database URL: https://www.notion.so/6c43e7c48660412da4280f0151f26046

You're a QA tester. **Be concrete — exact counts and verbatim text.**

## Step 1 — Open the database

Go to https://www.notion.so/6c43e7c48660412da4280f0151f26046

Report:
- Does it load? y/n
- Title shown at top: <verbatim>
- Default view type (table / board / etc.): <…>
- Total row count (look at the count at the bottom of the table, or count rows): <N>

## Step 2 — Verify the schema

Confirm these 4 properties exist with the right types:
- **Item** — title
- **Status** — select, with options: Shipped, In Flight, Next, Later, Small Fix
- **Done** — checkbox
- **Details** — text

Report any missing/renamed/extra properties.

## Step 3 — Verify counts per Status

Group the table by **Status** (or click into the Status column header → Group). Report the count in each group:

```
- Shipped:    <N>   (expected 14)
- In Flight:  <N>   (expected 5)
- Next:       <N>   (expected 6)
- Later:      <N>   (expected 11)
- Small Fix:  <N>   (expected 7)
- TOTAL:      <N>   (expected 43)
```

## Step 4 — Spot-check Done checkboxes

The **Done** checkbox should be ticked for: all 14 Shipped items, **plus** these 2 items inside the Next group:
- "Scrapers MVP"
- "/venues page"

Everything else should be unchecked. Report:
- Total Done-checked rows: <N> (expected 16)
- Are "Scrapers MVP" and "/venues page" both checked? y/n
- Any Shipped row NOT checked? <NONE | list>
- Any non-Shipped / non-those-two row that IS checked? <NONE | list>

## Step 5 — Spot-check Details content

Open these 3 rows and confirm the Details text is present and readable (not truncated/garbled):
1. "Multi-venue credentials + connections schema" (longest one — should mention migrations 034/035/036)
2. "Admin page (/admin)" (should say "Being built this session")
3. "Social-icon links in footer still href=\"#\"" (short — "Placeholders. Real URLs pending.")

Report verbatim the first ~10 words of each Details field.

## Step 6 — Try a board view (optional, nice-to-have)

Add a new view → Board → group by Status. Confirm the 5 columns render with cards. This is the view that makes the DB more useful than the flat Markdown file.

## Report back

```
## Step 1. Open
- Loads: y/n
- Title: <…>
- Default view: <…>
- Row count: <…>

## Step 2. Schema
- All 4 properties correct: y/n
- Issues: <NONE | list>

## Step 3. Status counts
- Shipped / In Flight / Next / Later / Small Fix / TOTAL: <…>
- Matches expected: y/n

## Step 4. Done checkboxes
- Total checked: <…> (expect 16)
- Scrapers MVP + /venues page checked: y/n
- Unexpected checked/unchecked: <NONE | list>

## Step 5. Details spot-check
- Row 1 first words: <…>
- Row 2 first words: <…>
- Row 3 first words: <…>

## Step 6. Board view
- 5 columns render: y/n

## VERDICT
- Migration: <COMPLETE / PARTIAL / BROKEN>
- Discrepancies: <NONE / list>
```
