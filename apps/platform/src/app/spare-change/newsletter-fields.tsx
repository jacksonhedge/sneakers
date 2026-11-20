'use client'
import { US_STATES } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'

const sauce = 'var(--font-open-sauce), sans-serif'

/** The two things the newsletter needs besides an email: the person's state, and that they are 21 or older. */
export function NewsletterFields({ idPrefix, state, onState, adult, onAdult, stateMissing }: { idPrefix: string; state: string; onState: (v: string) => void; adult: boolean; onAdult: (v: boolean) => void; stateMissing: boolean }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-state`} className="sr-only">
        State
      </label>
      <select
        id={`${idPrefix}-state`}
        name="state"
        autoComplete="address-level1"
        value={state}
        onChange={(e) => onState(e.target.value)}
        aria-invalid={stateMissing || undefined}
        className="min-h-[3.25rem] w-full rounded-full px-6 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }}
      >
        <option value="">Your state</option>
        {US_STATES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 px-2 text-left text-lg font-semibold" style={{ fontFamily: sauce }}>
        <input type="checkbox" name="confirmed21" checked={adult} onChange={(e) => onAdult(e.target.checked)} aria-required="true" className="size-6 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ accentColor: NAVY }} />
        <span>I&apos;m 21 or older</span>
      </label>
    </>
  )
}
