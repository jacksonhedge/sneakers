'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AutoRefresh } from '@/components/auto-refresh'
import { DashboardTopbarV2 } from './topbar-v2'
import { OToolePanel } from './otoole-panel'
import { OTooleMobileFAB } from './otoole-mobile-fab'
import { NotAdminBanner } from './not-admin-banner'

// Client wrapper that decides whether to render the full dashboard chrome
// or a bare passthrough for the market-detail route. Market detail has
// its own topbar + multi-column layout (left market info, main chart,
// right trade panel) and adding the OToole panel as a 4th column would
// crush it. Every other /dashboard/* page gets the chrome.

interface Props {
  email: string | null
  userName: string | null
  avatarUrl?: string | null
  avatarEmoji?: string | null
  avatarColor?: string | null
  configuredVenueIds: string[]
  planTier?: string
  children: React.ReactNode
}

function isMarketDetailPath(pathname: string | null): boolean {
  if (!pathname) return false
  // /dashboard/markets/<platform>/<marketId> — exactly 4 segments.
  const parts = pathname.split('/').filter(Boolean)
  return (
    parts.length === 4 &&
    parts[0] === 'dashboard' &&
    parts[1] === 'markets'
  )
}

export function DashboardShell({
  email,
  userName,
  avatarUrl,
  avatarEmoji,
  avatarColor,
  configuredVenueIds,
  planTier,
  children,
}: Props) {
  const pathname = usePathname()

  // O'Toole desktop sidebar is COLLAPSED by default — it keeps the
  // dashboard light (the panel's chat backend / effects only mount when
  // opened) and gives the markets full width. The preference persists in
  // localStorage, so once a user opens it, it stays open across navigations.
  const [otooleOpen, setOtooleOpen] = useState(false)
  useEffect(() => {
    try {
      setOtooleOpen(localStorage.getItem('sneakers_otoole_panel_open') === '1')
    } catch {
      /* localStorage unavailable — stay collapsed */
    }
  }, [])
  function setOtoole(open: boolean) {
    setOtooleOpen(open)
    try {
      localStorage.setItem('sneakers_otoole_panel_open', open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  if (isMarketDetailPath(pathname)) {
    // Market detail still gets the auto-refresh — prices on the
    // chart and best-ask in the trade panel should keep ticking.
    return (
      <>
        <AutoRefresh intervalMs={30_000} />
        {children}
      </>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-stone-50 text-stone-900 flex flex-col">
      {/* Re-fetches server-component data every 30s so prices, volume
          rankings, and the freshness indicator stay live without the
          user having to refresh. Pauses while the tab is hidden. */}
      <AutoRefresh intervalMs={30_000} />
      <DashboardTopbarV2
        email={email}
        avatarUrl={avatarUrl}
        avatarEmoji={avatarEmoji}
        avatarColor={avatarColor}
        configuredVenueIds={configuredVenueIds}
        planTier={planTier}
      />

      <div className="flex-1 flex min-h-0">
        {/* O'Toole desktop sidebar — collapsed by default. Expanded shows
            the full panel (with a collapse control); collapsed shows a thin
            rail to reopen it. OToolePanel hides itself below md; the FAB-
            driven popup below takes over for mobile. */}
        {otooleOpen ? (
          <div className="relative hidden md:flex shrink-0">
            <OToolePanel userName={userName} />
            <button
              type="button"
              onClick={() => setOtoole(false)}
              aria-label="Collapse O'Toole"
              title="Collapse O'Toole"
              className="absolute top-2.5 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white/85 text-sm text-stone-500 ring-1 ring-stone-200 backdrop-blur transition hover:bg-white hover:text-stone-900"
            >
              ‹‹
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOtoole(true)}
            aria-label="Open O'Toole AI"
            title="Open O'Toole AI"
            className="hidden md:flex shrink-0 w-12 flex-col items-center gap-3 border-r border-stone-200 bg-white pt-4 transition hover:bg-stone-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-950 text-sm text-white ring-1 ring-blue-400/50">
              ✦
            </span>
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold tracking-[0.2em] text-stone-500">
              O&apos;TOOLE
            </span>
          </button>
        )}
        <main className="flex-1 overflow-y-auto min-w-0">
          <NotAdminBanner />
          {children}
        </main>
      </div>
      <OTooleMobileFAB userName={userName} />
    </div>
  )
}
