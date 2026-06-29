'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

// Simplified topbar nav — V2 wallet-first dashboard.
// Previously had 8 category/surface pills; now just a single "Live"
// link to the dashboard home. Other routes (Markets, Strategies, etc.)
// remain accessible via the hamburger menu — they're just not cluttering
// the primary nav bar anymore.

export function TopbarFilterPills() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(href: string) {
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <nav className="hidden md:flex items-center gap-0.5 shrink-0 ml-1">
      <button
        type="button"
        onClick={() => go('/dashboard')}
        disabled={pending}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full transition disabled:opacity-60 bg-blue-50 text-blue-800 hover:bg-blue-100 font-semibold"
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
        />
        Live
      </button>
    </nav>
  )
}
