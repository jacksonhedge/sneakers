'use client'
import { useState } from 'react'
import { referralLink, referralShareText } from '@/lib/waitlist-referral'
import { CREAM, NAVY } from '../visuals'

type Status = 'idle' | 'loading' | 'done' | 'existing' | 'invalid' | 'error'
interface Joined {
  code: string
  referrals: number
  position: number | null
}

const sauce = 'var(--font-open-sauce), sans-serif'
const message: Record<Exclude<Status, 'idle' | 'loading'>, string> = {
  done: "You're on the list. We'll email you when Sneakers opens.",
  existing: "You're already on the list. We'll email you when Sneakers opens.",
  invalid: 'That email does not look right. Check it and try again.',
  error: 'Something went wrong. Try again in a minute.',
}

export function LaunchingForm({ refCode }: { refCode: string | null }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [joined, setJoined] = useState<Joined | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/sneakers-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ref: refCode }) })
      const data = (await res.json().catch(() => ({}))) as { existing?: boolean; code?: string; referrals?: number; position?: number | null }
      if (res.ok) {
        if (data.code) setJoined({ code: data.code, referrals: data.referrals ?? 0, position: data.position ?? null })
        setStatus(data.existing ? 'existing' : 'done')
      }
      else setStatus(res.status === 400 ? 'invalid' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done' || status === 'existing') {
    const link = joined ? referralLink(window.location.origin, joined.code) : null
    const share = async () => {
      if (!link) return
      const text = referralShareText(link)
      try {
        if (navigator.share) await navigator.share({ text })
        else {
          await navigator.clipboard.writeText(text)
          setNote('Copied. Paste it in a text.')
        }
      } catch {
        // cancelled or blocked: the link stays on screen to copy by hand
      }
    }
    return (
      <div role="status" className="flex w-full max-w-md flex-col items-center gap-4">
        <p className="rounded-3xl px-6 py-4 text-lg font-bold" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
          {message[status]}
        </p>
        {link && joined ? (
          <>
            <p className="text-lg font-bold" style={{ fontFamily: sauce }}>
              Friends who join with your link move you up the list.
            </p>
            <input readOnly aria-label="Your link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-h-[3.25rem] w-full rounded-full px-5 text-base" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, fontFamily: sauce }} />
            <button type="button" onClick={share} className="min-h-[3.25rem] rounded-full px-8 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, boxShadow: `0.25rem 0.3rem 0 ${NAVY}`, fontFamily: sauce }}>
              Share your link
            </button>
            {note ? <p style={{ fontFamily: sauce }}>{note}</p> : null}
            <p className="text-base font-semibold" style={{ fontFamily: sauce }}>
              {joined.position !== null ? `You are #${joined.position} in line. ` : ''}
              {joined.referrals === 1 ? '1 friend joined with your link.' : `${joined.referrals} friends joined with your link.`}
            </p>
          </>
        ) : null}
      </div>
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
