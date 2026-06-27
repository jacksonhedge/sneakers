# Chrome prompt — verify O'Toole global memory + sources editor

End-to-end verification of the new `/admin/otoole` surface and its
chat-route injection. Commits: `d95a80d` (admin page + migration 038)
and `4c8234e` (chat wire-in).

15-20 minutes. **Two real writes** happen: one global-memory save +
one global-source create. Both reversible (toggle off / delete row at
the end).

---

**Required inputs from the user before you start:**

- `admin_email` — defaults to `jackson@hedgepayments.com`
- `admin_password` — user types it themselves at the admin login
- `app_url` — production app where O'Toole chat lives. Defaults to
  `https://app.sneakersterminal.com`

If anything missing, STOP and ask.

---

## Step 0 — Sign in to admin

Open `https://admin.sneakersterminal.com/login`. Sign in. Land on
admin home with the URL bar reading `admin.sneakersterminal.com/`.

The top nav should now show an **OTOOLE** link with NO amber `WIP`
pill next to it (was pending before commit `d95a80d`).

**Pass / Fail:** [fill in]

---

## Step 1 — Page renders cleanly

**Do:** Click the **OTOOLE** nav link. Lands on
`admin.sneakersterminal.com/otoole`.

**Expected layout (top to bottom):**

1. Header: `> O'TOOLE — GLOBAL MEMORY & STRATEGY` + `Bot-wide baseline` H1 + descriptive paragraph linking to `/dashboard/settings/otoole` and `/audit`.
2. **MEMORY & PERSONA** section: a card with a master enable checkbox at top, and TWO side-by-side textareas (`PERSONA ADDENDUM` left, `BASELINE MEMORY / STRATEGY` right) — both empty on first load, both showing a `0 / 8,192 chars` or `0 / 32,768 chars` counter. Save button reads `SAVED` and is disabled.
3. **SOURCES (0 total · 0 enabled)** section with a `+ ADD SOURCE` button on the right and an empty-state card "No global sources yet."
4. Footer note "OTHER O'TOOLE ADMIN (planned)" listing cost telemetry + per-user drilldown as future work.

**Pass / Fail:** [fill in]
**Notes:** [anything off about the layout, missing labels, console errors]

---

## Step 2 — Save persona + content with enable toggle

**Do (in MEMORY & PERSONA):**

1. In **PERSONA ADDENDUM**, paste exactly:
   ```
   Verify pass: when proposing without an explicit market, default to longshots in the 10–35¢ band.
   ```
2. In **BASELINE MEMORY / STRATEGY**, paste exactly:
   ```
   Verify pass: Sneakers Terminal aggregates prices across prediction markets, sportsbooks, DFS pick'em, and sweeps. Operators add their own knowledge base on top of this baseline.
   ```
3. Watch the char counters update live (should read ~108 / 8,192 and ~211 / 32,768 give or take).
4. Watch the `SAVED` button flip to `SAVE` (now enabled) the moment any text changed.
5. Tick the master enable checkbox at top. The badge should read `INJECTING INTO EVERY CHAT` in green.
6. Click `SAVE`.

**Expected:**
- Green pill appears: `saved · ENABLED · persona N chars · content M chars` with the actual lengths.
- Button label flips back to `SAVED` (disabled).
- "last saved" timestamp updates to today's UTC date/time.
- "by jackson@hedgepayments.com" (or whatever `admin_email` you used) appears next to the timestamp.

**Pass / Fail:** [fill in]
**Verbatim result message:** [fill in]
**Char counts shown in pill:** [fill in]

---

## Step 3 — Hard refresh persists state

**Do:** Cmd+Shift+R (or Ctrl+Shift+R) to hard refresh the page.

**Expected:**
- Both textareas re-load with the verify-pass text intact.
- Master toggle is still ON, badge still reads `INJECTING INTO EVERY CHAT`.
- "last saved" timestamp matches step 2.

**Pass / Fail:** [fill in]

---

## Step 4 — Create a source

**Do:** Click `+ ADD SOURCE`. The form expands inline. Fill in:

- **KIND**: `note`
- **LABEL**: `Verify pass — NFL injury heuristic`
- **CONTENT**:
  ```
  When a team's WR1 or RB1 is questionable on Friday and the news drops within 90 minutes of kickoff, the line typically shifts 0.5-1.0 in the opposing direction.
  ```
- **MARKET FILTER**: `nfl, injury, hamstring`

Click `CREATE SOURCE`.

**Expected:**
- Form collapses (button returns to `+ ADD SOURCE`).
- New row appears at top of the list, showing:
  - amber `NOTE` kind badge
  - bold label "Verify pass — NFL injury heuristic"
  - green `ON` enable badge
  - `filter: nfl, injury, hamstring` in muted mono text
- Section header updates to `SOURCES (1 total · 1 enabled)`.

**Pass / Fail:** [fill in]

---

## Step 5 — View / disable / re-enable / delete-cancel

**Do (on the row from step 4):**

1. Click `VIEW`. The drawer expands showing the full content text in
   monospace, plus a footer with `id #N`, created date, and "by
   <admin_email>". Click `HIDE`.
2. Click `DISABLE`. Row's badge flips to grey `OFF`. Result pill
   below row reads `Verify pass — NFL injury heuristic → DISABLED`.
3. Click `ENABLE` (same button, now reads ENABLE). Badge flips back
   to green `ON`. Pill reads `... → ENABLED`.
4. Click `DELETE`. Button transforms inline to a red `CONFIRM DELETE`
   + a `cancel` link. Click `cancel`. Row stays as-is, no delete
   happens.

**Pass / Fail per substep:** [1] [2] [3] [4]

---

## Step 6 — Audit log captures everything

**Do:** Open `/admin/audit` in a new tab. Look at the top of the table.

**Expected (newest first):**

1. `SET_OTOOLE_GLOBAL_SOURCE_ENABLED` — metadata: `prior_enabled=false, new_enabled=true, changed=true, label="Verify pass — NFL injury heuristic"`
2. `SET_OTOOLE_GLOBAL_SOURCE_ENABLED` — metadata: `prior_enabled=true, new_enabled=false, changed=true, ...`
3. `CREATE_OTOOLE_GLOBAL_SOURCE` — metadata: `kind=note, label=..., content_len=~210, market_filter="nfl, injury, hamstring"`
4. `SET_OTOOLE_GLOBAL_MEMORY` — metadata: `enabled=true, enabled_changed=true, persona_len=~108, persona_changed=true, content_len=~211, content_changed=true`

Action-type filter chips at the top should now include all three new
action types.

**Pass / Fail:** [fill in]
**Notes:** [if any metadata is missing or malformed]

---

## Step 7 — Live chat picks up the global memory

This is the most important check. The chat route should now include
the operator baseline in O'Toole's system prompt.

**HARD STOP** — sign out of admin first. Then sign in to the user app
at `<app_url>` with the SAME credentials (admin emails are also user
accounts).

**Do:**

1. Open the O'Toole chat panel (left sidebar on desktop, FAB bottom-right
   on mobile).
2. Send exactly this message: `What does the operator want you to default to when proposing trades?`
3. Wait for the assistant reply.

**Expected:**
- Assistant should mention the **10–35¢ longshot band** in its reply.
  This proves the persona addendum is being read at chat time.
- It should NOT mention the source content from step 4 (because the
  message contains none of `nfl`, `injury`, `hamstring`).

**Pass / Fail:** [fill in]
**Verbatim assistant reply (first 200 chars):** [fill in]

---

## Step 8 — Source filter actually fires on keyword

**Do:** Send another message in the same chat: `Walk me through how an NFL injury report on Friday usually moves the line.`

**Expected:**
- Assistant reply should incorporate the source content from step 4
  (the "WR1/RB1 questionable on Friday → 0.5–1.0 line shift" heuristic).
- This proves keyword filter ("nfl", "injury") matched the message and
  the source was injected.

**Pass / Fail:** [fill in]
**Did the heuristic from step 4 appear in the reply (yes/no/partial):** [fill in]
**Verbatim assistant reply (first 300 chars):** [fill in]

---

## Step 9 — Master toggle actually disables injection

**Do:**

1. Open a new tab. Go to `admin.sneakersterminal.com/otoole`.
2. Untick the master enable checkbox (top of MEMORY card). Badge flips
   to grey `DISABLED`. Click `SAVE`.
3. Back to `<app_url>`. Send a NEW chat message: `What does the operator want you to default to when proposing trades?`

**Expected:**
- This time the assistant should NOT mention the 10–35¢ band — should
  give a generic answer or ask clarifying questions.
- Note: the source from step 4 should ALSO not fire (it's gated by the
  same enabled flag at row-level only — but the master toggle only
  controls memory + persona, not sources). If the source still fires
  on an `nfl injury` message, that's expected behavior, not a bug.

**Pass / Fail:** [fill in]
**Did the band still appear (yes = bug, no = pass):** [fill in]

---

## Step 10 — Cleanup

Reverse the verify-pass writes so production is back to baseline:

1. Back at `/admin/otoole`:
   - Empty both textareas.
   - Leave master toggle in whatever state you want (DISABLED is
     a fine default).
   - Click `SAVE`. Pill should read `saved · DISABLED · persona 0 chars · content 0 chars`.
2. On the source row from step 4: click `DELETE`, then `CONFIRM DELETE`.
   Row vanishes. Section header returns to `SOURCES (0 total · 0 enabled)`.
3. Open `/admin/audit`. Top two rows should be the cleanup actions
   (`DELETE_OTOOLE_GLOBAL_SOURCE` + `SET_OTOOLE_GLOBAL_MEMORY`).

**Pass / Fail:** [fill in]

---

## Step 11 — Final report

```
## O'Toole global memory verify — d95a80d + 4c8234e

| # | Check | Pass/Fail | Notes |
|---|---|---|---|
| 0  | Admin sign-in + nav unflagged | | |
| 1  | Page renders cleanly | | |
| 2  | Save persona + content + enable | | |
| 3  | Hard-refresh persistence | | |
| 4  | Create source | | |
| 5  | View / disable / re-enable / delete-cancel | | |
| 6  | Audit log captures all 4 actions | | |
| 7  | Persona addendum appears in chat | | |
| 8  | Source keyword filter fires | | |
| 9  | Master toggle disables injection | | |
| 10 | Cleanup writes complete | | |

## Real writes performed
- otoole_global_memory: 1 row updated (id=1) — set, then cleared
- otoole_global_sources: 1 row created, then deleted
- admin_audit_events: 6 rows added (set_memory, create_source, 2× set_enabled, set_memory cleanup, delete_source)

## Anything weird
(free-form)

## Top fix-tomorrow items
(if any — ranked)
```

---

## Boundaries

- DO NOT save text containing real user PII or production secrets to
  these textareas.
- DO NOT delete the singleton row in `otoole_global_memory` (id=1) —
  the check constraint allows it but rebuild requires a re-seed.
- DO NOT create more than 2-3 sources during this run.
- Net zero is the goal: end the run with both fields empty + zero
  sources.
- Stay on `admin.sneakersterminal.com` and `<app_url>`.
- Redact passwords from screenshots.
