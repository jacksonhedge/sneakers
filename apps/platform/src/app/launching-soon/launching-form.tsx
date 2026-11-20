'use client'
import { useState } from 'react'
import { NEWSLETTER_NAME, NEWSLETTER_OPT_IN } from '@/lib/spare-change'
import { CREAM, NAVY } from '../visuals'
import { NewsletterFields } from '../spare-change/newsletter-fields'
import { WaitlistShare, type Joined } from './waitlist-share'

type Status = 'idle' | 'loading' | 'done' | 'existing' | 'invalid' | 'state' | 'error'

const sauce = 'var(--font-open-sauce), sans-serif'
const message: Record<Exclude<Status, 'idle' | 'loading'>, string> = {
  done: "You're on the list. We'll email you when Sneakers opens.",
  existing: "You're already on the list. We'll email you when Sneakers opens.",
  invalid: 'That email does not look right. Check it and try again.',
  state: 'Pick your state and try again.',
  error: 'Something went wrong. Try again in a minute.',
}
// Added to the confirmation only for someone who ticked the newsletter box: whether they are on that list too (it is 21+ only).
const newsletterNote = { yes: ` You're on the list for ${NEWSLETTER_NAME} too.`, no: ` ${NEWSLETTER_NAME} is 21+ only, so we left you off that list.` }

export function LaunchingForm({ refCode }: { refCode: string | null }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [joined, setJoined] = useState<Joined | null>(null)
  // The optional newsletter: off unless the person ticks it. Off, this form posts exactly what it always has.
  const [wantsNewsletter, setWantsNewsletter] = useState(false)
  const [state, setState] = useState('')
  const [adult, setAdult] = useState(false)
  const [onNewsletter, setOnNewsletter] = useState<boolean | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    if (wantsNewsletter && adult && !state) return setStatus('state')
    setStatus('loading')
    try {
      const res = wantsNewsletter
        ? await fetch('/api/spare-change-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, state, confirmed21: adult, ref: refCode }) })
        : await fetch('/api/sneakers-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ref: refCode }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; existing?: boolean; newsletter?: boolean; code?: string; referrals?: number; position?: number | null }
      if (res.ok) {
        if (data.code) setJoined({ code: data.code, referrals: data.referrals ?? 0, position: data.position ?? null })
        setOnNewsletter(wantsNewsletter ? data.newsletter === true : null)
        setStatus(data.existing ? 'existing' : 'done')
      }
      else setStatus(res.status === 400 ? (data.error === 'invalid_state' ? 'state' : 'invalid') : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done' || status === 'existing') {
    return <WaitlistShare text={message[status] + (onNewsletter === null ? '' : onNewsletter ? newsletterNote.yes : newsletterNote.no)} joined={joined} />
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" noValidate>
      <label htmlFor="waitlist-email" className="sr-only">
        Email
      </label>
      <input
        id="waitlist-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@school.edu"
        className="min-h-[3.25rem] rounded-full px-6 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }}
      />
      <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 px-2 text-left text-base font-semibold" style={{ fontFamily: sauce }}>
        <input type="checkbox" checked={wantsNewsletter} onChange={(e) => setWantsNewsletter(e.target.checked)} className="size-6 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ accentColor: NAVY }} />
        <span>{NEWSLETTER_OPT_IN}</span>
      </label>
      {wantsNewsletter ? <NewsletterFields idPrefix="waitlist" state={state} onState={setState} adult={adult} onAdult={setAdult} stateMissing={status === 'state'} /> : null}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-60"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}
      >
        {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
      </button>
      {status === 'invalid' || status === 'state' || status === 'error' ? (
        <p role="alert" className="text-base font-semibold" style={{ fontFamily: sauce }}>
          {message[status]}
        </p>
      ) : null}
    </form>
  )
}
