'use client'
import { useState } from 'react'
import { NEWSLETTER_NAME, NEWSLETTER_UNDER_18, SNEAKERS_LINE } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'
import { WaitlistShare, type Joined } from '../launching-soon/waitlist-share'
import { NameField, StateAgeFields, newsletterProblem, newsletterProblemText, problemFromError, type NewsletterProblem } from './newsletter-fields'

type Status = 'idle' | 'loading' | 'done' | 'invalid' | NewsletterProblem | 'error'
const sauce = 'var(--font-open-sauce), sans-serif'
const problem: Record<'invalid' | NewsletterProblem | 'error', string> = {
  invalid: 'That email does not look right. Check it and try again.',
  ...newsletterProblemText,
  error: 'Something went wrong. Try again in a minute.',
}
type Result = { newsletter: boolean; under18: boolean; existing: boolean }

/** What to say once the lists are joined. Under 18 means the Sneakers waitlist only, and the page says the newsletter is 18+. */
function doneText(r: Result): string {
  if (r.newsletter) return r.existing ? `You're on the list for ${NEWSLETTER_NAME}. You were already on the Sneakers waitlist.` : `You're on the list for ${NEWSLETTER_NAME}. ${SNEAKERS_LINE}`
  const sneakers = r.existing ? "You're already on the Sneakers waitlist." : "You're on the Sneakers waitlist."
  return r.under18 ? `${NEWSLETTER_UNDER_18} ${sneakers}` : sneakers
}

export function SpareChangeForm({ refCode }: { refCode: string | null }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState('')
  const [age, setAge] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [joined, setJoined] = useState<Joined | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    const gap = newsletterProblem({ name, state, age })
    if (gap) return setStatus(gap)
    setStatus('loading')
    try {
      const res = await fetch('/api/spare-change-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, state, age, ref: refCode }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; existing?: boolean; newsletter?: boolean; reason?: string; code?: string; referrals?: number; position?: number | null }
      if (res.ok) {
        if (data.code) setJoined({ code: data.code, referrals: data.referrals ?? 0, position: data.position ?? null })
        setResult({ newsletter: data.newsletter === true, under18: data.reason === 'under_18', existing: data.existing === true })
        setStatus('done')
      } else setStatus(res.status === 400 ? (problemFromError(data.error) ?? 'invalid') : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done' && result) return <WaitlistShare text={doneText(result)} joined={joined} newsletter={result.newsletter} />
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" noValidate>
      <NameField idPrefix="spare-change" name={name} onName={setName} invalid={status === 'name'} />
      <label htmlFor="spare-change-email" className="sr-only">
        Email
      </label>
      <input
        id="spare-change-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-invalid={status === 'invalid' || undefined}
        className="min-h-[3.25rem] rounded-full px-6 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }}
      />
      <StateAgeFields idPrefix="spare-change" state={state} onState={setState} age={age} onAge={setAge} invalid={status === 'state' || status === 'age' ? status : null} />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-60"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}
      >
        {status === 'loading' ? 'Joining…' : 'Get the email'}
      </button>
      {status !== 'idle' && status !== 'loading' && status !== 'done' ? (
        <p role="alert" className="text-base font-semibold" style={{ fontFamily: sauce }}>
          {problem[status]}
        </p>
      ) : null}
    </form>
  )
}
