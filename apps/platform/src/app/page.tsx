import Image from 'next/image'
import type { Metadata, Viewport } from 'next'

// sneakersterminal.com is now the front door of Sneakers, the P2P payments app.
// The red is the app icon's own background, so the icon sits on the page seamlessly.
const RED = '#E03A3E'
const CREAM = '#FFF3D6'
const NAVY = '#0B1E3F'
const NAME = 'Sneakers, a Hedge Product'
const LEAD = 'Sending payments to friends…'
const PUNCH = 'just became more fun.'
const TAGLINE = `${LEAD} ${PUNCH}`

export const metadata: Metadata = {
  title: 'Sneakers',
  description: TAGLINE,
  openGraph: {
    title: NAME,
    description: TAGLINE,
    url: 'https://sneakersterminal.com',
    siteName: 'Sneakers',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: NAME,
    description: TAGLINE,
  },
}

export const viewport: Viewport = {
  themeColor: RED,
}

// The punchline's letters bounce in one by one, then ripple every few seconds;
// the shoes bob. Reduced motion turns all of it off.
const MOTION = `
@keyframes sneakers-fade-up { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes sneakers-pop-in {
  0% { opacity: 0; transform: translateY(0.55em) rotate(-10deg) scale(0.7) }
  60% { opacity: 1; transform: translateY(-0.14em) rotate(4deg) scale(1.06) }
  100% { opacity: 1; transform: none }
}
@keyframes sneakers-ripple {
  0%, 72%, 100% { transform: none }
  82% { transform: translateY(-0.16em) rotate(-4deg) }
  91% { transform: translateY(0.03em) rotate(2deg) }
}
@keyframes sneakers-bob { 0%, 100% { transform: translateY(0) rotate(0deg) } 50% { transform: translateY(-9px) rotate(-1.5deg) } }
.sneakers-lead { animation: sneakers-fade-up 0.6s ease-out 0.25s both }
.sneakers-char { display: inline-block; opacity: 0; animation-name: sneakers-pop-in, sneakers-ripple;
  animation-duration: 0.65s, 3.4s; animation-timing-function: cubic-bezier(0.2, 0.9, 0.3, 1.4), ease-in-out;
  animation-fill-mode: forwards, none; animation-iteration-count: 1, infinite }
.sneakers-shoes { animation: sneakers-bob 3.6s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .sneakers-lead, .sneakers-char, .sneakers-shoes { animation: none !important; opacity: 1 !important; transform: none !important }
}
`

export default function LandingPage() {
  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-14 text-center"
      style={{ backgroundColor: RED }}
    >
      <style>{MOTION}</style>
      <Image
        src="/sneakers-wordmark.png"
        alt="Sneakers"
        width={694}
        height={278}
        priority
        className="h-auto w-[min(64vw,340px)]"
      />
      <Image
        src="/sneakers-icon.png"
        alt="Two blue high-top sneakers"
        width={1024}
        height={1024}
        priority
        className="sneakers-shoes -mt-2 h-auto w-[min(64vw,380px)]"
      />
      <h1 className="mt-2 text-xl font-semibold tracking-wide text-white/85 sm:text-2xl">{NAME}</h1>

      <p className="sneakers-lead mt-6 text-2xl font-semibold text-white sm:text-3xl">{LEAD}</p>
      <p
        className="mt-2 text-[clamp(2.6rem,10vw,5rem)] leading-[1.05]"
        style={{
          fontFamily: 'var(--font-peace), var(--font-open-sauce), sans-serif',
          color: CREAM,
          WebkitTextStroke: `2px ${NAVY}`,
          paintOrder: 'stroke fill',
          textShadow: `0 5px 0 ${NAVY}, 0 9px 0 rgba(11, 30, 63, 0.28)`,
        }}
      >
        <span className="sr-only">{PUNCH}</span>
        <span aria-hidden="true">
          {PUNCH.split(' ').map((word, w, words) => {
            // Letters are numbered across the whole line so the bounce runs left to right.
            const start = words.slice(0, w).reduce((n, x) => n + x.length + 1, 0)
            return (
              <span key={w}>
                {/* One word never breaks across lines; the spaces between words can. */}
                <span className="inline-block whitespace-nowrap">
                  {Array.from(word).map((ch, c) => (
                    <span
                      key={c}
                      className="sneakers-char"
                      style={{ animationDelay: `${0.7 + (start + c) * 0.05}s, ${1.6 + (start + c) * 0.05}s` }}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
                {w < words.length - 1 ? ' ' : null}
              </span>
            )
          })}
        </span>
      </p>
    </main>
  )
}
