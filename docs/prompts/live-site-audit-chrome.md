# Prompt: Full Live-Site Audit of sneakersterminal.com (browser-agent only)

You are a browser-automation agent (click / type / navigate / screenshot /
read DOM / run JS in page). You have NO filesystem, terminal, or git — and
none is needed: this is a read-and-report mission against the LIVE production
site. Your final deliverable is a single structured markdown report pasted in
chat, which will be handed to a coding agent as the foundation for a full
front-end redesign.

## Why this audit exists (context, not your task)

The product is pivoting its web front-end to match a new "agent app" design
language that already shipped at `/agent` and inside the phone-frame demo on
the homepage: near-black `#0B0D10` surfaces, cards `#14181D`, green `#2FD37A`
accent, SF-Pro-style type, tabular numerals for money, living "orb" visuals,
bottom-sheet interactions. The rest of the site (the `/dashboard` terminal,
auth pages, marketing pages) predates this language. A coding agent will
rebuild the dashboard and front-end to match — your report tells it what
exists, what works, what's broken, and what every screen is FOR, so nothing
functional gets lost in the restyle.

## Ground rules — read twice

- **You are logged in as the owner's real account.** Treat everything as
  production with real data.
- **READ-ONLY discipline.** Do NOT: sign out, change any setting, toggle ANY
  switch (especially anything labeled Autotrade, Auto-trade, or trading
  On/Off), connect/disconnect venues, submit forms that create/modify
  anything, click Delete/Remove/Cancel-subscription anywhere, or enter
  payment flows past the first screen. Safe interactions: navigation, tabs,
  opening/closing panels and sheets, hovering, scrolling, filtering/sorting
  lists, pagination.
- The homepage phone demo ("Meet your Agent") and `/agent` run on a sandboxed
  in-browser mock — interacting THERE is fully safe (subscribe/equip/add
  cash inside the demo/app move fake money only). Exercise those freely.
- If a click produces an unexpected confirm/alert dialog, do not accept it —
  report it.
- Capture BOTH viewports for every screen: ~1280px wide and ~430px wide
  (resize the window). Screenshot each state you describe.
- Check the console on every route and note errors/warnings (filter obvious
  third-party noise).

## The route list (visit in order)

**Public surface:**
1. `/` — full scroll: hero, CTAs, "Meet your Agent" section (interact with
   the phone demo: swipe orbs, switch its Agent/Models/Balance tabs, open a
   model sheet, run Add Agent, add demo cash), stats strip, venue ticker,
   footer. Note: since you're logged in, the top nav should show
   DASHBOARD + OPEN APP → — verify; also note any button/nav inconsistencies
   (heights, case, color logic — there are at least four button styles).
2. `/pricing`, `/venues` — quick pass: purpose, state, design dialect.
3. `/join` and `/login` — look only; do NOT log out to test them. Note the
   design language they use (dark premium panels) and whether the email field
   arrives pre-filled on /join.

**The app (new design language — the TARGET aesthetic):**
4. `/agent` — all four tabs (Agent, Models, Balance, Profile). Exercise the
   carousel, equip/subscribe, sheets, add cash. This is the reference
   design everything else will be rebuilt to match — describe its patterns
   precisely (spacing, cards, type, tab bar, sheets).

**The dashboard (the redesign subject — be exhaustive):**
5. `/dashboard` — the home view. Then EVERY reachable sub-route from its
   nav/sidebar/menus. Expected (verify — the info architecture may differ):
   markets/opportunities views, individual market detail pages, trades/
   portfolio, autotrade (LOOK, don't toggle), connections (venue credentials
   status), alerts, settings (all sub-pages incl. any O'Toole/AI sections),
   leaderboards/groups if present, wallet/balance views. Follow every left-nav
   item and tab you find; list any dead links or empty states.

## What to record per screen (the report schema)

For EACH distinct screen/state:
- **Route + name** and 1-line purpose ("what job does this screen do for a
  user").
- **Data inventory**: every distinct piece of information shown (e.g. "market
  name, yes/no prices per venue, spread, 24h volume, freshness timestamp") —
  this is the redesign's requirements list, be thorough.
- **Actions inventory**: every button/control and what it appears to do (from
  labels/hover, not by triggering destructive ones).
- **Works / broken / janky**: functional bugs, console errors, layout breaks
  (especially at 430px — the old dashboard is suspected to be rough on
  mobile), slow loads, empty or stale data, anything confusing.
- **Design dialect**: which visual language it speaks (old terminal blue /
  new agent dark-green / something else), with the main tokens you can read
  from computed styles (bg color, font-family, accent colors).
- **Redesign recommendation**: KEEP AS-IS (already matches target) /
  RESTYLE (works, wrong skin) / RETHINK (UX itself is weak) / KILL
  (redundant with the agent app — e.g., does this screen's job now belong
  inside /agent?). One sentence of reasoning.
- Screenshot references for both widths.

## Special attention items

- Mobile usability of the dashboard: is it usable at 430px at all? Which
  screens break worst?
- Overlap analysis: which dashboard capabilities are ALREADY represented in
  /agent (balance, positions/activity, autotrade config) vs. which exist
  ONLY in the dashboard (market browsing, cross-venue comparison,
  connections management, admin/settings, leaderboards)? The redesign needs
  the only-in-dashboard list preserved.
- Anything showing raw internal vocabulary to users (the word "scrape" or
  "scraper" anywhere user-visible is a bug — flag it).
- Auth-state consistency: any page that looks logged-out while you're
  logged in, or vice versa.
- Performance feel: note any route that takes >3s to paint its data.

## Deliverable

One markdown report in chat, structured as:
1. **Executive summary** (10 bullets max): overall state, worst breakages,
   biggest design-dialect clashes, the KILL/RETHINK candidates.
2. **Screen-by-screen findings** (the schema above, grouped: Public / Agent /
   Dashboard).
3. **Data & actions master list** for the dashboard (union of all inventories
   — the redesign's functional contract).
4. **Bug list** ranked by severity, each with route + repro + screenshot ref.
5. **Open questions** for the human (things you couldn't determine safely).

Do not propose the new design — that's the coding agent's job. Your value is
a complete, honest map of what exists today.
