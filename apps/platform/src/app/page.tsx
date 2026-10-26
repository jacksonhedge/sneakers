import Image from 'next/image'
import type { Metadata, Viewport } from 'next'

// sneakersterminal.com is the front door of Sneakers, the P2P payments app: one line, as big as the screen allows.
// The red is the app icon's own background; the letters are the brand's cream-and-navy stickers (the old punchline style).
const RED = '#E03A3E'
const CREAM = '#FFF3D6'
const NAVY = '#0B1E3F'
const NAME = 'Sneakers'
const POWERED_BY = 'Hedge Payments'
const HEADLINE = 'The fun way to pay your friends'
// How the line breaks: short lines read as a poster, not a sentence. Four on a phone (so the letters can be bigger), three wider.
const PHONE_LINES = ['The fun', 'way to', 'pay your', 'friends']
const WIDE_LINES = ['The fun way', 'to pay your', 'friends']

export const metadata: Metadata = {
  title: 'Sneakers',
  description: HEADLINE,
  openGraph: {
    title: NAME,
    description: HEADLINE,
    url: 'https://sneakersterminal.com',
    siteName: 'Sneakers',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: NAME,
    description: HEADLINE,
  },
}

export const viewport: Viewport = {
  themeColor: RED,
}

// One moment: each line is slapped on like a sticker, in order, and the shoes land last. Then nothing moves.
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
.sneakers-sticker { opacity: 0; transform: rotate(-12deg); animation: sneakers-land 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.95s forwards }
@media (prefers-reduced-motion: reduce) {
  .sneakers-line, .sneakers-sticker { animation: none !important; opacity: 1 !important }
  .sneakers-line { transform: none !important }
}
`

function Lines({ lines, className, sticker }: { lines: string[]; className: string; sticker: string }) {
  return (
    <span aria-hidden="true" className={className}>
      {lines.map((line, i) => (
        <span key={line} className="sneakers-line whitespace-nowrap" style={{ animationDelay: `${0.15 + i * 0.2}s` }}>
          {line}
          {i === lines.length - 1 ? (
            // The app icon's shoes, slapped onto the end of the last line like a sticker (the drawing has its own outline).
            <span className="sneakers-sticker ml-[0.12em] inline-block align-middle">
              <Image src="/sneakers-icon.png" alt="" width={1024} height={1024} priority className={`h-auto ${sticker}`} />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}

export default function LandingPage() {
  return (
    <main
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
      style={{
        backgroundColor: RED,
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left), 5vw)',
        paddingRight: 'max(1.25rem, env(safe-area-inset-right), 5vw)',
      }}
    >
      <style>{MOTION}</style>
      <header className="pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Image src="/sneakers-wordmark.png" alt="Sneakers" width={694} height={278} priority className="h-auto w-[clamp(7.5rem,22vw,11rem)]" />
      </header>

      <div className="flex flex-1 items-center py-10">
        <h1
          className="relative leading-[0.98] text-[clamp(2.75rem,17.5vw,5.5rem)] sm:text-[clamp(3rem,min(13.5vw,22svh),11rem)]"
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
          <Lines lines={PHONE_LINES} className="sm:hidden" sticker="w-[1em]" />
          <Lines lines={WIDE_LINES} className="hidden sm:block" sticker="w-[1.25em]" />
        </h1>
      </div>

      <footer className="flex justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
        <a href="https://hedgepayments.com" className="rounded-sm text-sm text-white/80 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-base">
          Powered by <span className="font-semibold">{POWERED_BY}</span>
        </a>
      </footer>
    </main>
  )
}
