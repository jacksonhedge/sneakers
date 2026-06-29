'use client'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return
    const supabase = createBrowserClient(url, anon)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="w-full flex items-center gap-2 px-1 py-1.5 text-sm font-semibold text-stone-700 hover:text-[#00703c] transition"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Sign out
    </button>
  )
}
