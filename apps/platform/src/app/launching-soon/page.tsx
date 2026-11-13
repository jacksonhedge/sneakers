import type { Metadata } from 'next'
import { getSneakersWaitlistCount, publicCount } from '@/lib/sneakers-waitlist'
import { CREAM, NAVY, RED } from '../visuals'
import { parseRefParam } from '@/lib/waitlist-referral'
import { LaunchingForm } from './launching-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sneakers · Launching soon', description: 'Sneakers is launching soon. Join the waitlist.', robots: { index: false } }

const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const sauce = 'var(--font-open-sauce), sans-serif'

export default async function LaunchingSoonPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  // The real number of people on the list, shown only once it is big enough to mean something. Never padded.
  const count = publicCount(await getSneakersWaitlistCount())
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-[max(1.25rem,5vw)] py-12 text-center" style={{ background: RED, color: CREAM }}>
      <a href="/" className="text-3xl" style={{ fontFamily: peace, color: CREAM, WebkitTextStroke: `0.035em ${NAVY}`, paintOrder: 'stroke fill', textShadow: `0.06em 0.07em 0 ${NAVY}` }}>
        Sneakers
      </a>
      <h1 className="max-w-3xl text-[clamp(2.5rem,11vw,5.5rem)] leading-[0.98]" style={{ fontFamily: peace, color: CREAM, WebkitTextStroke: `0.035em ${NAVY}`, paintOrder: 'stroke fill', textShadow: `0.06em 0.07em 0 ${NAVY}` }}>
        Launching soon!
      </h1>
      <p className="max-w-md text-xl font-semibold" style={{ fontFamily: sauce }}>
        But here is the waitlist. Leave your email and we will tell you the moment Sneakers opens.
      </p>
      <LaunchingForm refCode={parseRefParam(ref)} />
      {count !== null ? (
        <p className="text-lg font-bold" style={{ fontFamily: sauce }}>
          {count.toLocaleString('en-US')} people are on the waitlist
        </p>
      ) : null}
      <a href="https://pay.sneakersterminal.com/" className="text-base underline" style={{ fontFamily: sauce }}>
        Already invited? Log in
      </a>
    </main>
  )
}
