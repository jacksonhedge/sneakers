'use client'
import { useRef, useState } from 'react'
import { NEWSLETTER_OPT_IN, NEWSLETTER_UNDER_18, signupProblems, type SignupField } from '@/lib/spare-change'
import { NAVY } from '../visuals'
import { EmailField, NameField, Spinner, StateBirthdayFields, buttonClass, buttonStyle, focusFirstProblem, problemsFromError, type Problems } from '../spare-change/newsletter-fields'
import { NewsletterSaved } from '../spare-change/saved-screen'
import { WaitlistShare, type Joined } from './waitlist-share'

type Status = 'idle' | 'loading' | 'done' | 'existing' | 'invalid' | 'too_many' | 'error'

const sauce = 'var(--font-open-sauce), sans-serif'
const ORDER: readonly SignupField[] = ['email', 'name', 'state', 'birthday']
const message: Record<Exclude<Status, 'idle' | 'loading'>, string> = {
  done: "You're on the list. We'll email you when Sneakers opens.",
  existing: "You're already on the list. We'll email you when Sneakers opens.",
  invalid: 'That email does not look right. Check it and try again.',
  too_many: 'Too many tries. Wait a minute and try again.',
  error: 'Something went wrong. Try again in a minute.',
}

export function LaunchingForm({ refCode }: { refCode: string | null }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [joined, setJoined] = useState<Joined | null>(null)
  // The optional newsletter: off unless the person ticks it. Off, this form posts exactly what it always has and says what it always has.
  // On, it works like the form on /spare-change: each gap is named under its own field, and success is the newsletter's saved screen.
  const [wantsNewsletter, setWantsNewsletter] = useState(false)
  const [name, setName] = useState('')
  const [state, setState] = useState('')
  const [birthday, setBirthday] = useState('')
  const [problems, setProblems] = useState<Problems>({})
  const [newsletter, setNewsletter] = useState<{ on: true; emailSent: boolean } | { on: false } | null>(null)
  // A ref, not state: a second tap can arrive before the first one's "loading" has been drawn.
  const busy = useRef(false)

  const show = (found: Problems) => {
    setProblems(found)
    setStatus('idle')
    focusFirstProblem('waitlist', found, ORDER)
  }
  const edit = (field: SignupField, set: (v: string) => void) => (v: string) => {
    set(v)
    if (problems[field]) setProblems(({ [field]: _gone, ...rest }) => rest)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    if (wantsNewsletter) {
      const gaps = signupProblems({ name, email, state, birthday })
      if (Object.keys(gaps).length) return show(gaps)
    }
    busy.current = true
    setProblems({})
    setStatus('loading')
    try {
      const res = wantsNewsletter
        ? await fetch('/api/spare-change-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, state, birthday, ref: refCode }) })
        : await fetch('/api/sneakers-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ref: refCode }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; existing?: boolean; newsletter?: boolean; welcome?: string; code?: string; referrals?: number; position?: number | null }
      if (res.ok) {
        if (data.code) setJoined({ code: data.code, referrals: data.referrals ?? 0, position: data.position ?? null })
        setNewsletter(!wantsNewsletter ? null : data.newsletter === true ? { on: true, emailSent: data.welcome === 'sent' } : { on: false })
        setStatus(data.existing ? 'existing' : 'done')
      } else if (wantsNewsletter && res.status === 400 && Object.keys(problemsFromError(data.error)).length) show(problemsFromError(data.error))
      else setStatus(res.status === 400 ? 'invalid' : wantsNewsletter && res.status === 429 ? 'too_many' : 'error')
    } catch {
      setStatus('error')
    } finally {
      busy.current = false
    }
  }

  if (status === 'done' || status === 'existing') {
    if (newsletter?.on) return <NewsletterSaved name={name} emailSent={newsletter.emailSent} joined={joined} />
    // Without the newsletter (box not ticked, or under 18): the line this page has always shown, plus why the newsletter was left off.
    return <WaitlistShare text={message[status] + (newsletter ? ` ${NEWSLETTER_UNDER_18}` : '')} joined={joined} />
  }
  const loading = status === 'loading'
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" noValidate aria-busy={loading || undefined}>
      <EmailField idPrefix="waitlist" email={email} onEmail={edit('email', setEmail)} placeholder="you@school.edu" error={wantsNewsletter ? problems.email : undefined} />
      <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 px-2 text-left text-base font-semibold" style={{ fontFamily: sauce }}>
        <input
          type="checkbox"
          checked={wantsNewsletter}
          onChange={(e) => {
            setWantsNewsletter(e.target.checked)
            setProblems({})
          }}
          className="size-6 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ accentColor: NAVY }}
        />
        <span>{NEWSLETTER_OPT_IN}</span>
      </label>
      {wantsNewsletter ? (
        <>
          <NameField idPrefix="waitlist" name={name} onName={edit('name', setName)} error={problems.name} />
          <StateBirthdayFields idPrefix="waitlist" state={state} onState={edit('state', setState)} birthday={birthday} onBirthday={edit('birthday', setBirthday)} stateError={problems.state} birthdayError={problems.birthday} />
        </>
      ) : null}
      <button type="submit" disabled={loading} className={buttonClass} style={buttonStyle}>
        {loading ? (
          <>
            {wantsNewsletter ? <Spinner /> : null}
            Joining…
          </>
        ) : (
          'Join the waitlist'
        )}
      </button>
      {status === 'invalid' || status === 'too_many' || status === 'error' ? (
        <p role="alert" className="text-base font-semibold" style={{ fontFamily: sauce }}>
          {message[status]}
        </p>
      ) : null}
    </form>
  )
}
