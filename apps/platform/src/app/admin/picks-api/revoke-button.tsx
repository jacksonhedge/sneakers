'use client'

import { useState, useTransition } from 'react'
import { revokeKeyAction } from './actions'

// Two clicks: REVOKE, then CONFIRM. A revoked key stops working on its next request and can't be turned back on.
export function RevokeButton({ id, name }: { id: string; name: string }) {
  const [armed, setArmed] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!armed)
    return (
      <button type="button" onClick={() => setArmed(true)} className="text-xs px-2 py-1 border border-stone-300 hover:border-red-400 hover:text-red-700">
        REVOKE
      </button>
    )
  return (
    <span className="inline-flex gap-1 items-center">
      <button
        type="button"
        disabled={pending}
        aria-label={`Confirm revoking the key for ${name}`}
        onClick={() => {
          const fd = new FormData()
          fd.set('id', id)
          startTransition(async () => {
            const r = await revokeKeyAction(fd)
            if (!r.ok) setError(r.message)
          })
        }}
        className="text-xs px-2 py-1 bg-red-600 text-white disabled:opacity-50"
      >
        {pending ? '…' : 'CONFIRM'}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-xs px-2 py-1 border border-stone-300">
        CANCEL
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  )
}
