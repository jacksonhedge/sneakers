# Blue Rebrand + New Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sneakers Terminal web app's emerald/terminal aesthetic with a royal-blue brand system (Peace Sans display + Open Sauce Sans body) and rebuild the site footer to a rich multi-column layout with an illustration band and a working newsletter field.

**Architecture:** Self-host two fonts via `next/font/local`; centralize color/font tokens in `globals.css`; do a mechanical accent-color swap across the app (emerald/green/lime → blue, with button text-contrast fixes and red preserved for "loss/down"); rebuild `footer.tsx` with a small new client component for the newsletter that reuses the existing `/api/waitlist` endpoint.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19, Tailwind CSS 4 (`@import "tailwindcss"`, no separate config — theme lives in `globals.css` `@theme inline`), pnpm.

## Global Constraints

- App lives at `apps/platform/`. All paths below are relative to the repo root `/Users/jeremyalbus/sneakers-trading`.
- **This is NOT stock Next.js** — `apps/platform/AGENTS.md` says read `node_modules/next/dist/docs/` before writing Next-specific code. This plan touches only client components + CSS + fonts, but heed that rule if a Next API surfaces.
- **No test runner** in this app (no `test` script). Verification = `pnpm exec tsc --noEmit`, targeted `grep`, and visual check via `pnpm dev`. `next build` is avoided in gates because it requires DB/Supabase env the local box may lack.
- Package manager is **pnpm**. Run commands from `apps/platform/` unless noted.
- Color tokens (copy verbatim): royal blue `#1B4DE4`, deep navy `#1E3A8A`, footer bg `#F4F6F9`.
- **Peace Sans** = display/headings only (`font-display`). **Open Sauce Sans** = body/UI/numbers (`font-sans`, the default). **Geist Mono and Inter are removed.**
- **Red stays red** wherever green/red encode up-vs-down / win-vs-loss. Only green/lime → blue.
- Footer links must point to **routes that exist**: `/markets`, `/venues`, `/dashboard`, `/pricing`, `/students`, `/college`, `/hardware`, `/login`. There are NO about/faq/privacy/terms pages — keep legal as text, not links.
- Branch: `feat/blue-rebrand-footer` (already created off `origin/main`).

---

### Task 1: Acquire and commit font files

**Files:**
- Create: `apps/platform/src/fonts/OpenSauceSans-Regular.woff2`
- Create: `apps/platform/src/fonts/OpenSauceSans-Medium.woff2`
- Create: `apps/platform/src/fonts/OpenSauceSans-SemiBold.woff2`
- Create: `apps/platform/src/fonts/OpenSauceSans-Bold.woff2`
- Create: `apps/platform/src/fonts/PeaceSans.<otf|ttf>` (extension depends on the zip contents)

**Interfaces:**
- Produces: five font files in `apps/platform/src/fonts/` that Task 2 loads via `next/font/local`. Filenames above are the contract — Task 2 references them exactly.

- [ ] **Step 1: Create the fonts directory and download Open Sauce Sans (verified live, HTTP 200)**

```bash
cd apps/platform
mkdir -p src/fonts
base="https://cdn.jsdelivr.net/npm/@fontsource/open-sauce-sans/files"
curl -fsSL "$base/open-sauce-sans-latin-400-normal.woff2" -o src/fonts/OpenSauceSans-Regular.woff2
curl -fsSL "$base/open-sauce-sans-latin-500-normal.woff2" -o src/fonts/OpenSauceSans-Medium.woff2
curl -fsSL "$base/open-sauce-sans-latin-600-normal.woff2" -o src/fonts/OpenSauceSans-SemiBold.woff2
curl -fsSL "$base/open-sauce-sans-latin-700-normal.woff2" -o src/fonts/OpenSauceSans-Bold.woff2
```

- [ ] **Step 2: Download and extract Peace Sans (dafont zip, verified live)**

```bash
cd apps/platform
curl -fsSL "https://dl.dafont.com/dl/?f=peace_sans" -o /tmp/peace_sans.zip
unzip -o /tmp/peace_sans.zip -d /tmp/peace_sans
# Find the font file (.otf or .ttf) and copy it in with a stable name:
found=$(find /tmp/peace_sans -iname '*.otf' -o -iname '*.ttf' | head -1)
ext="${found##*.}"
cp "$found" "src/fonts/PeaceSans.${ext}"
ls -la src/fonts/
```

- [ ] **Step 3: Verify every file is a real, non-empty font (not an HTML error page)**

```bash
cd apps/platform
file src/fonts/*    # expect "Web Open Font Format" / "OpenType" / "TrueType", NOT "HTML"
# All five must be > 1KB:
find src/fonts -type f -size -1k -print
```
Expected: `file` reports font types for all five; the size check prints nothing.
**If any file is HTML or missing:** STOP and ask the user to manually place the files in `apps/platform/src/fonts/` (Open Sauce Sans = SIL OFL from github.com/marcologous/open-sauce-fonts or fontsource; Peace Sans = dafont.com/peace-sans.font). Do not proceed with a broken font.

- [ ] **Step 4: Note the actual Peace Sans extension for Task 2**

```bash
ls apps/platform/src/fonts/PeaceSans.*
```
Record whether it is `.otf` or `.ttf` — Task 2 Step 1 must reference the real extension.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/fonts/
git commit -m "feat(fonts): self-host Open Sauce Sans + Peace Sans"
```

---

### Task 2: Wire fonts into layout and theme tokens

**Files:**
- Modify: `apps/platform/src/app/layout.tsx` (lines 2, 9-17, 57-61)
- Modify: `apps/platform/src/app/globals.css` (lines 13-18, 28-30)

**Interfaces:**
- Consumes: font files from Task 1.
- Produces: CSS vars `--font-open-sauce` and `--font-peace` on `<html>`; theme tokens `--font-sans`, `--font-display`, `--font-mono` resolving to those. Tailwind `font-sans` (default), `font-display`, and existing `font-mono` usages all render the new fonts. Task 6 uses `font-display` for the footer wordmark.

- [ ] **Step 1: Replace the font imports in `layout.tsx`**

Replace lines 2-17 (the `next/font/google` import and the `geistMono`/`inter` declarations) with:

```tsx
import localFont from "next/font/local";

const openSauce = localFont({
  variable: "--font-open-sauce",
  display: "swap",
  src: [
    { path: "../fonts/OpenSauceSans-Regular.woff", weight: "400", style: "normal" },
    { path: "../fonts/OpenSauceSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/OpenSauceSans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/OpenSauceSans-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const peaceSans = localFont({
  variable: "--font-peace",
  display: "swap",
  // NOTE: use the real extension recorded in Task 1 Step 4 (.otf or .ttf)
  src: [{ path: "../fonts/PeaceSans.otf", weight: "400", style: "normal" }],
});
```

- [ ] **Step 2: Apply the new variables to `<html>`**

Replace the `className` on the `<html>` element (was `` `${geistMono.variable} ${inter.variable} h-full antialiased` ``) with:

```tsx
className={`${openSauce.variable} ${peaceSans.variable} h-full antialiased`}
```

- [ ] **Step 3: Update the `@theme inline` block in `globals.css`**

Replace lines 16-17 (`--font-sans`/`--font-mono`) so the block reads:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-open-sauce);
  --font-display: var(--font-peace);
  --font-mono: var(--font-open-sauce);
}
```

- [ ] **Step 4: Update the hard-coded body `font-family` fallback in `globals.css`**

Replace the `font-family` line (line 30, currently `var(--font-inter), ...`) with:

```css
  font-family: var(--font-open-sauce), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/platform && pnpm exec tsc --noEmit
```
Expected: no errors (in particular, no remaining references to `Geist_Mono`/`Inter`).

- [ ] **Step 6: Visual check**

```bash
cd apps/platform && pnpm dev
```
Load `http://localhost:3000`. Confirm body text renders in Open Sauce (rounded, geometric — not Inter/Times). Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/platform/src/app/layout.tsx apps/platform/src/app/globals.css
git commit -m "feat(type): swap to Open Sauce Sans (body) + Peace Sans (display)"
```

---

### Task 3: Recolor theme tokens and body gradient (blue)

**Files:**
- Modify: `apps/platform/src/app/globals.css` (lines 3-11 root vars; lines 34-44 body gradient)

**Interfaces:**
- Produces: blue brand CSS vars and a blue-tinted body gradient. No JS interface; consumed visually.

- [ ] **Step 1: Replace the `:root` palette (lines 3-11)**

```css
:root {
  /* Royal-blue brand palette */
  --background: #ffffff;
  --foreground: #1a1f2c;
  --brand-blue: #1B4DE4;   /* primary brand / buttons / accents */
  --brand-navy: #1E3A8A;   /* logo + headings on light */
  --footer-bg: #F4F6F9;    /* footer panel background */
}
```

- [ ] **Step 2: Recolor the body gradient stops (lines 36-44) to blue/sky tints**

Replace the `linear-gradient(135deg, ...)` stops with:

```css
    linear-gradient(135deg,
      rgba(255,255,255,1)     0%,
      rgba(235, 241, 254, 1) 25%,    /* soft blue */
      rgba(255,255,255,1)    40%,
      rgba(224, 234, 255, 1) 60%,    /* sky tint */
      rgba(255,255,255,1)    75%,
      rgba(237, 242, 255, 1) 90%,    /* light cobalt */
      rgba(255,255,255,1)   100%
    );
```

- [ ] **Step 3: Confirm no `--wimbledon-*` references remain anywhere**

```bash
cd apps/platform && grep -rn "wimbledon" src/ --include="*.css" --include="*.tsx" --include="*.ts"
```
Expected: only the `@keyframes wimbledon-drift` / `animation: wimbledon-drift` lines in `globals.css` (the animation NAME is fine to keep). If any `--wimbledon-green`/`-purple`/`-cream` *variable* is still referenced in a `.tsx`/`.css`, replace it with a blue equivalent.

- [ ] **Step 4: Visual check**

```bash
cd apps/platform && pnpm dev
```
Load `http://localhost:3000`; confirm the drifting background now reads as faint blue, not cream/green. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/src/app/globals.css
git commit -m "feat(theme): blue brand tokens + blue body gradient"
```

---

### Task 4: Site-wide accent swap (emerald/green/lime → blue)

**Files (modify — non-exhaustive, the greps below are the source of truth):**
- `apps/platform/src/app/waitlist-form.tsx`, `landing-form.tsx`, `org-signup-form.tsx`, `page.tsx`
- `apps/platform/src/app/login/page.tsx`, `students/page.tsx`, `hardware/page.tsx`
- `apps/platform/src/app/horse-race-demo/**`, `apps/platform/src/components/market-icon.tsx`
- `apps/platform/src/components/leaderboard-table.tsx`, `leaderboard-race.tsx`, `avatar-defaults.ts`
- plus any other file the greps surface.

**Interfaces:**
- Produces: zero residual `emerald`/`lime` color usages and zero `green-` color utilities; blue buttons use `text-white`. No code interface; verified by grep.

- [ ] **Step 1: Fix button text-contrast FIRST (before the generic swap)**

Emerald is light so buttons used `text-black`; royal blue is dark and needs `text-white`. Run these targeted replacements across `src/` so the specific button patterns are handled before the blanket swap:

```bash
cd apps/platform
# macOS/BSD sed (-i ''). Order matters: specific patterns first.
grep -rl "bg-emerald-500 text-black" src/ | xargs sed -i '' 's/bg-emerald-500 text-black/bg-blue-600 text-white/g'
grep -rl "bg-emerald-400 text-black" src/ | xargs sed -i '' 's/bg-emerald-400 text-black/bg-blue-500 text-white/g'
grep -rl "bg-emerald-300 text-black" src/ | xargs sed -i '' 's/bg-emerald-300 text-black/bg-blue-500 text-white/g'
```

- [ ] **Step 2: Blanket swap the remaining accent colors to blue**

`emerald` and `lime` only ever appear as Tailwind colors, so a token replace is safe. `green-` (with the hyphen) only matches color utilities. This also handles opacity suffixes like `emerald-400/50`.

```bash
cd apps/platform
grep -rl "emerald" src/ | xargs sed -i '' 's/emerald/blue/g'
grep -rl "lime" src/ | xargs sed -i '' 's/lime/blue/g'
grep -rl "green-" src/ | xargs sed -i '' 's/green-/blue-/g'
```

- [ ] **Step 3: Map blue shade collisions from the lime/green swap**

`lime-500`/`green-500` → `blue-500` etc. is fine, but if a file used BOTH an emerald accent and a lime/green accent that now both became the same blue shade, nudge the secondary one for contrast. Inspect the category/leaderboard files specifically:

```bash
cd apps/platform
git diff src/components/market-icon.tsx src/components/leaderboard-table.tsx src/components/leaderboard-race.tsx src/lib/avatar-defaults.ts 2>/dev/null
```
For any sports/category icon that is now the same blue as an adjacent one, change the duplicate to a distinct blue shade (e.g. `blue-400` vs `blue-600` vs `blue-800`) so categories stay visually distinct. (Exact paths for the last two may differ — use the grep output from Step 5 to locate them.)

- [ ] **Step 4: Verify red is untouched (loss/down indicators)**

```bash
cd apps/platform && grep -rn "text-red-\|bg-red-\|red-300\|red-400" src/ | wc -l
```
Expected: a non-zero count, unchanged from before (we never touched red). Spot-check one P&L/error spot (e.g. `waitlist-form.tsx` `text-red-300` error line) still says red.

- [ ] **Step 5: Verify the swap is complete**

```bash
cd apps/platform
echo "emerald:"; grep -rn "emerald" src/ | wc -l    # expect 0
echo "lime:";    grep -rn "lime" src/ | wc -l        # expect 0
echo "green-:";  grep -rn "green-" src/ | wc -l      # expect 0
echo "black btn:"; grep -rn "bg-blue-[0-9]* text-black\|text-black bg-blue" src/   # expect no rows
```
Expected: emerald/lime/green- counts are 0; the black-on-blue grep prints nothing. Fix any stragglers by hand.

- [ ] **Step 6: Typecheck**

```bash
cd apps/platform && pnpm exec tsc --noEmit
```
Expected: no errors (className-only edits shouldn't affect types; this catches accidental edits to identifiers that happened to contain the swapped substrings).

- [ ] **Step 7: Visual check — sweep the main surfaces**

```bash
cd apps/platform && pnpm dev
```
Load and eyeball: `/` (hero + waitlist form CTA), `/login`, `/students`, `/pricing`, `/markets`. Confirm: primary buttons are royal blue with **white** text (readable), accents are blue, errors/losses still red. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A apps/platform/src
git commit -m "feat(theme): swap emerald/green/lime accents to royal blue site-wide"
```

---

### Task 5: Footer newsletter component

**Files:**
- Create: `apps/platform/src/app/footer-newsletter.tsx`

**Interfaces:**
- Produces: `export function FooterNewsletter()` — a client component rendering an email input + arrow submit button, POSTing `{ email, source: 'footer' }` to `/api/waitlist`. On `existing` → `router.push('/login?email=...')`; on new/admin success → inline "You're on the list." Task 6 imports and renders `<FooterNewsletter />`.

- [ ] **Step 1: Create the component**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FooterNewsletter() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      })
      const data = (await res.json().catch(() => ({}))) as { existing?: boolean }
      if (res.ok) {
        if (data.existing) {
          router.push(`/login?email=${encodeURIComponent(email.toLowerCase().trim())}`)
          return
        }
        setStatus('done')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="text-sm text-blue-700 font-medium">
        You&apos;re on the list — check your inbox.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-stretch border border-blue-900/15 rounded-md overflow-hidden bg-white max-w-xs">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="flex-1 px-3 py-2.5 text-sm text-blue-950 placeholder:text-blue-900/40 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        aria-label="Subscribe"
        className="bg-blue-600 text-white px-4 hover:bg-blue-700 transition disabled:opacity-50"
      >
        {status === 'loading' ? '…' : '→'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/platform && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/platform/src/app/footer-newsletter.tsx
git commit -m "feat(footer): newsletter component reusing /api/waitlist"
```

---

### Task 6: Rebuild the footer layout

**Files:**
- Modify: `apps/platform/src/app/footer.tsx` (full rewrite of the `Footer` component; keep the `SOCIAL_LINKS` array, lines 6-43, unchanged except hover colors)

**Interfaces:**
- Consumes: `FooterNewsletter` from Task 5; `SOCIAL_LINKS` (existing).
- Produces: the new `<Footer />` rendered by `layout.tsx` (no signature change). Illustration band is added in Task 7 (leave a clearly-marked placeholder div here).

- [ ] **Step 1: Update social icon hover colors (lines ~72)**

In the `SOCIAL_LINKS` map, change the anchor `className` hover from emerald (already swapped to blue in Task 4) and confirm it suits the light footer. Use:

```tsx
className="w-9 h-9 flex items-center justify-center rounded-md border border-blue-900/15 text-blue-900/60 hover:text-blue-600 hover:border-blue-600/40 transition"
```

- [ ] **Step 2: Replace the `Footer()` return (lines 49-115) with the new layout**

```tsx
export function Footer() {
  const year = new Date().getFullYear()
  const liveSocials = SOCIAL_LINKS.filter((s) => s.href)

  const productLinks = [
    { label: 'Markets', href: '/markets' },
    { label: 'Venues', href: '/venues' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Pricing', href: '/pricing' },
  ]
  const companyLinks = [
    { label: 'Students — 75% off', href: '/students' },
    { label: 'College', href: '/college' },
    { label: 'Hardware', href: '/hardware' },
    { label: 'Sign in', href: '/login' },
  ]

  return (
    <footer className="z-10 relative px-4 sm:px-6 lg:px-8 pb-6">
      <div className="max-w-6xl mx-auto rounded-2xl bg-[var(--footer-bg)] border border-blue-900/10 overflow-hidden">
        {/* Top: brand + link columns + newsletter */}
        <div className="px-6 sm:px-10 pt-12 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:pr-6">
            <div className="font-display text-2xl tracking-tight text-blue-900">
              Sneakers Terminal
            </div>
            <p className="text-sm text-blue-900/60 mt-3 leading-relaxed max-w-xs">
              A trading terminal for prediction markets — built for college students and recent grads.
            </p>
            <a
              href="mailto:hello@sneakersterminal.com"
              className="inline-block text-sm text-blue-700 hover:text-blue-900 transition mt-4"
            >
              hello@sneakersterminal.com
            </a>
          </div>

          {/* Product */}
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] text-blue-900/50 uppercase">
              Product
            </div>
            <ul className="mt-4 space-y-3">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-blue-900/70 hover:text-blue-700 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] text-blue-900/50 uppercase">
              Company
            </div>
            <ul className="mt-4 space-y-3">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-blue-900/70 hover:text-blue-700 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <div className="text-xs font-semibold tracking-[0.15em] text-blue-900/50 uppercase">
              Newsletter
            </div>
            <p className="text-sm text-blue-900/60 mt-4 mb-3 leading-relaxed">
              Get market drops, invites & early access.
            </p>
            <FooterNewsletter />
          </div>
        </div>

        {/* Illustration band — filled in Task 7 */}
        <div data-footer-illustration className="px-6 sm:px-10" />

        {/* Bottom bar */}
        <div className="border-t border-blue-900/10 px-6 sm:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {liveSocials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                aria-label={s.name}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-md border border-blue-900/15 text-blue-900/60 hover:text-blue-600 hover:border-blue-600/40 transition"
              >
                {s.icon}
              </a>
            ))}
          </div>
          <div className="text-xs text-blue-900/50 text-center sm:text-right">
            <div>© {year} Sneakers Terminal · Not a registered investment advisor. Educational use only.</div>
            <div className="mt-1">
              Trading prediction markets involves substantial risk of loss.
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Add the `FooterNewsletter` import at the top of `footer.tsx`**

```tsx
import Link from 'next/link'
import { FooterNewsletter } from './footer-newsletter'
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/platform && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Visual check + newsletter smoke test**

```bash
cd apps/platform && pnpm dev
```
Load `http://localhost:3000`, scroll to the footer. Confirm: light rounded panel, navy Peace-Sans wordmark, two link columns + newsletter, social row + disclaimer at the bottom. Submit a test email in the newsletter field and confirm it either shows "You're on the list" or routes to `/login` (existing email). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/platform/src/app/footer.tsx
git commit -m "feat(footer): multi-column blue footer with newsletter"
```

---

### Task 7: Generate and integrate the illustration band

**Files:**
- Create: `apps/platform/public/footer-illustration.png` (generated asset)
- Modify: `apps/platform/src/app/footer.tsx` (the `data-footer-illustration` placeholder div)

**Interfaces:**
- Consumes: the footer placeholder from Task 6.
- Produces: a wide blue-toned illustration rendered across the footer.

- [ ] **Step 1: Generate the illustration**

Use the available image-generation tool (`mcp__claude_ai_MCP_Connector__generate_image`, loaded via ToolSearch) with a prompt for a **wide, panoramic, monochrome cobalt-blue ink-wash / line-art illustration on a light off-white background**, motif: sneakers, stock-chart candlesticks, city skyline, and trophy/podium elements blended into a continuous scene (echoing the reference footer's blue landscape band). Aspect ratio ~ 16:5 (wide banner). Save the result to `apps/platform/public/footer-illustration.png`.

```bash
# After generation returns an asset URL, download it:
curl -fsSL "<generated-asset-url>" -o apps/platform/public/footer-illustration.png
file apps/platform/public/footer-illustration.png   # expect PNG image data
```
**Fallback if generation is unavailable:** replace the placeholder div in Step 2 with a CSS gradient band instead — `className="h-40 bg-gradient-to-t from-blue-100 to-transparent"` — and note this in the completion summary so the user can supply a real illustration later.

- [ ] **Step 2: Render the illustration in the footer**

Replace the placeholder `<div data-footer-illustration ... />` from Task 6 with:

```tsx
{/* Illustration band */}
<div className="relative w-full select-none pointer-events-none">
  <img
    src="/footer-illustration.png"
    alt=""
    aria-hidden
    className="w-full h-auto object-cover object-bottom opacity-90"
  />
</div>
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/platform && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Visual check**

```bash
cd apps/platform && pnpm dev
```
Load `http://localhost:3000`, scroll to the footer. Confirm the illustration spans the width, sits below the columns and above the bottom bar, and reads as on-brand blue. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add apps/platform/public/footer-illustration.png apps/platform/src/app/footer.tsx
git commit -m "feat(footer): blue illustration band"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

```bash
cd apps/platform && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Confirm the rebrand is clean**

```bash
cd apps/platform
# Old accents:
grep -rn "emerald\|lime\|green-" src/
# Old font refs (specific, to avoid matching words like "Interface"/"interval"):
grep -rn "next/font/google\|geist\|Geist\|--font-inter\|--font-geist\|Geist_Mono\|font-inter" src/
```
Expected: no rows from either grep (no leftover old accents or old font references). Investigate anything that prints.

- [ ] **Step 3: Cross-page visual sweep**

```bash
cd apps/platform && pnpm dev
```
Walk `/`, `/login`, `/students`, `/pricing`, `/markets`, `/dashboard`. Confirm: Peace Sans on headings, Open Sauce on body, royal-blue buttons with white text, red preserved for losses/errors, and the new footer on the apex/localhost. Stop the server.

- [ ] **Step 4: Push the branch (only when the user asks)**

```bash
git push -u origin feat/blue-rebrand-footer
```
Then offer a PR via the finishing-a-development-branch skill.

---

## Self-Review

- **Spec coverage:** Typography (T1–T2), color tokens + gradient (T3), full site-wide swap incl. semantic colors with red preserved (T4), newsletter reusing `/api/waitlist` (T5), multi-column footer with real-route links (T6), illustration band (T7), verification (T8). All spec sections mapped. ✔
- **Placeholder scan:** Font extension in T2 explicitly references the value recorded in T1 S4; illustration URL is a runtime value with a download step + fallback. No "TBD"/"handle errors"/vague steps. ✔
- **Type consistency:** `FooterNewsletter` exported in T5 is imported with the same name in T6; `SOCIAL_LINKS` reused as-is; CSS vars `--font-open-sauce`/`--font-peace`/`--brand-*`/`--footer-bg` defined in T2/T3 and consumed in T6. ✔
- **Known risk:** the blanket `sed` swap in T4 is broad; Steps 4–6 (red check, completeness grep, typecheck) are the guardrails. The macOS `sed -i ''` syntax is specified (BSD sed on darwin).
