'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FooterNewsletter() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      })
      const data = (await res.json().catch(() => ({}))) as { existing?: boolean }
      if (res.ok) {
        if (data.existing) {
          router.push(`/login?email=${encodeURIComponent(email.toLowerCase().trim())}`)
          return
        }
        setStatus('done')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="text-sm text-blue-700 font-medium">
        You&apos;re on the list — check your inbox.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-stretch border border-blue-900/15 rounded-md overflow-hidden bg-white max-w-xs">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        disabled={status === 'loading'}
        className="flex-1 px-3 py-2.5 text-sm text-blue-950 placeholder:text-blue-900/40 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        aria-label="Subscribe"
        className="bg-blue-600 text-white px-4 hover:bg-blue-700 transition disabled:opacity-50"
      >
        {status === 'loading' ? '…' : '→'}
      </button>
    </form>
  )
}
