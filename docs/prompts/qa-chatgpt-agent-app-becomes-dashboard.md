# Prompt: ChatGPT Agent QA pass — "App Becomes the Dashboard" (preview build)

You are a browser-automation agent testing a PREVIEW deployment of a web app
called Sneakers Terminal (a prediction-market trading terminal for college
students). This build has NOT gone to production yet — you're the last check
before it does. Your job is to actually USE the app like a real user would,
find anything broken or off, and report back in detail. You are not reviewing
code — you have no code access — you are clicking, typing, watching, and
judging what you see and feel.

**Preview URL:** https://sneakers-terminal-git-feat-2c1128-jackson-fitzgeralds-projects.vercel.app/

## What changed (context, so you know what to focus on)

Until this build, logging in took users to a dense data-terminal-style
`/dashboard`. This release makes a consumer-facing "agent app" (a phone-app-like
experience with a living animated orb, model marketplace, wallet, and now
market data) the primary destination after login, with the old terminal
preserved as a secondary "classic" mode. Specifically:

1. **`/dashboard` now redirects straight to `/agent`.** Logging in lands you in
   the new app, not the old terminal.
2. **The old terminal still exists** at `/dashboard/legacy`, byte-for-byte the
   same as before — nothing there should have changed or broken.
3. **The agent app gained a 5th tab: Markets.** Previously it only had Agent /
   Models / Balance / Profile. Markets is new — it shows live-ish crypto strike
   prices in short time windows, plus a broader cross-venue market browser.
4. **On wide/desktop screens the app now has a left sidebar** (icon rail) with
   all 5 tabs, instead of only the bottom tab bar. On narrow/phone screens it
   should look exactly like before, just with a 5th tab added to the bottom bar.
5. **Profile tab is now real** (was previously a fake hardcoded demo profile) —
   it should show whoever is actually logged in, plus links out to account
   settings, billing, connections, etc. (some of those linked pages are the
   "classic" terminal pages, which is expected).
6. **The Agent tab's animated orb got a visual upgrade** — it's supposed to
   look more organic and "alive" (like a living blob), especially when it's
   actively "trading" (a state you'll see labeled Equipped/Entering/Holding),
   and more subtly alive when just sitting idle. Your subjective opinion on
   whether this reads as "alive" matters a lot here — this was a specific,
   personally-requested design goal from the product owner, and the team
   ran out of ways to measure it automatically. They need a human (you) to
   just look at it and say what you honestly think.
7. **Two specific bugs were just fixed and need to be double-checked:**
   (a) a countdown timer on the Markets tab that used to silently drift wrong
   the longer you left the page open without refreshing (numbers should now
   stay accurate to the real clock even after several minutes), and
   (b) clicking the logo/brand or the "Dashboard" menu item while INSIDE the
   classic `/dashboard/legacy` terminal used to unexpectedly kick you out into
   the new app — it should now keep you inside the classic terminal instead.

## Ground rules — read carefully before touching anything

- **This is a preview build with a real-feeling account, but you should still
  treat write actions cautiously.** Safe to do freely: navigate, click tabs,
  open/close panels and popups, scroll, filter/sort lists, resize the window,
  swipe/click through the animated demo on the homepage (it runs on fake data
  and is designed to be played with), watch the orb, wait and observe.
- **Do NOT:** submit any payment/card flow past the first screen, connect a
  real trading account/wallet, enter or paste any real API keys or private
  keys anywhere, click any button that looks like it places a real trade or
  moves real money, toggle any switch labeled Autotrade/Auto-trade/trading
  On-Off, or click Delete/Remove/Cancel/Sign out unless specifically asked to
  below.
- **You will need to log in.** If you land on a login screen and don't have
  credentials, STOP and ask the user (the person who gave you this task) for
  a login before continuing — don't guess or create an account yourself
  unless told to.
- **If a native browser popup (alert/confirm/prompt) appears, do not dismiss
  it blindly** — note what triggered it and ask before proceeding if you're
  unsure it's safe.
- **Try both a wide desktop-sized window and a narrow phone-sized window** if
  your tool lets you resize the browser viewport. If it doesn't let you
  genuinely resize the rendering viewport (some browser-automation tools only
  resize the outer window, not the page content), say so explicitly in your
  report rather than guessing what the narrow layout looks like.
- **Open the browser console/network log if your tool supports it** and note
  any red errors you see on any page (ignore harmless third-party warnings).

## What to actually do (in order)

### Part 1 — Logged out, first impressions
1. Load the homepage fresh, logged out. Scroll the whole page.
2. Find the "Meet your Agent" section partway down — it should have a phone-
   shaped frame with a live animated demo inside it. Play with it: switch its
   internal tabs (Agent/Models/Balance), try subscribing to a model, try
   adding fake cash, watch the orb for at least 15-20 seconds. This is a
   sandboxed demo — nothing here is real, go ahead and click around freely.
3. Note the top navigation bar's buttons (should be something like "LOG IN"
   and a "SIGN UP" option) — check they look intentional and readable, not
   broken or misaligned.

### Part 2 — Log in
4. Log in with the credentials you're given (ask if you don't have any — see
   Ground Rules above).
5. After logging in, go back to the homepage. The top navigation should now
   look different than when logged out — look for something like "CLASSIC"
   and "OPEN APP" buttons instead of LOG IN/SIGN UP. Note what you see.
6. Click whichever button takes you into the main app (likely "OPEN APP").

### Part 3 — The new agent app, tab by tab
You should now be in an app-like experience with a bottom tab bar (or, if your
window is wide, a left sidebar) with 5 sections. Go through each:

7. **Agent tab** (should be the default/first tab, showing a big glowing
   colored ball/orb): Watch the orb for a solid 20-30 seconds without
   clicking anything. Does it look like it's genuinely moving/breathing/
   alive, or does it look static/frozen? Be honest and specific — describe
   what you actually see (does the shape change? does the color/light
   inside shift or swirl? or does it look like a still image?). Then try
   switching to a different model if there's a way to swipe or click between
   several orbs — does the newly-selected one look different in color/
   personality? Try the Pause button if there is one — the orb should
   visibly freeze/stop moving when paused, and resume when unpaused. Look at
   the activity feed / recent trades list below the orb — does it look
   populated and readable?
8. **Markets tab** (new — look for a tab icon that might look like a small
   bar chart): This should show live-ish crypto price data grouped by time
   window (like 5-minute, 15-minute, etc.). Try switching between different
   time windows if there are filter buttons/chips. Look for a countdown
   timer showing time until a market resolves — note the exact time it
   shows, WAIT at least 60-90 seconds without refreshing or navigating away,
   then look again: the countdown should have gone down by roughly the same
   amount of real time that passed (60-90 seconds), not by a wildly
   different amount. This is one of the specific bugs that was just fixed —
   please actually time this with a clock/stopwatch if you can, don't just
   eyeball it. Also look for a toggle or link to a broader "all markets"
   view (as opposed to the minute-by-minute view) — check that it shows a
   list of markets with prices, and that there's some kind of sort or filter
   and pagination (next page / previous page) if there are many results.
9. **Models tab**: Should show a way to browse different trading "agents" or
   "models" you could subscribe to, plus your own current one. Try opening
   a couple of them to see their detail views. Try the subscribe/equip flow
   on one if it's clearly sandboxed/fake (it should say something like
   "PAPER" or "demo" — if you're ever unsure whether something involves real
   money, stop and ask rather than guessing).
10. **Balance tab**: Should show a wallet-style balance, maybe a small chart,
    and a way to add fake test money. Try adding some test cash if there's a
    clearly-labeled test/demo mode indicator (look for the words "test" or
    "demo" near any payment-looking UI — do NOT enter real payment details
    anywhere).
11. **Profile tab**: This should now show YOUR actual logged-in account
    (your real name/email, not a fake placeholder like "Jackson" or "JF"
    if that's not who you logged in as). Look for sections with links to
    things like account plan/billing, connected trading accounts, settings,
    etc. Click into 2-3 of those links just to confirm they go somewhere
    real and don't 404 or crash — you don't need to change any settings
    there, just confirm the links work and note what each page looks like.

### Part 4 — Desktop layout check
12. If you can resize your browser window wider (roughly tablet/laptop width
    or more), do so while on any of the 5 tabs above. The bottom tab bar
    should be replaced by a left-side vertical strip with icons/labels for
    all 5 sections, and the main content should get noticeably more
    breathing room (not just stretched — actually re-laid-out). Click
    through a couple of the sidebar items to confirm they work the same way
    the bottom tabs did. Shrink the window back down and confirm the bottom
    tab bar returns and still has all 5 items without anything getting cut
    off or overlapping.

### Part 5 — The "classic" terminal + the redirect
13. Navigate directly to the site's root `/dashboard` path (you can usually
    do this by editing the URL directly, e.g. typing `<the-preview-url>/dashboard`
    into the address bar) — you should be automatically redirected into the
    same 5-tab app from Part 3, NOT into a dense data-table-style terminal.
14. Now navigate directly to `/dashboard/legacy` instead. This SHOULD show
    the old dense terminal-style dashboard (tables of numbers, a sidebar
    menu, etc. — a very different visual style from the app you just used).
    Look around it briefly — this is the "classic" mode being preserved, not
    something new to evaluate deeply.
15. **Specifically test the second fixed bug:** while inside that classic
    `/dashboard/legacy` terminal, find the site's logo/brand mark (usually
    top-left) and click it — you should STAY inside the classic terminal
    (still on a `/dashboard/...` URL), not get bounced into the new app. Then
    find a hamburger/menu icon (common on narrower windows) and open it —
    look for a "Dashboard" link inside that menu and click it — again, you
    should stay in the classic terminal, not get redirected to the new app.
    If either of these DOES bounce you into the new app, that's a bug — note
    it clearly.

### Part 6 — Wrap-up
16. Log out if there's a clear sign-out option, and confirm you land back on
    a logged-out view of the homepage without errors.

## Your report — please structure it exactly like this

**1. Overall verdict:** In 3-5 sentences, would you say this feels like a
polished, ready-to-launch update, or does it feel rough/unfinished? Be
direct.

**2. The orb — your honest subjective take:** Describe exactly what you saw
when you watched it idle for 20-30 seconds, and separately what you saw when
it was actively "trading" (Entering/Holding state). Does it read as "alive"
to you? This is the single most important subjective judgment in this whole
test — don't hedge, give a real opinion with specifics (what moved, what
didn't, how obvious the motion was).

**3. The two fixed bugs — did they hold up?**
   - Countdown timer: what did it show before waiting, what did it show
     after waiting ~60-90 real seconds, and did the two numbers make sense
     together?
   - Classic dashboard nav: did clicking the logo and the hamburger's
     "Dashboard" item both correctly keep you inside `/dashboard/legacy`?

**4. Bugs and rough edges found**, each with: which page/tab, what you did,
what you expected, what actually happened, and (if your tool supports it) a
screenshot or the exact error text from the console. Rank them
loosely by how bad they seem (breaks the experience vs. minor visual nit).

**5. Desktop vs. mobile layout:** did the sidebar/tab-bar switch work
correctly as you resized? Any overlap, cut-off text, or broken spacing at
either size? (If you genuinely could not test a narrow/phone-sized viewport
because your tool doesn't support real viewport resizing, say so plainly
instead of guessing.)

**6. Anything confusing:** as a first-time-feeling user, was there any moment
you didn't know what to do next, or any button/label that didn't make sense?

**7. Open questions for the team:** anything you couldn't determine safely or
weren't sure whether to test further.

Take your time — this is meant to be a real, unhurried walkthrough, not a
speed-run. Thank you.
