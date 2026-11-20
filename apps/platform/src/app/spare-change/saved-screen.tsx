'use client'
import { useEffect, useRef } from 'react'
import { savedScreenCopy } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'
import { ShareBlock, type Joined } from '../launching-soon/waitlist-share'

const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const sauce = 'var(--font-open-sauce), sans-serif'
export const cardStyle = { background: CREAM, color: NAVY, border: `0.2rem solid ${NAVY}`, borderRadius: '1.5rem', boxShadow: `0.35rem 0.4rem 0 ${NAVY}`, fontFamily: sauce } as const

/** A check mark in a navy disc. Decoration: the heading next to it carries the meaning. */
export function CheckBadge() {
  return (
    <span aria-hidden="true" className="inline-flex size-14 shrink-0 items-center justify-center rounded-full" style={{ background: NAVY }}>
      <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke={CREAM} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  )
}

/** Focus a confirmation as soon as it appears, so a screen reader reads it and the keyboard starts from it. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => ref.current?.focus(), [])
  return ref
}

/**
 * The screen after a newsletter signup: "You're in", that the spot is saved, what happens next in three steps, then the person's own
 * link (only for someone new to the Sneakers waitlist, as before). It is the same for a first signup and a repeat one.
 * `emailSent` decides between "check your email" and "on its way shortly": it is true only when a welcome email really went out.
 */
export function NewsletterSaved({ name, emailSent, joined }: { name: string; emailSent: boolean; joined: Joined | null }) {
  const copy = savedScreenCopy({ name, emailSent })
  const ref = useFocusOnMount<HTMLDivElement>()
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div ref={ref} tabIndex={-1} role="status" className="flex w-full flex-col gap-4 px-6 py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={cardStyle}>
        <div className="flex items-center gap-4">
          <CheckBadge />
          <h2 className="text-[clamp(1.75rem,7vw,2.25rem)] leading-none [overflow-wrap:anywhere]" style={{ fontFamily: peace }}>
            {copy.heading}
          </h2>
        </div>
        <p className="text-lg font-semibold">{copy.body}</p>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest">What happens next</p>
          <ol className="mt-3 flex flex-col gap-3">
            {copy.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-base font-semibold">
                <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums" style={{ background: NAVY, color: CREAM }}>
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <ShareBlock joined={joined} newsletter />
    </div>
  )
}
