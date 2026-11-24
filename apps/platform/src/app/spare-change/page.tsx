import type { Metadata } from 'next'
import { EXAMPLE_TICKET, NEWSLETTER_NAME, NEWSLETTER_PITCH, NEWSLETTER_REWARDS, REFERRAL_OFFER_HEADING, REFERRAL_OFFER_STEPS, REFERRAL_OFFER_TERMS, SNEAKERS_LINE } from '@/lib/spare-change'
import { parseRefParam } from '@/lib/waitlist-referral'
import { BLUE, CREAM, NAVY, RED } from '../visuals'
import { PartnerFloat, PartnerRow } from './partner-float'
import { SpareChangeForm } from './spare-change-form'
import { ResponsiblePlay } from './responsible-play'
import { MoreStories, StoryFloat, StoryRow } from './story-float'

// The newsletter's own page: what it is, one example ticket, and one form that also puts the person on the Sneakers waitlist.
// Not indexed and not linked from the home page unless NEXT_PUBLIC_SPARE_CHANGE is on.
export const metadata: Metadata = { title: `${NEWSLETTER_NAME} · Sneakers`, description: 'A daily email of long-shot parlays, coming soon. 18+ only.', robots: { index: false } }

const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const sauce = 'var(--font-open-sauce), sans-serif'
// The newsletter's own lime (its email masthead), for the daily-reward pill.
const LIME = '#C9F73A'
const sticker = { fontFamily: peace, color: CREAM, WebkitTextStroke: `0.035em ${NAVY}`, paintOrder: 'stroke fill', textShadow: `0.06em 0.07em 0 ${NAVY}` } as const

export default async function SpareChangePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return (
    <main className="relative overflow-hidden" style={{ background: BLUE, color: CREAM, ['--field-bg' as string]: '#FFFFFF' }}>
      <PartnerFloat />
      <StoryFloat />
      <div className="relative z-10 mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-8 px-[max(1.25rem,5vw)] py-12 text-center">
      <a href="/" className="text-3xl" style={sticker}>
        Sneakers
      </a>
      <h1 className="max-w-4xl text-[clamp(2.25rem,10vw,5rem)] leading-[0.98]" style={sticker}>
        {NEWSLETTER_NAME}
      </h1>
      <div
        role="img"
        aria-label={`Example ticket: ${EXAMPLE_TICKET.buyIn} buy-in, ${EXAMPLE_TICKET.payout} payout`}
        className="w-full max-w-sm px-6 py-5"
        style={{ background: CREAM, color: NAVY, border: `0.2rem solid ${NAVY}`, borderRadius: '1.5rem', boxShadow: `0.35rem 0.4rem 0 ${NAVY}`, transform: 'rotate(-2deg)', fontFamily: sauce }}
      >
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: RED }}>
          Example ticket
        </p>
        <p className="mt-2 whitespace-nowrap text-[clamp(1.35rem,6.6vw,2.15rem)] leading-none tabular-nums" style={{ fontFamily: peace }}>
          {EXAMPLE_TICKET.buyIn} → {EXAMPLE_TICKET.payout}
        </p>
        <p className="mt-3 flex justify-between border-t-2 border-dashed pt-3 text-sm font-bold" style={{ borderColor: NAVY }}>
          <span>buy-in</span>
          <span>payout if it hits</span>
        </p>
      </div>
      <p className="max-w-md text-xl font-semibold" style={{ fontFamily: sauce }}>
        {NEWSLETTER_PITCH}
      </p>
      <p className="rounded-full px-4 py-2 text-base font-bold min-[400px]:px-6 min-[400px]:text-lg" style={{ background: LIME, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, transform: 'rotate(1.5deg)', fontFamily: sauce }}>
        {NEWSLETTER_REWARDS}
      </p>
      <PartnerRow />
      <SpareChangeForm refCode={parseRefParam(ref)} />
      <StoryRow />
      <MoreStories />
      <section aria-labelledby="refer-heading" className="w-full max-w-md px-6 py-6 text-left" style={{ background: CREAM, color: NAVY, border: `0.2rem solid ${NAVY}`, borderRadius: '1.5rem', boxShadow: `0.35rem 0.4rem 0 ${NAVY}`, transform: 'rotate(1deg)', fontFamily: sauce }}>
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: RED }}>
          Referrals
        </p>
        <h2 id="refer-heading" className="mt-2 text-[clamp(1.6rem,7vw,2.2rem)] leading-none" style={{ fontFamily: peace }}>
          {REFERRAL_OFFER_HEADING}
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {REFERRAL_OFFER_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-base font-semibold">
              <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums" style={{ background: NAVY, color: CREAM }}>
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t-2 border-dashed pt-3 text-sm font-semibold" style={{ borderColor: NAVY }}>
          {REFERRAL_OFFER_TERMS}
        </p>
      </section>
      <p className="max-w-md text-lg font-bold" style={{ fontFamily: sauce }}>
        {SNEAKERS_LINE}
      </p>
      <ResponsiblePlay />
      </div>
    </main>
  )
}
