import Image from 'next/image'
import type { Metadata, Viewport } from 'next'
import { FunLink } from './fun-link'
import { Phone } from './phone'
import { BLUE, GroupVisual, PaidVisual, RequestVisual, RoundUpsVisual, SplitVisual } from './visuals'
import { Squish } from './squish'
import { Wordmark } from './wordmark'

// sneakersterminal.com is the front door of Sneakers, the P2P payments app: one line, as big as the screen allows.
// The red is the app icon's own background; the letters are the brand's cream-and-navy stickers (the old punchline style).
const RED = '#E03A3E'
const CREAM = '#FFF3D6'
const NAVY = '#0B1E3F'
const POWERED_BY = 'Hedge Payments'
// Where Sign up goes while Sneakers is launching soon: the waitlist page. (Log in still goes to the app's sign-in for invited testers.)
const SIGN_UP_URL = '/launching-soon'
const SIGN_IN_URL = 'https://pay.sneakersterminal.com/'
const HEADLINE = 'Paying your friends back should be fun!'
const SUBLINE = 'Sneakers is the fun way to pay your friends.'
// What a text or a post shows as the link preview (with opengraph-image.png and twitter-image.png).
const SHARE_TITLE = 'Sneakers: the fun way to split payments with friends'
const SHARE_DESCRIPTION = 'Pay friends back, split the bill, and keep one tab for the trip. The fun way to split payments with friends.'
// How the line breaks: short lines read as a poster, not a sentence. Four on a phone (so the letters can be bigger), three wider.
const PHONE_LINES = ['Paying', 'your', 'friends', 'back', 'should', 'be', 'fun!']
const WIDE_LINES = ['Paying your', 'friends back', 'should be', 'fun!']

export const metadata: Metadata = {
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    url: 'https://sneakersterminal.com',
    siteName: 'Sneakers',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: RED,
}

// Each line is slapped on like a sticker, in order, and the shoes land last; then every few seconds a ripple runs through the
// letters, one after another (the old punchline's bounce). Every letter is squishy too (squish.tsx). Reduced motion turns the
// ripple off and the squish into a small pop.
const MOTION = `
@keyframes sneakers-stamp {
  0% { opacity: 0; transform: scale(1.18) rotate(-3deg) }
  55% { opacity: 1; transform: scale(0.97) rotate(0.6deg) }
  100% { opacity: 1; transform: none }
}
@keyframes sneakers-land {
  0% { opacity: 0; transform: translateY(-40%) scale(1.3) rotate(-30deg) }
  60% { opacity: 1; transform: translateY(4%) scale(0.95) rotate(-10deg) }
  100% { opacity: 1; transform: rotate(-12deg) }
}
.sneakers-line { display: block; opacity: 0; transform-origin: left center; animation: sneakers-stamp 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards }
.sneakers-sticker { position: relative; z-index: 0; pointer-events: none; opacity: 0; transform: rotate(-12deg); animation: sneakers-land 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.95s forwards }
@keyframes sneakers-ripple {
  0% { transform: none }
  6% { transform: translateY(-0.14em) rotate(-5deg) }
  12% { transform: translateY(0.02em) rotate(1.5deg) }
  18%, 100% { transform: none }
}
.sneakers-phone { opacity: 0; animation: sneakers-rise 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.1) 1.2s forwards }
@keyframes sneakers-rise { 0% { opacity: 0; transform: translateY(8%) rotate(10deg) } 100% { opacity: 1; transform: rotate(6deg) } }
.sneakers-char { display: inline-block; animation: sneakers-ripple 5.5s ease-in-out infinite }
.sq { display: inline-block; position: relative; z-index: 1; transform-origin: 50% 100%; cursor: pointer }
svg [data-sq] { transform-box: fill-box; transform-origin: 50% 100% }
.fun-btn { transition: transform 0.16s cubic-bezier(0.3, 1.6, 0.5, 1), box-shadow 0.16s ease-out; will-change: transform; -webkit-tap-highlight-color: transparent }
.fun-btn:hover { transform: translate(-0.06rem, -0.2rem) rotate(-1.5deg) scale(1.04); box-shadow: 0.4rem 0.55rem 0 var(--fun-shadow, #0B1E3F) !important }
.fun-btn:active { transform: translate(0.12rem, 0.2rem) scale(0.95, 0.92); box-shadow: 0 0 0 var(--fun-shadow, #0B1E3F) !important; transition-duration: 0.05s }
@keyframes fun-wiggle { 0%, 100% { transform: none } 25% { transform: rotate(-4deg) scale(1.06) } 60% { transform: rotate(3deg) scale(1.06) } }
.fun-btn:hover .fun-label { animation: fun-wiggle 0.45s ease-in-out }
.fun-link { display: inline-block; transition: transform 0.16s cubic-bezier(0.3, 1.6, 0.5, 1) }
.fun-link:hover { transform: translateY(-0.12em) rotate(-2deg) scale(1.06) }
.fun-link:active { transform: scale(0.94, 0.9) }
@media (prefers-reduced-motion: reduce) {
  .fun-link, .fun-link:hover, .fun-link:active, .fun-btn:hover .fun-label { transform: none !important; animation: none !important; transition: none }
  .fun-btn, .fun-btn:hover, .fun-btn:active { transform: none !important; transition: none }
  .sneakers-line, .sneakers-sticker, .sneakers-char, .sneakers-phone { animation: none !important; opacity: 1 !important }
  .sneakers-line { transform: none !important }
}
`

// The word FUN stands apart: navy letters with a cream outline, the headline's colours turned inside out.
const FUN_STYLE = { color: NAVY, WebkitTextStroke: `0.035em ${CREAM}`, textShadow: `0.06em 0.07em 0 ${CREAM}` } as const
const isFun = (line: string, at: number): boolean => {
  const m = /fun!?/i.exec(line)
  return m !== null && at >= m.index && at < m.index + m[0].length
}

function Lines({ lines, className, sticker, id }: { lines: string[]; className: string; sticker: string; id: string }) {
  // Letters are numbered across all the lines, so the ripple runs left to right and top to bottom.
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length, 0))
  return (
    <span aria-hidden="true" className={className}>
      {lines.map((line, i) => (
        <span key={line} className="sneakers-line whitespace-nowrap" style={{ animationDelay: `${0.15 + i * 0.2}s` }}>
          {Array.from(line).map((ch, c) =>
            ch === ' ' ? (
              ' '
            ) : (
              <span key={c} className="sq" data-sq={`${id}-${starts[i] + c}`}>
                <span className="sneakers-char" style={{ animationDelay: `${1.7 + (starts[i] + c) * 0.035}s`, ...(isFun(line, c) ? FUN_STYLE : {}) }}>
                  {ch}
                </span>
              </span>
            ),
          )}
          {i === lines.length - 1 ? (
            // The app icon's shoes, slapped onto the end of the last line like a sticker (the drawing has its own outline).
            <span className="sneakers-sticker ml-[0.12em] inline-block align-middle">
              <Image src="/sneakers-shoes-s.png" alt="" width={1024} height={1024} priority className={`h-auto ${sticker}`} />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}

const TONES = {
  cream: { bg: CREAM, fg: NAVY },
  blue: { bg: BLUE, fg: CREAM },
  red: { bg: RED, fg: CREAM },
} as const

// One thing the app does: a short headline, one plain sentence and a drawing. The drawing swaps sides every other section.
function Feature({ tone, flip, visual, title, body }: { tone: keyof typeof TONES; flip?: boolean; visual: React.ReactNode; title: string; body: string }) {
  const { bg, fg } = TONES[tone]
  return (
    <section className="px-[max(1.25rem,5vw)] py-16 sm:py-24" style={{ background: bg, color: fg }}>
      <div className={`mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-20 ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <h2 className="text-4xl leading-[1.05] sm:text-6xl" style={{ fontFamily: 'var(--font-peace), var(--font-open-sauce), sans-serif' }}>
            {title}
          </h2>
          <p className="mt-5 max-w-md text-lg sm:text-xl" style={{ fontFamily: 'var(--font-open-sauce), sans-serif', opacity: 0.9 }}>
            {body}
          </p>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  return (
    <main>
      <section
      aria-label="Sneakers" className="relative flex min-h-[100svh] flex-col overflow-hidden"
      style={{
        backgroundColor: RED,
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left), 5vw)',
        paddingRight: 'max(1.25rem, env(safe-area-inset-right), 5vw)',
      }}
    >
      <style>{MOTION}</style>
      <header className="flex items-center justify-between pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Squish className="block w-[clamp(7.5rem,22vw,11rem)]">
          <Wordmark className="h-auto w-full" />
        </Squish>
        <nav aria-label="Account" className="flex items-center gap-3 text-base font-bold" style={{ fontFamily: 'var(--font-open-sauce), sans-serif' }}>
          <a href={SIGN_IN_URL} className="fun-link rounded-full px-4 py-2 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ color: CREAM }}>
            Log in
          </a>
          <FunLink href={SIGN_UP_URL} className="rounded-full px-5 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: CREAM, color: NAVY, border: `0.15rem solid ${NAVY}`, boxShadow: `0.15rem 0.2rem 0 ${NAVY}` }}>
            Sign up
          </FunLink>
        </nav>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-10 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex flex-col items-start gap-8 lg:min-w-0 lg:flex-1">
          <h1
            className="relative leading-[0.98] text-[clamp(2.75rem,17.5vw,5.5rem)] sm:text-[clamp(3rem,min(13.5vw,22svh),11rem)] lg:text-[clamp(3rem,min(8vw,16svh),8rem)]"
            style={{
              fontFamily: 'var(--font-peace), var(--font-open-sauce), sans-serif',
              color: CREAM,
              WebkitTextStroke: `0.035em ${NAVY}`,
              paintOrder: 'stroke fill',
              textShadow: `0.06em 0.07em 0 ${NAVY}`,
            }}
          >
            <span className="sr-only">{HEADLINE}</span>
            {/* Each line nearly fills the width; on a wide, short screen the height is the limit, so every line always fits. */}
            <Squish follow>
              <Lines id="p" lines={PHONE_LINES} className="sm:hidden" sticker="w-[1em]" />
              <Lines id="w" lines={WIDE_LINES} className="hidden sm:block" sticker="w-[1.25em]" />
            </Squish>
          </h1>
          <p className="max-w-[24rem] text-xl font-semibold" style={{ color: CREAM, fontFamily: 'var(--font-open-sauce), sans-serif' }}>
            {SUBLINE}
          </p>
          <FunLink
            shoes
            href={SIGN_UP_URL}
            className="sneakers-cta inline-flex min-h-[3.25rem] items-center rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: 'var(--font-open-sauce), sans-serif' }}
          >
            Sign up
          </FunLink>
        </div>
        <Phone className="shrink-0 lg:mx-0" />
      </div>

      </section>

      <Feature tone="cream" visual={<PaidVisual />} title="Pay back in a few taps" body="Pick a friend, type the amount, add a note. It's done before the waiter is back with the card machine." />
      <Feature tone="blue" flip visual={<RequestVisual />} title="Ask without the awkward" body="Send a request with a note that sounds like you. They tap once to pay, and nobody has to say it out loud." />
      <Feature tone="cream" visual={<SplitVisual />} title="Split anything" body="Dinner, rides, the rental house. Pick who's in, and everyone gets their share. No spreadsheet required." />
      <Feature tone="red" flip visual={<GroupVisual />} title="One tab for the whole trip" body="Make a group, keep one running tally, and settle up when you're home. Everyone sees the same numbers." />
      <Feature tone="cream" visual={<RoundUpsVisual />} title="Round-ups: spare change adds up" body="Every payment you send rounds up to the next dollar. The spare change adds up and moves into your balance once it reaches the amount shown. Pause any time." />

      <section className="px-[max(1.25rem,5vw)] py-20 text-center" style={{ background: NAVY, color: CREAM }}>
        <h2 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-6xl" style={{ fontFamily: 'var(--font-peace), var(--font-open-sauce), sans-serif' }}>
          Paying back is the boring part. We fixed that.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg opacity-80" style={{ fontFamily: 'var(--font-open-sauce), sans-serif' }}>
          Everything in Sneakers is play money for now, so you can try it with your friends and nothing real is on the line.
        </p>
        <FunLink
          shoes
          href={SIGN_UP_URL}
          className="mt-8 inline-flex min-h-[3.5rem] items-center rounded-full px-10 text-xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${CREAM}`, boxShadow: `0.25rem 0.3rem 0 ${RED}`, ['--fun-shadow' as string]: RED, fontFamily: 'var(--font-open-sauce), sans-serif' }}
        >
          Sign up
        </FunLink>
      </section>

      <footer className="px-[max(1.25rem,5vw)] py-10 text-sm" style={{ background: RED, color: CREAM, fontFamily: 'var(--font-open-sauce), sans-serif' }}>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
          <a href="https://pay.sneakersterminal.com/rules" className="fun-link underline-offset-4 hover:underline">Community rules</a>
          <a href="https://pay.sneakersterminal.com/privacy" className="fun-link underline-offset-4 hover:underline">Privacy</a>
          <a href="https://pay.sneakersterminal.com/terms" className="fun-link underline-offset-4 hover:underline">Terms</a>
        </nav>
        <p className="mt-5 max-w-2xl opacity-85">
          Sneakers is a Hedge, Inc. product. For now everything in the app is play money. Sign-up is open to invited testers while we get ready.
        </p>
        <a href="https://hedgepayments.com" className="mt-5 inline-block rounded-sm text-white/80 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Powered by <span className="font-semibold">{POWERED_BY}</span>
        </a>
      </footer>
    </main>
  )
}
