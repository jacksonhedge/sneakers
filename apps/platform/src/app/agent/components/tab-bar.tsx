'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAgent } from '../lib/store'
import { formatMoneyWhole } from '../lib/format'

export const ORB_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
  </svg>
)
export const MODELS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 17l5-5 4 3 7-8" /><path d="M16 7h4v4" />
  </svg>
)
export const MARKETS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />
  </svg>
)
const PROFILE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.4-3.2 4-4.8 7-4.8s5.6 1.6 7 4.8" />
  </svg>
)

export const NAV_ITEMS: { href: string; label: string; icon?: React.ReactNode; balance?: boolean }[] = [
  { href: '/agent', label: 'Agent', icon: ORB_ICON },
  { href: '/agent/markets', label: 'Markets', icon: MARKETS_ICON },
  { href: '/agent/models', label: 'Models', icon: MODELS_ICON },
  { href: '/agent/balance', label: 'Balance', balance: true },
  { href: '/agent/profile', label: 'Profile', icon: PROFILE_ICON },
]

export function TabBar() {
  const path = usePathname()
  const { state } = useAgent()
  return (
    <nav className="ag-tabbar">
      {NAV_ITEMS.map(t => (
        <Link key={t.href} href={t.href}
          aria-current={path === t.href ? 'page' : undefined}
          className={'ag-tabbtn' + (path === t.href ? ' ag-tabbtn--on' : '')}>
          {t.balance
            ? <span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span>
            : t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
