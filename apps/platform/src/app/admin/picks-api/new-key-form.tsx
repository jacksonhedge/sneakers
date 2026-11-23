'use client'

import { useState, useTransition } from 'react'
import { createKeyAction } from './actions'

// Make a partner key. The key shows once, in the green box, until the page is left: it can't be read back later.
export function NewKeyForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<{ key: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const r = await createKeyAction(fd)
      if (r.ok) {
        setMade({ key: r.key, name: r.name })
        setCopied(false)
        setError(null)
        form.reset()
      } else setError(r.message)
    })
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-2 border border-stone-300 bg-white p-4">
        <div className="text-xs text-stone-500 tracking-wider">{'>'} NEW KEY</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_110px_110px_auto] gap-2 items-start">
          <input name="name" required maxLength={120} placeholder="who it's for (e.g. Parlay Pals on Whop)" className="border border-stone-300 px-3 py-1.5 text-sm" />
          <input name="contact_email" type="email" maxLength={254} placeholder="contact email (optional)" className="border border-stone-300 px-3 py-1.5 text-sm" />
          <input name="per_minute_limit" inputMode="numeric" placeholder="60 / min" title="requests per minute (default 60)" className="border border-stone-300 px-3 py-1.5 text-sm font-mono" />
          <input name="daily_limit" inputMode="numeric" placeholder="2000 / day" title="requests per day, Eastern (default 2,000)" className="border border-stone-300 px-3 py-1.5 text-sm font-mono" />
          <button type="submit" disabled={pending} className="bg-[#00703c] text-white text-xs px-4 py-1.5 tracking-wider hover:bg-[#005a30] disabled:opacity-50">
            {pending ? 'MAKING…' : 'MAKE KEY'}
          </button>
        </div>
        <input name="note" maxLength={500} placeholder="note (optional): deal terms, where they show the picks" className="w-full border border-stone-300 px-3 py-1.5 text-sm" />
        {error && <div className="text-xs px-3 py-1.5 inline-block bg-red-50 text-red-800 border border-red-200">{error}</div>}
      </form>

      {made && (
        <div className="border border-green-300 bg-green-50 p-4 space-y-2">
          <div className="text-xs text-green-900 tracking-wider">KEY FOR {made.name.toUpperCase()}: COPY IT NOW, IT WON&apos;T BE SHOWN AGAIN</div>
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-white border border-green-200 px-3 py-2 text-sm break-all">{made.key}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(made.key).then(() => setCopied(true))}
              className="text-xs px-3 py-2 border border-green-400 bg-white hover:bg-green-100"
            >
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <div className="text-xs text-green-900">
            Send it privately (not in a group chat). They call <code>GET /api/spare-change/v1/picks</code> with{' '}
            <code>Authorization: Bearer &lt;key&gt;</code>, from their server only.
          </div>
        </div>
      )}
    </div>
  )
}
