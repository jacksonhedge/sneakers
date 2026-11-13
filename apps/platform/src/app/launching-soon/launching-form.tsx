'use client'
import { useState } from 'react'
import { CREAM, NAVY } from '../visuals'

type Status = 'idle' | 'loading' | 'done' | 'existing' | 'invalid' | 'error'

const sauce = 'var(--font-open-sauce), sans-serif'
const message: Record<Exclude<Status, 'idle' | 'loading'>, string> = {
  done: "You're on the list. We'll email you when Sneakers opens.",
  existing: "You're already on the list. We'll email you when Sneakers opens.",
  invalid: 'That email does not look right. Check it and try again.',
  error: 'Something went wrong. Try again in a minute.',
}

export function LaunchingForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/sneakers-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = (await res.json().catch(() => ({}))) as { existing?: boolean }
      if (res.ok) setStatus(data.existing ? 'existing' : 'done')
      else setStatus(res.status === 400 ? 'invalid' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done' || status === 'existing') {
    return (
      <p role="status" className="max-w-md rounded-3xl px-6 py-4 text-lg font-bold" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
        {message[status]}
      </p>
    )
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
      <button
        type="submit"
        disabled={status === 'loading'}
        className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-60"
        style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}
      >
        {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
      </button>
      {status === 'invalid' || status === 'error' ? (
        <p role="alert" className="text-base font-semibold" style={{ fontFamily: sauce }}>
          {message[status]}
        </p>
      ) : null}
    </form>
  )
}
