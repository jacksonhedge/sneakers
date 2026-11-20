import type { Metadata } from 'next'
import { CLAIM_COPY } from '@/lib/spare-change-claim'
import { NEWSLETTER_NAME } from '@/lib/spare-change'
import { BLUE, CREAM, NAVY } from '../../visuals'
import { ClaimPanel } from './claim-panel'

// The page behind the button in the welcome email: one field for a Venmo username. Reached only with the person's own link (`?t=`).
// Never indexed, and no referrer leaves it, because the address holds the token. The panel asks /api/spare-change-claim what to show.
export const metadata: Metadata = { title: `${CLAIM_COPY.heading} · ${NEWSLETTER_NAME}`, robots: { index: false, follow: false }, referrer: 'no-referrer' }

const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const sticker = { fontFamily: peace, color: CREAM, WebkitTextStroke: `0.035em ${NAVY}`, paintOrder: 'stroke fill', textShadow: `0.06em 0.07em 0 ${NAVY}` } as const

export default async function SpareChangeClaimPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-[max(1.25rem,5vw)] py-12 text-center" style={{ background: BLUE, color: CREAM }}>
      <a href="/spare-change" className="max-w-full text-[clamp(1.5rem,6.5vw,2.25rem)] leading-none" style={sticker}>
        {NEWSLETTER_NAME}
      </a>
      <ClaimPanel token={typeof t === 'string' ? t : null} />
    </main>
  )
}
