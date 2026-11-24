'use client'
import { NAME_MAX_LENGTH, SIGNUP_FIELD_PROBLEM, US_STATES, todayEastern, type SignupField } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'

const sauce = 'var(--font-open-sauce), sans-serif'
export const fieldClass = 'min-h-[3.25rem] w-full rounded-full px-6 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
// The fill can be set per page with --field-bg (the newsletter page uses white); cream everywhere else.
export const fieldStyle = { background: `var(--field-bg, ${CREAM})`, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce } as const
export const buttonClass = 'inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-70'
export const buttonStyle = { background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce } as const

/** What is wrong with each field, by field. Empty when nothing is. */
export type Problems = Partial<Record<SignupField, string>>

/** Which field a 400 from the route is about. */
export function problemsFromError(error: string | undefined): Problems {
  const field = ({ invalid_name: 'name', invalid_email: 'email', invalid_state: 'state', invalid_birthday: 'birthday' } as const)[error ?? '']
  return field ? { [field]: SIGNUP_FIELD_PROBLEM[field] } : {}
}

/** Move the cursor to the first field with a problem, in the order the fields sit on the page. */
export function focusFirstProblem(idPrefix: string, problems: Problems, order: readonly SignupField[]) {
  const first = order.find((f) => problems[f])
  if (first) document.getElementById(`${idPrefix}-${first}`)?.focus()
}

/** The message under a field: read out when it appears, and tied to its field with aria-describedby. */
export function FieldError({ id, text }: { id: string; text: string | undefined }) {
  if (!text) return null
  return (
    <p id={id} role="alert" className="-mt-1 flex items-center gap-2 self-start rounded-2xl px-4 py-1.5 text-left text-base font-bold" style={{ background: CREAM, color: NAVY, fontFamily: sauce }}>
      <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: NAVY, color: CREAM }}>
        !
      </span>
      {text}
    </p>
  )
}

/** A small turning ring for a button that is working. Still for people who ask for less motion. */
export function Spinner() {
  return <span aria-hidden="true" className="inline-block size-5 rounded-full border-[0.2rem] border-current border-r-transparent motion-safe:animate-spin" />
}

/** The person's name, for the newsletter. */
export function NameField({ idPrefix, name, onName, error }: { idPrefix: string; name: string; onName: (v: string) => void; error?: string }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-name`} className="sr-only">
        Name
      </label>
      <input id={`${idPrefix}-name`} name="name" type="text" autoComplete="name" maxLength={NAME_MAX_LENGTH} value={name} onChange={(e) => onName(e.target.value)} placeholder="Your name" aria-invalid={error ? true : undefined} aria-describedby={error ? `${idPrefix}-name-error` : undefined} className={fieldClass} style={fieldStyle} />
      <FieldError id={`${idPrefix}-name-error`} text={error} />
    </>
  )
}

/** Optional: the name of whoever told them about the newsletter. Shown with its label, because it is the one box people may skip. */
export function ReferrerNameField({ idPrefix, value, onValue }: { idPrefix: string; value: string; onValue: (v: string) => void }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-referrer`} className="-mb-1 self-start px-2 text-left text-base font-bold" style={{ fontFamily: sauce }}>
        Who referred you? <span className="font-normal">(optional)</span>
      </label>
      <input id={`${idPrefix}-referrer`} name="referrerName" type="text" autoComplete="off" maxLength={NAME_MAX_LENGTH} value={value} onChange={(e) => onValue(e.target.value)} placeholder="Their name" className={fieldClass} style={fieldStyle} />
    </>
  )
}

/** The email box, the same on both pages apart from its placeholder. */
export function EmailField({ idPrefix, email, onEmail, placeholder, error }: { idPrefix: string; email: string; onEmail: (v: string) => void; placeholder: string; error?: string }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-email`} className="sr-only">
        Email
      </label>
      <input id={`${idPrefix}-email`} name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => onEmail(e.target.value)} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={error ? `${idPrefix}-email-error` : undefined} className={fieldClass} style={fieldStyle} />
      <FieldError id={`${idPrefix}-email-error`} text={error} />
    </>
  )
}

/** The person's state, and their birthday (the newsletter is 18+; the age is worked out from the date). */
export function StateBirthdayFields({ idPrefix, state, onState, birthday, onBirthday, stateError, birthdayError }: { idPrefix: string; state: string; onState: (v: string) => void; birthday: string; onBirthday: (v: string) => void; stateError?: string; birthdayError?: string }) {
  return (
    <>
      <label htmlFor={`${idPrefix}-state`} className="sr-only">
        State
      </label>
      <select id={`${idPrefix}-state`} name="state" autoComplete="address-level1" value={state} onChange={(e) => onState(e.target.value)} aria-invalid={stateError ? true : undefined} aria-describedby={stateError ? `${idPrefix}-state-error` : undefined} className={fieldClass} style={fieldStyle}>
        <option value="">Your state</option>
        {US_STATES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <FieldError id={`${idPrefix}-state-error`} text={stateError} />
      {/* A date box has no placeholder, so its label is shown. */}
      <label htmlFor={`${idPrefix}-birthday`} className="-mb-1 self-start px-2 text-left text-base font-bold" style={{ fontFamily: sauce }}>
        Your birthday
      </label>
      <input id={`${idPrefix}-birthday`} name="birthday" type="date" autoComplete="bday" min="1900-01-01" max={todayEastern()} value={birthday} onChange={(e) => onBirthday(e.target.value)} aria-invalid={birthdayError ? true : undefined} aria-describedby={birthdayError ? `${idPrefix}-birthday-error` : undefined} className={fieldClass} style={fieldStyle} />
      <FieldError id={`${idPrefix}-birthday-error`} text={birthdayError} />
    </>
  )
}
