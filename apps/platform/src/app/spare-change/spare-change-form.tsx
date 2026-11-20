'use client'
import { useRef, useState } from 'react'
import { NEWSLETTER_UNDER_18, signupProblems, type SignupField } from '@/lib/spare-change'
import { WaitlistShare, type Joined } from '../launching-soon/waitlist-share'
import { EmailField, NameField, Spinner, StateAgeFields, buttonClass, buttonStyle, focusFirstProblem, problemsFromError, type Problems } from './newsletter-fields'
import { NewsletterSaved } from './saved-screen'

const sauce = 'var(--font-open-sauce), sans-serif'
const ORDER: readonly SignupField[] = ['name', 'email', 'state', 'age']
const formProblem = { error: 'Something went wrong. Try again in a minute.', too_many: 'Too many tries. Wait a minute and try again.' } as const
type Done = { newsletter: true; emailSent: boolean } | { newsletter: false; under18: boolean; existing: boolean }

/** What to say to someone who joined the Sneakers waitlist only. Under 18, the page says the newsletter is 18+. */
function sneakersOnlyText(r: { under18: boolean; existing: boolean }): string {
  const sneakers = r.existing ? "You're already on the Sneakers waitlist." : "You're on the Sneakers waitlist."
  return r.under18 ? `${NEWSLETTER_UNDER_18} ${sneakers}` : sneakers
}

export function SpareChangeForm({ refCode }: { refCode: string | null }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState('')
  const [age, setAge] = useState('')
  const [loading, setLoading] = useState(false)
  const [problems, setProblems] = useState<Problems>({})
  const [formError, setFormError] = useState<keyof typeof formProblem | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [joined, setJoined] = useState<Joined | null>(null)
  // A ref, not state: a second tap can arrive before the first one's "loading" has been drawn.
  const busy = useRef(false)

  const show = (found: Problems) => {
    setProblems(found)
    focusFirstProblem('spare-change', found, ORDER)
  }
  const edit = (field: SignupField, set: (v: string) => void) => (v: string) => {
    set(v)
    if (problems[field]) setProblems(({ [field]: _gone, ...rest }) => rest)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    setFormError(null)
    const gaps = signupProblems({ name, email, state, age })
    if (Object.keys(gaps).length) return show(gaps)
    busy.current = true
    setProblems({})
    setLoading(true)
    try {
      const res = await fetch('/api/spare-change-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, state, age, ref: refCode }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; existing?: boolean; newsletter?: boolean; welcome?: string; reason?: string; code?: string; referrals?: number; position?: number | null }
      if (res.ok) {
        if (data.code) setJoined({ code: data.code, referrals: data.referrals ?? 0, position: data.position ?? null })
        setDone(data.newsletter === true ? { newsletter: true, emailSent: data.welcome === 'sent' } : { newsletter: false, under18: data.reason === 'under_18', existing: data.existing === true })
      } else if (res.status === 400 && Object.keys(problemsFromError(data.error)).length) show(problemsFromError(data.error))
      else setFormError(res.status === 429 ? 'too_many' : 'error')
    } catch {
      setFormError('error')
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  if (done?.newsletter) return <NewsletterSaved name={name} emailSent={done.emailSent} joined={joined} />
  if (done) return <WaitlistShare text={sneakersOnlyText(done)} joined={joined} />
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" noValidate aria-busy={loading || undefined}>
      <NameField idPrefix="spare-change" name={name} onName={edit('name', setName)} error={problems.name} />
      <EmailField idPrefix="spare-change" email={email} onEmail={edit('email', setEmail)} placeholder="you@email.com" error={problems.email} />
      <StateAgeFields idPrefix="spare-change" state={state} onState={edit('state', setState)} age={age} onAge={edit('age', setAge)} stateError={problems.state} ageError={problems.age} />
      <button type="submit" disabled={loading} className={buttonClass} style={buttonStyle}>
        {loading ? (
          <>
            <Spinner />
            Joining…
          </>
        ) : (
          'Get the email'
        )}
      </button>
      {formError ? (
        <p role="alert" className="text-base font-semibold" style={{ fontFamily: sauce }}>
          {formProblem[formError]}
        </p>
      ) : null}
    </form>
  )
}
