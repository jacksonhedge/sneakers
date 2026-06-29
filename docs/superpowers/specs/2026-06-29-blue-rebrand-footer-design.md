# Blue Rebrand + New Footer — Design

**Date:** 2026-06-29
**App:** `apps/platform` (Next.js 16, App Router, React 19, Tailwind CSS 4)
**Branch:** `feat/blue-rebrand-footer`

## Goal

Replace the Sneakers Terminal web app's emerald/terminal aesthetic with a royal-blue
brand system using the **Peace Sans** (display) + **Open Sauce Sans** (body) typefaces,
and rebuild the site footer to match a rich multi-column reference layout (brand +
link columns + newsletter + illustration band + bottom bar).

Inspiration: image 1 (Open Sauce + Peace Sans on a vivid cobalt field) and image 2
("Blue Heritage" multi-column footer with a monochrome-blue illustration band).

## Decisions (locked)

- **Color scope:** Full blue rebrand site-wide (not just the footer).
- **Peace Sans:** display/headings only. **Open Sauce Sans** for everything else incl.
  numbers. **Geist Mono is dropped.**
- **Footer illustration:** generate a blue-toned, ink-wash illustration band.
- **Newsletter:** reuse the existing `/api/waitlist` handler (`source: 'footer'`).
- **Semantic colors:** shift green/lime to blue too. EXCEPTION: where green/red encode
  up-vs-down / win-vs-loss, green→blue but **red stays red** to preserve directional
  contrast. Pure category colors (sports icons, avatar defaults) go blue outright.
- **Recolor, don't restructure:** layouts unchanged; dark hero stays dark (photo
  overlay) with its accents recolored to blue.

## 1. Typography

Self-hosted via `next/font/local` (neither font is on Google Fonts).

| Role | Font | License | CSS var | Tailwind |
|------|------|---------|---------|----------|
| Display / headings | Peace Sans | Free (personal + commercial, HelloBenze) | `--font-peace` | `font-display` |
| Body / UI / numbers | Open Sauce Sans | SIL OFL 1.1 | `--font-open-sauce` | `font-sans` (default) |

Implementation notes:
- Place font files in `apps/platform/src/fonts/`. Download during implementation;
  if a download is blocked, ask the user to drop the files in.
- Open Sauce Sans: ship at least Regular(400), Medium(500), SemiBold(600), Bold(700).
- Peace Sans: single display weight (all-caps-leaning).
- `layout.tsx`: import both via `next/font/local`, apply variables to `<html>`,
  set `<body>` to `font-sans` (Open Sauce). Remove `Geist_Mono` and `Inter` imports.
- In `globals.css` `@theme inline`: set `--font-sans: var(--font-open-sauce)`,
  `--font-display: var(--font-peace)`, and **`--font-mono: var(--font-open-sauce)`**
  so existing `font-mono` usages render Open Sauce without per-file edits.
- Apply `font-display` to hero headlines, section titles, and the footer wordmark.

## 2. Color tokens

Define once in `globals.css` `:root` / `@theme`, then swap utilities across the app.

| Token | Hex | Use |
|-------|-----|-----|
| `--brand-blue` | `#1B4DE4` | primary brand / buttons / accents (≈ blue-600/700) |
| `--brand-navy` | `#1E3A8A` | logo + headings on light (blue-900) |
| `--footer-bg` | `#F4F6F9` | footer panel background |
| white on blue | `#FFFFFF` | button/CTA text on blue fills |
| light tints | blue-100/200 | soft fills, illustration tint |

- Replace the wimbledon cream/green/purple body-gradient drift with blue/sky tints
  (keep the same `wimbledon-drift` animation mechanics; just recolor the stops).
- Remove/replace `--wimbledon-*` vars.

## 3. Site-wide swap

Mechanical recolor across the files using the old accent (top offenders):
`waitlist-form.tsx`, `landing-form.tsx`, `org-signup-form.tsx`, `app/page.tsx`,
`login/page.tsx`, `students/page.tsx`, `hardware/page.tsx`,
`horse-race/horse-race-lobby.tsx`, plus `market-icon.tsx`, `leaderboard-table.tsx`,
`leaderboard-race.tsx`, `avatar-defaults.ts`, and any other `emerald-*` / `green-*` /
`lime-*` references.

Mapping:
- `emerald-500` → `blue-600`, `emerald-400` → `blue-500`, `emerald-300` → `blue-400`,
  `emerald-300/80` etc. → blue equivalents at the same opacity.
- `green-*` / `lime-*` category colors → blue shades.
- **Not pure find/replace:**
  - Emerald buttons use `text-black` (emerald is light). Royal blue is dark → flip to
    `text-white` on blue fills to preserve contrast.
  - Up/down / win/loss pairs: green→blue, **red stays red**.
- Keep `stone-950` / dark backgrounds and all layout/spacing as-is.

Verification: after the swap, grep for residual `emerald`, `lime`, and `wimbledon`
should return only intentional matches (ideally zero).

## 4. Footer redesign

File: `apps/platform/src/app/footer.tsx`. Light rounded panel, navy text, image-2 layout.

**Row 1 — columns:**
- **Brand:** "Sneakers Terminal" wordmark (`font-display`, navy) + tagline
  ("A trading terminal for prediction markets.") + contact email.
- **PRODUCT / COMPANY / SUPPORT** link columns. **Only real, live routes** — confirm
  which exist before linking (known: Markets, Venues, Dashboard, `/students`, `/login`).
  Drop dead links rather than invent pages.
- **NEWSLETTER:** short blurb + email input + arrow submit button. New small client
  component `FooterNewsletter` that POSTs to `/api/waitlist` with
  `{ email, source: 'footer' }`. Inline success state ("You're on the list"); existing
  emails route to `/login?email=…` (mirrors `waitlist-form.tsx` behavior). No referral /
  account-type / success-card complexity in the footer variant.

**Row 2 — illustration band:** full-width blue-toned ink-wash illustration
(sneakers / markets / charts motif), generated to match image 2's monochrome-blue style.
Stored under `apps/platform/public/`.

**Row 3 — bottom bar:** social icons (X, Instagram, TikTok, Discord — only render rows
with a real href, per existing pattern), © year, "Not a registered investment advisor"
+ risk disclaimer, legal links (only if those routes exist).

## 5. Risks / dependencies

- **Font files** must be sourced (download or user-provided). Blocks typography work.
- **Illustration generation** — style match to image 2; iterate if first pass is off.
- **Contrast regressions** from the button text-black→text-white flip — spot-check CTAs.
- Broad file surface (~15+ files) — do on the branch, user reviews before merge.

## Out of scope

- Restructuring any page layout (recolor only).
- New routes/pages for footer links that don't already exist.
- iOS app (terminal/Robinhood aesthetic there is unaffected).
