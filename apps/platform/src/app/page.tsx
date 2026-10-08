import Image from 'next/image'
import type { Metadata, Viewport } from 'next'

// sneakersterminal.com is now the front door of Sneakers, the P2P payments app.
// The red is the app icon's own background, so the icon sits on the page seamlessly.
const RED = '#E03A3E'
const NAME = 'Sneakers, a Hedge Product'
const TAGLINE = 'Sending payments to your friends just became more fun.'

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

export default function LandingPage() {
  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-16 text-center"
      style={{ backgroundColor: RED }}
    >
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
        className="-mt-2 h-auto w-[min(68vw,400px)]"
      />
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">{NAME}</h1>
      <p className="mt-4 max-w-xl text-lg leading-snug text-white/90 sm:text-2xl">{TAGLINE}</p>
    </main>
  )
}
