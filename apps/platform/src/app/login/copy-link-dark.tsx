'use client'

import { useState } from 'react'

export function CopyLinkDark({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 bg-black/50 border border-blue-400/40 text-blue-300 px-3 py-2 text-xs font-mono overflow-x-auto whitespace-nowrap">
        {value}
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // clipboard denied — no-op
          }
        }}
        className="border border-blue-400 bg-blue-600 text-white text-xs px-3 py-2 font-semibold tracking-wider hover:bg-blue-400 transition"
      >
        {copied ? 'COPIED' : 'COPY'}
      </button>
    </div>
  )
}
