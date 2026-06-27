'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

const ITEMS: Array<{ href: string; label: string; pending?: boolean }> = [
  { href: '/', label: 'Overview' },
  { href: '/users', label: 'Users' },
  { href: '/invites', label: 'Invites' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/clicks', label: 'Clicks' },
  { href: '/audit', label: 'Audit' },
  { href: '/flags', label: 'Flags' },
  { href: '/affiliates', label: 'Affiliates' },
  { href: '/announcements', label: 'Announce' },
  { href: '/markets', label: 'Markets' },
  { href: '/scrapers', label: 'Scrapers' },
  { href: '/hl', label: 'HL' },
  { href: '/alerts', label: 'Alerts', pending: true },
  { href: '/autotrade', label: 'AutoTrade', pending: true },
  { href: '/otoole', label: "O'Toole" },
  { href: '/students', label: 'Students', pending: true },
  { href: '/enterprise', label: 'Enterprise', pending: true },
  { href: '/system', label: 'System' },
  // /admin/signup-config nav item removed — route doesn't exist (404). Re-add
  // when the page is built.
]

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, startSignOut] = useTransition()

  function signOut() {
    startSignOut(async () => {
      await fetch('/api/auth/signout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    })
  }

  return (
    <nav className="w-full border-b border-stone-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      {/* Full-width container (was max-w-6xl). Brand + sign-out cluster pin
          to the edges and stay visible at every viewport width; the nav
          items wrap onto a second line if they don't fit. Rounded-pill
          active state matches the consumer dashboard pill language. */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#004225] text-white text-[10px] font-bold tracking-wider">
              S
            </span>
            <span className="text-xs tracking-wider text-stone-900 font-semibold">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-0.5 flex-wrap">
            {ITEMS.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/' || pathname === '/admin'
                  : pathname.startsWith(item.href) ||
                    pathname.startsWith(`/admin${item.href}`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[11px] px-2.5 py-1 rounded-full tracking-wider transition inline-flex items-center gap-1 whitespace-nowrap ${
                    active
                      ? 'bg-[#00703c] text-white shadow-sm'
                      : item.pending
                        ? 'text-stone-400 hover:bg-stone-100'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {item.label.toUpperCase()}
                  {item.pending && (
                    <span
                      className={`text-[9px] px-1 rounded tracking-normal ${
                        active
                          ? 'bg-white/20 text-white/90'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                      title="Not yet implemented"
                    >
                      WIP
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-stone-700">{email}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="text-[11px] tracking-wider px-2.5 py-1 rounded-full border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 hover:border-stone-300 transition disabled:opacity-50"
            title="Sign out and return to /login"
          >
            {signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}
          </button>
        </div>
      </div>
    </nav>
  )
}
