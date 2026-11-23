# Design review: spacing and formatting of the images on sneakersterminal.com/spare-change (look and measure only)

Paste everything below the line into the Chrome agent.

---

You're reviewing the layout of one public page: **https://sneakersterminal.com/spare-change** (the signup page for "Spare Change Millionaire", a daily email of long-shot parlays). Your job is to look at how the images sit on the page, measure the spacing, and hand back a precise list of fixes for a developer. You don't change anything on the site.

## Hard rules

1. **Look only.** Don't type into or submit the signup form. Don't click "Get the email".
2. **Don't touch the embedded X posts:** no Follow, Like, Reply, Copy link, "Read replies", and don't sign in to X.
3. **Don't click the partner logo tiles** (ProphetX, Kalshi, Polymarket, DraftKings, FanDuel, PrizePicks, Underdog). They are outbound partner links.
4. Don't sign in anywhere, accept cookie banners beyond "necessary only", or open any checkout, billing or payment page.
5. Spacing and formatting only. Don't suggest new copy, new content, colors or a different style. Keep the sticker look: cream cards, thick navy outlines, hard navy shadows, slight tilts.

## What's on the page

- **Center column:** the "Sneakers" wordmark, the "Spare Change Millionaire" title, an "Example ticket" card ($0.89 → $450,000), the pitch, the "$0.25 a day" pill, the signup form, then a section titled "More real long shots" (four cream cards in a grid), the "Refer a friend, get $5" card, and a footer with the 18+ and 1-800-GAMBLER lines.
- **Left edge (wide screens only, 1280px and up):** three real X posts in sticker frames, stacked in one column: Hard Rock Bet ($1 → $96,473.44, with two slip photos), B/R Betting ($1.10 into $532K), and a 2019 89-cent post with a caption under it ("It missed on the last leg"). They're scaled down to fit beside the page (bigger from 1536px up) and bob gently.
- **Right edge (wide screens):** seven square partner logo tiles in two staggered lanes, bobbing.
- **Narrower screens (under 1280px):** the logos become one small row under the "$0.25 a day" pill, and the three X posts stack below the form, above "More real long shots".

## Steps

1. Open the page. Wait until all three X posts have loaded (you can read "$96,473.44", "$532K" and ".89 cent"). Scroll the whole page once so lazy images load.
2. Check the page at each of these window widths, top to bottom, and take a full-page screenshot at each: **1920, 1536, 1440, 1280, 1024, 768, 390**. Resize the window for each one and reload.
3. At each width, run this in the page (DevTools console or your JavaScript tool) and keep the output with that width's notes:

```js
(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) } }
  const q = (s) => document.querySelector(s)
  const all = (s) => [...document.querySelectorAll(s)]
  const title = all('h1')[0]
  const centre = title ? title.parentElement : null
  return {
    viewport: innerWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
    title: r(title),
    centreColumn: r(centre),
    exampleTicket: r(q('[aria-label^="Example ticket"]')),
    form: r(q('form')),
    leftPosts: all('ul[aria-label="Real long shots on X"] > li').map(r),
    stackedPosts: all('#stories-heading ~ ul > li').map(r),
    moreCards: all('#more-stories-heading ~ ul > li').map(r),
    logoTiles: all('ul[aria-label="Sites we cover"] > li').map(r),
    footer: r(q('footer')),
  }
})()
```

4. At each width, look for these and note exactly what you see:
   - **Overlap:** does any X post, logo tile or card cover the title, the example ticket, the form, the grid or the referral card? Is anything cut off at the page edge or the bottom? Is there a sideways scrollbar (`pageScrollWidth` bigger than the viewport)?
   - **Left posts (1280px+):** is the column's top lined up with something sensible (the wordmark or the title)? Are the gaps between the three posts even? Is the caption under the third post close enough to belong to it? Can you read the dollar amounts and make out the slip photos, or are they too small? Does the left column look balanced against the logo tiles on the right (similar top, similar height, similar distance from the edge)?
   - **Logo tiles:** are the two lanes evenly spaced? Is any tile crowding the center column?
   - **"More real long shots" grid:** are the four cards the same height in each row? Are the gaps even? Is the grid's width lined up with the form above it? Do the tilts make the cards collide?
   - **Narrow screens (1024, 768, 390):** is the spacing between the logo row, the stacked X posts, the "More real long shots" grid and the referral card consistent? Are the stacked posts full width with the same side margins as the form? Does anything feel cramped or too far apart?
   - **Vertical rhythm:** list any section-to-section gap that is clearly bigger or smaller than the others.

## What to send back

1. One line: the worst problem you saw, and at which width.
2. **A numbered list of fixes, most important first (at most 12).** For each:
   - Width(s) where it shows
   - Element (use the names above, e.g. "left post 2", "More real long shots card 3", "logo tile 5")
   - What's wrong, with the measured numbers (e.g. "gap between left post 1 and 2 is 64px, between 2 and 3 is 40px")
   - The exact change you recommend, in pixels or relative terms (e.g. "make both gaps 32px", "move the left column top to y≈130 to line up with the title", "scale the left posts up about 15% at 1440px", "cap the grid at the form's width, 448px")
3. The JavaScript output for each width.
4. The screenshots, labeled by width.

Then stop. Don't change anything, and don't open any other page.
