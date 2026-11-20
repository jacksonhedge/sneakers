'use client'
import { useState } from 'react'
import { NEWSLETTER_NAME, SNEAKERS_LINE } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'
import { WaitlistShare, type Joined } from '../launching-soon/waitlist-share'
import { NewsletterFields } from './newsletter-fields'

type Status = 'idle' | 'loading' | 'done' | 'invalid' | 'state' | 'error'
const sauce = 'var(--font-open-sauce), sans-serif'
const problem: Record<'invalid' | 'state' | 'error', string> = {
  invalid: 'That email does not look right. Check it and try again.',
  state: 'Pick your state and try again.',
  error: 'Something went wrong. Try again in a minute.',
}

/** What to say once the lists are joined. Under 21 (the box left empty) means the Sneakers waitlist only. */
function doneText(r: { newsletter: boolean; existing: boolean }): string {
  if (r.newsletter) return r.existing ? `You're on the list for ${NEWSLETTER_NAME}. You were already on the Sneakers waitlist.` : `You're on the list for ${NEWSLETTER_NAME}. ${SNEAKERS_LINE}`
  return `${NEWSLETTER_NAME} is 21+ only, so we left you off that list. ${r.existing ? "You're already on the Sneakers waitlist." : "You're on the Sneakers waitlist."}`
}

export function SpareChangeForm({ refCode }: { refCode: string | null }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('')
  const [adult, setAdult] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<{ newsletter: boolean; existing: boolean } | null>(null)
  const [joined, setJoined] = useState<Joined | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    if (adult && !state) return setStatus('state')
    setStatus('loading')
    try {
      const res = await fetch('/api/spare-change-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, state, confirmed21: adult, ref: refCode }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; existing?: boolean; newsletter?: boolean; code?: string; referrals?: number; position?: number | null }
      if (res.ok) {
        if (data.code) setJoined({ code: data.code, referrals: data.referrals ?? 0, position: data.position ?? null })
        setResult({ newsletter: data.newsletter === true, existing: data.existing === true })
        setStatus('done')
      } else setStatus(res.status === 400 ? (data.error === 'invalid_state' ? 'state' : 'invalid') : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done' && result) return <WaitlistShare text={doneText(result)} joined={joined} />
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" noValidate>
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
        className="min-h-[3.25rem] rounded-full px-6 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }}
      />
      <NewsletterFields idPrefix="spare-change" state={state} onState={setState} adult={adult} onAdult={setAdult} stateMissing={status === 'state'} />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-60"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}
      >
        {status === 'loading' ? 'Joining…' : 'Get the email'}
      </button>
      {status === 'invalid' || status === 'state' || status === 'error' ? (
        <p role="alert" className="text-base font-semibold" style={{ fontFamily: sauce }}>
          {problem[status]}
        </p>
      ) : null}
    </form>
  )
}
