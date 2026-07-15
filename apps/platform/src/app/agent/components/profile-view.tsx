'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// Presentational only — every piece of copy and every href comes in via
// props from the server page (agent/profile/page.tsx), which owns the
// real account data. No identity, plan, or venue info is hardcoded here.

export interface ProfileRow {
  /** emoji/short glyph shown in a colored tile, iOS-Settings style. Omit for a plain text row. */
  icon?: string
  iconBg?: string
  label: string
  /** plain secondary line (no dot) */
  sub?: string
  /** dot + colored status line, e.g. "Connected · live prices" */
  statusText?: string
  statusColor?: string
  /** present => the whole row renders as a real <Link> */
  href?: string
  /** pill/label shown in the row's trailing slot */
  action?: 'Manage' | 'Open' | 'Soon'
}

export interface ProfileSection {
  title: string
  /** small footnote rendered under the section card (used for the demo-data caveat) */
  note?: string
  rows: ProfileRow[]
}

export interface ProfileViewProps {
  email: string | null
  name: string | null
  sections: ProfileSection[]
}

function initialsOf(name: string | null, email: string | null): string {
  const src = (name ?? '').trim()
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase()
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  }
  if (email) {
    const local = email.split('@')[0] ?? email
    return (local.slice(0, 2) || email[0] || '?').toUpperCase()
  }
  return '?'
}

export function ProfileView({ email, name, sections }: ProfileViewProps) {
  const signedIn = !!email
  const initials = initialsOf(name, email)

  return (
    <>
      <div className="ag-apphead"><span className="ag-brand">Profile</span></div>

      <div className="ag-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2FD37A,#1a9e97)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
            color: '#0B0D10', flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {signedIn ? (name ?? email) : 'Not signed in'}
          </div>
          {signedIn ? (
            name && (
              <div className="ag-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
            )
          ) : (
            <div className="ag-sub">Preview mode — sign in to see your account</div>
          )}
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <div className="ag-sechead">{section.title}</div>
          <div className="ag-card" style={{ padding: '4px 16px' }}>
            {section.rows.map((row, i) => (
              <ProfileRowItem key={`${section.title}-${i}`} row={row} />
            ))}
          </div>
          {section.note && <div className="ag-sub" style={{ margin: '-6px 4px 14px' }}>{section.note}</div>}
        </div>
      ))}

      {signedIn && <SignOutButton />}
    </>
  )
}

function ProfileRowItem({ row }: { row: ProfileRow }) {
  const body = (
    <>
      {row.icon && (
        <div className="ag-conn__logo" style={{ background: row.iconBg ?? '#1a2026' }}>{row.icon}</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="ag-conn__nm">{row.label}</div>
        {row.statusText ? (
          <div className="ag-conn__st" style={{ color: row.statusColor ?? '#98A2A8' }}>
            <span className="ag-conn__dot" style={{ background: row.statusColor ?? '#98A2A8' }} />
            {row.statusText}
          </div>
        ) : row.sub ? (
          <div className="ag-conn__st" style={{ color: '#98A2A8' }}>{row.sub}</div>
        ) : null}
      </div>
      {row.action === 'Soon' ? (
        <div className="ag-conn__act"><span className="ag-soon">Soon</span></div>
      ) : row.action ? (
        <div className="ag-conn__act"><span className="ag-linkish">{row.action}</span></div>
      ) : row.href ? (
        <div className="ag-conn__act ag-sub" aria-hidden="true">→</div>
      ) : null}
    </>
  )

  if (row.href) {
    return (
      <Link href={row.href} className="ag-conn" style={{ textDecoration: 'none', color: 'inherit' }}>
        {body}
      </Link>
    )
  }
  return <div className="ag-conn">{body}</div>
}

// Real sign-out mechanism — mirrors src/app/dashboard/sign-out-button.tsx
// exactly (same browser Supabase client, same auth.signOut() call, same
// redirect target), restyled to the agent app's dark ag-* design tokens
// instead of the dashboard's light Tailwind classes.
function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return
    setBusy(true)
    const supabase = createBrowserClient(url, anon)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="ag-linkish"
      style={{ width: '100%', padding: '12px 0', marginTop: 14, color: 'var(--ag-red)', borderColor: '#2a323a' }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
