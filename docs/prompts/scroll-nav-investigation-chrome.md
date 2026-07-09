# Prompt: Nav/Tab-Bar Scroll Behavior Investigation (Claude in Chrome)

You are a browser-automation agent. This is a **read-only reconnaissance
mission**, not a QA pass and not a bug hunt for unrelated issues. Your ONLY
job is to precisely document how the navigation buttons and tab bar behave
as the page scrolls, on two specific surfaces, at two viewport widths each.
Be exhaustive and literal — describe exactly what you observe, with pixel
positions and CSS computed styles where possible, not impressions.

**Site:** sneakersterminal.com (or the preview URL you're given)

## Ground rules

- Read-only. Do not submit forms, do not toggle switches, do not click
  Delete/Remove/Sign out. Navigation, scrolling, resizing, and reading
  computed styles via JS are all fine.
- You may need to log in to reach the `/agent` app (Surface 2 below). If you
  don't have credentials, ask the user before proceeding to that surface —
  Surface 1 (the public homepage) doesn't require login and you should do
  that one first regardless.
- Test at TWO viewport widths for each surface: roughly **1280px wide**
  (desktop) and roughly **390-430px wide** (phone). If your tool cannot
  genuinely resize the rendering viewport (some tools only resize the outer
  browser window, not the actual page content), say so explicitly and try
  whatever your tool's real mechanism is (e.g., a dedicated mobile-emulation
  mode) — do not silently skip this and do not guess what a narrow layout
  would look like without actually rendering it.

## Surface 1 — Public homepage (`/`), logged out

1. Load the homepage fresh at the desktop width. Before scrolling at all,
   screenshot the top of the page and identify every clickable nav element
   in the top-right area (e.g. "LOG IN", "SIGN UP" or similar). For each one,
   run a small JS snippet via your evaluate/inspect capability to report:
   - `getBoundingClientRect()` (top/left/right/bottom in pixels)
   - `getComputedStyle(el).position` (static / relative / absolute / fixed /
     sticky)
   - the nearest ancestor that establishes its positioning context (i.e. if
     `position: absolute`, walk up `offsetParent` and report what that
     ancestor element is — tag name, class names)
2. Now scroll down the page in **five roughly equal increments** (e.g. 20%,
   40%, 60%, 80%, 100% of total scrollable height). At EACH increment:
   - Screenshot the current viewport.
   - Re-run the same `getBoundingClientRect()` check on those same nav
     elements. Report whether they are still visible in the viewport, and
     if so, at what pixel position; if not visible, say so explicitly.
   - Note what section of the page is currently in view (e.g. "hero", "Meet
     your Agent phone demo", "stats strip", "venue ticker", "footer") so the
     scroll position is identifiable later.
3. Scroll back to the very top and confirm the nav returns to its original
   position exactly (no drift/jump).
4. Repeat steps 1-3 at the phone-width viewport. Note: at narrow widths the
   nav may collapse into a hamburger/menu icon instead of separate buttons —
   if so, track that icon's position/behavior instead, and explicitly note
   the breakpoint width where the layout changed if you can detect it (e.g.
   by trying a few widths between 430px and 1280px).

## Surface 2 — Inside the app (`/agent`), logged in

5. Log in (ask for credentials if you don't have them). Navigate to `/agent`.
   You should see a bottom tab bar with 5 items at phone width (or a left
   sidebar at desktop width — check which you get at each width tested).
6. At desktop width: screenshot the tab bar / sidebar. Run the same
   `getBoundingClientRect()` + `getComputedStyle(el).position` check on the
   sidebar container and on 2-3 of its individual tab items. Then scroll the
   main content area (not the whole page — click/scroll inside the content
   region to the right of the sidebar) all the way down if the current tab's
   content is tall enough to scroll, and re-check the sidebar's position and
   visibility. Does it stay in place while content scrolls, or does it move/
   disappear?
7. At phone width: same procedure but for the bottom tab bar instead of the
   sidebar — screenshot it, check its computed `position` value, scroll the
   tab's content area down as far as it goes, and re-screenshot + re-check
   the tab bar's position. Specifically look for and report:
   - Does the tab bar stay pinned to the bottom of the viewport throughout
     the scroll, or does it move up/down/disappear at any point?
   - Is any content (text, buttons, cards) from the page visually
     overlapping or hidden behind the tab bar at the bottom of the scroll?
     Screenshot that exact moment if so.
8. Try this on at least two different tabs within the app (e.g. Agent tab
   and Markets tab, since Markets likely has the longest/most scrollable
   content) — the tab bar behavior might differ if one page is much taller
   than another.

## Report format

For each surface × width combination, report:

- **Element(s) checked** and their exact `position` CSS value.
- **A scroll-by-scroll table**: scroll % (or description) → is the nav/tab
  element visible → its pixel position if visible.
- **Screenshots** at each checkpoint (top, each scroll increment, bottom),
  clearly labeled.
- **A plain-English one-paragraph summary per surface/width**: "As you
  scroll down the [homepage / agent app] at [desktop/phone] width, the
  [nav buttons / tab bar] does/does not stay visible. Specifically, it
  [describe exact behavior]."
- Any content-overlap issue found (element hidden behind another).
- The narrow-viewport breakpoint width, if you were able to determine one.

Do not propose fixes or write any code — this is a documentation-only pass.
Be as literal and pixel-precise as your tools allow.
