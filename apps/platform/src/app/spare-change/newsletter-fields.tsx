'use client'
import { NAME_MAX_LENGTH, NEWSLETTER_MIN_AGE, US_STATES, parseAge, parseName } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'

const sauce = 'var(--font-open-sauce), sans-serif'
const field = 'min-h-[3.25rem] w-full rounded-full px-6 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const fieldStyle = { background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce } as const

export type NewsletterProblem = 'name' | 'age' | 'state'
export const newsletterProblemText: Record<NewsletterProblem, string> = {
  name: 'Add your name and try again.',
  age: 'Type your age as a number and try again.',
  state: 'Pick your state and try again.',
}

/**
 * The same checks the route makes, in the same order, so the person hears about a gap before anything is sent: a real age first, then
 * (18 and over only) a name and a state. Under 18 needs neither, because that person joins the Sneakers waitlist only.
 */
export function newsletterProblem(v: { name: string; state: string; age: string }): NewsletterProblem | null {
  const age = parseAge(v.age)
  if (age === null) return 'age'
  if (age < NEWSLETTER_MIN_AGE) return null
  if (!parseName(v.name)) return 'name'
  return v.state ? null : 'state'
}

/** Which message a 400 from the route maps to, or null when it is about the email. */
export const problemFromError = (error: string | undefined): NewsletterProblem | null => (error === 'invalid_name' ? 'name' : error === 'invalid_age' ? 'age' : error === 'invalid_state' ? 'state' : null)

/** The person's name, for the newsletter. */
export function NameField({ idPrefix, name, onName, invalid }: { idPrefix: string; name: string; onName: (v: string) => void; invalid: boolean }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-name`} className="sr-only">
        Name
      </label>
      <input id={`${idPrefix}-name`} name="name" type="text" autoComplete="name" maxLength={NAME_MAX_LENGTH} value={name} onChange={(e) => onName(e.target.value)} placeholder="Your name" aria-invalid={invalid || undefined} className={field} style={fieldStyle} />
    </>
  )
}

/** The person's state, and their age as a number they type (the newsletter is 18+). */
export function StateAgeFields({ idPrefix, state, onState, age, onAge, invalid }: { idPrefix: string; state: string; onState: (v: string) => void; age: string; onAge: (v: string) => void; invalid: NewsletterProblem | null }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-state`} className="sr-only">
        State
      </label>
      <select id={`${idPrefix}-state`} name="state" autoComplete="address-level1" value={state} onChange={(e) => onState(e.target.value)} aria-invalid={invalid === 'state' || undefined} className={field} style={fieldStyle}>
        <option value="">Your state</option>
        {US_STATES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <label htmlFor={`${idPrefix}-age`} className="sr-only">
        Age
      </label>
      <input id={`${idPrefix}-age`} name="age" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={3} value={age} onChange={(e) => onAge(e.target.value)} placeholder="Your age" aria-invalid={invalid === 'age' || undefined} className={field} style={fieldStyle} />
    </>
  )
}
