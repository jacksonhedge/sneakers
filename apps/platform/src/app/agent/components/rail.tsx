'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAgent } from '../lib/store'
import { formatMoneyWhole } from '../lib/format'
import { NAV_ITEMS } from './tab-bar'

// Desktop-only left rail (shown ≥900px via CSS; TabBar shows below).
export function Rail() {
  const path = usePathname()
  const { state } = useAgent()
  return (
    <nav className="ag-rail" aria-label="Primary">
      <div className="ag-rail__brand ag-num">S</div>
      {NAV_ITEMS.map(t => (
        <Link key={t.href} href={t.href}
          aria-current={path === t.href ? 'page' : undefined}
          className={'ag-rail__item' + (path === t.href ? ' ag-rail__item--on' : '')}>
          {t.balance
            ? <span className="ag-tabnum ag-num">{formatMoneyWhole(state.balanceCents)}</span>
            : t.icon}
          <span className="ag-rail__label">{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
