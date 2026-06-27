'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  FaBasketball,
  FaFootball,
  FaBaseball,
  FaHockeyPuck,
  FaFutbol,
  FaVolleyball,
  FaTableTennisPaddleBall,
  FaGolfBallTee,
  FaHandFist,
  FaCarBurst,
  FaPersonRunning,
  FaGamepad,
} from 'react-icons/fa6'
import type { IconType } from 'react-icons'
import type { MarketPhase, MarketSort } from '@/lib/markets-data'
import type { TerminalCategory } from '@/lib/market-stats'
import { displaySport } from '@/lib/display-names'
import { PlatformLogo } from '../dashboard/platform-logo'

// Sport-id (lowercased, scraper-canonical) → react-icons component.
// Unknown sports fall through to a neutral runner icon so the chip
// still renders. Tints chosen to give a per-sport color hint without
// going full Pop-Art.
type SportShape = { Icon: IconType; tint: string }

const SPORT_ICONS: Record<string, SportShape> = {
  nba: { Icon: FaBasketball, tint: 'text-orange-600' },
  basketball: { Icon: FaBasketball, tint: 'text-orange-600' },
  ncaab: { Icon: FaBasketball, tint: 'text-orange-600' },
  cbb: { Icon: FaBasketball, tint: 'text-orange-600' },
  wnba: { Icon: FaBasketball, tint: 'text-orange-600' },
  nfl: { Icon: FaFootball, tint: 'text-amber-800' },
  football: { Icon: FaFootball, tint: 'text-amber-800' },
  ncaaf: { Icon: FaFootball, tint: 'text-amber-800' },
  cfb: { Icon: FaFootball, tint: 'text-amber-800' },
  mlb: { Icon: FaBaseball, tint: 'text-red-600' },
  baseball: { Icon: FaBaseball, tint: 'text-red-600' },
  nhl: { Icon: FaHockeyPuck, tint: 'text-slate-700' },
  hockey: { Icon: FaHockeyPuck, tint: 'text-slate-700' },
  ice_hockey: { Icon: FaHockeyPuck, tint: 'text-slate-700' },
  soccer: { Icon: FaFutbol, tint: 'text-emerald-700' },
  mls: { Icon: FaFutbol, tint: 'text-emerald-700' },
  epl: { Icon: FaFutbol, tint: 'text-emerald-700' },
  laliga: { Icon: FaFutbol, tint: 'text-emerald-700' },
  bundesliga: { Icon: FaFutbol, tint: 'text-emerald-700' },
  serie_a: { Icon: FaFutbol, tint: 'text-emerald-700' },
  ligue_1: { Icon: FaFutbol, tint: 'text-emerald-700' },
  champions_league: { Icon: FaFutbol, tint: 'text-emerald-700' },
  uefa_europa_league: { Icon: FaFutbol, tint: 'text-emerald-700' },
  uefa_conference_league: { Icon: FaFutbol, tint: 'text-emerald-700' },
  argentine_primera: { Icon: FaFutbol, tint: 'text-emerald-700' },
  brazilian_serie_a: { Icon: FaFutbol, tint: 'text-emerald-700' },
  world_cup: { Icon: FaFutbol, tint: 'text-emerald-700' },
  tennis: { Icon: FaTableTennisPaddleBall, tint: 'text-lime-700' },
  atp: { Icon: FaTableTennisPaddleBall, tint: 'text-lime-700' },
  wta: { Icon: FaTableTennisPaddleBall, tint: 'text-lime-700' },
  golf: { Icon: FaGolfBallTee, tint: 'text-emerald-800' },
  pga: { Icon: FaGolfBallTee, tint: 'text-emerald-800' },
  lpga: { Icon: FaGolfBallTee, tint: 'text-emerald-800' },
  ufc: { Icon: FaHandFist, tint: 'text-red-700' },
  mma: { Icon: FaHandFist, tint: 'text-red-700' },
  boxing: { Icon: FaHandFist, tint: 'text-red-700' },
  f1: { Icon: FaCarBurst, tint: 'text-stone-800' },
  nascar: { Icon: FaCarBurst, tint: 'text-stone-800' },
  motorsport: { Icon: FaCarBurst, tint: 'text-stone-800' },
  cricket: { Icon: FaVolleyball, tint: 'text-amber-700' },
  rugby: { Icon: FaFootball, tint: 'text-amber-900' },
  esports: { Icon: FaGamepad, tint: 'text-violet-700' },
}

const FALLBACK_SHAPE: SportShape = {
  Icon: FaPersonRunning,
  tint: 'text-stone-500',
}

function shapeFor(sport: string): SportShape {
  return SPORT_ICONS[sport.toLowerCase()] ?? FALLBACK_SHAPE
}

type Props = {
  platforms: string[]
  sports: string[]
  currentQuery: string
  currentPlatform: string
  currentSport: string
  currentCategory: string
  currentPhase: string
  currentSort: MarketSort
}

const CATEGORIES: Array<{ id: TerminalCategory; label: string }> = [
  { id: 'politics', label: 'Politics' },
  { id: 'economics', label: 'Economics' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'tech', label: 'Tech' },
  { id: 'other', label: 'Other' },
]

const PHASES: Array<{ id: MarketPhase; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'pre_game', label: 'Pre' },
  { id: 'opening', label: 'Opening' },
]

const SORTS: Array<{ id: MarketSort; label: string }> = [
  { id: 'volume', label: 'Volume' },
  { id: 'overround', label: 'Overround' },
  { id: 'resolves_at', label: 'Resolves soon' },
  { id: 'updated', label: 'Recently updated' },
]

export function FilterBar({
  platforms,
  sports,
  currentQuery,
  currentPlatform,
  currentSport,
  currentCategory,
  currentPhase,
  currentSort,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(currentQuery)
  const [pending, startTransition] = useTransition()

  // Filters are collapsed by default to cut vertical space. Auto-expand if any
  // filter is currently active so users always see what's filtering their view.
  const anyActive = !!(currentPlatform || currentSport || currentCategory || currentPhase)
  const [expanded, setExpanded] = useState(anyActive)

  function buildUrl(overrides: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('page')
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function go(overrides: Record<string, string | null>) {
    startTransition(() => {
      router.push(buildUrl(overrides))
    })
  }

  function clearAll() {
    startTransition(() => {
      router.push(buildUrl({
        q: null,
        platform: null,
        sport: null,
        category: null,
        phase: null,
      }))
    })
    setQ('')
  }

  function chip(value: string, label: string, param: string, current: string) {
    const active = current === value
    return (
      <button
        key={`${param}:${value || 'all'}`}
        type="button"
        onClick={() => go({ [param]: active ? null : value })}
        className={`text-[10px] tracking-wider px-2.5 py-1 rounded-full ring-1 transition ${
          active
            ? 'bg-[#004225] text-white ring-[#004225]'
            : 'bg-white ring-stone-300 text-stone-600 hover:ring-stone-400 hover:text-stone-900'
        }`}
      >
        {label.toUpperCase()}
      </button>
    )
  }

  // Book chip = venue logo + name. Same active/hover styling as `chip`,
  // just with the brand mark inline so users can recognize a book at a
  // glance without parsing the lowercase platform id.
  function bookChip(value: string, current: string) {
    const active = current === value
    return (
      <button
        key={`platform:${value}`}
        type="button"
        onClick={() => go({ platform: active ? null : value })}
        className={`inline-flex items-center gap-1.5 text-[10px] tracking-wider pl-1 pr-2.5 py-0.5 rounded-full ring-1 transition ${
          active
            ? 'bg-[#004225] text-white ring-[#004225]'
            : 'bg-white ring-stone-300 text-stone-600 hover:ring-stone-400 hover:text-stone-900'
        }`}
      >
        <PlatformLogo platform={value} size="xs" />
        <span>{value.toUpperCase()}</span>
      </button>
    )
  }

  // Sport chip = react-icons sport mark + display name. Falls back to a
  // generic "person running" icon for sports we don't have a mapping
  // for yet. Display name pulls from displaySport() so raw scraper ids
  // like ICE_HOCKEY render as "Hockey".
  function sportChip(value: string, current: string) {
    const active = current === value
    const { Icon, tint } = shapeFor(value)
    return (
      <button
        key={`sport:${value}`}
        type="button"
        onClick={() => go({ sport: active ? null : value })}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full ring-1 transition ${
          active
            ? 'bg-[#004225] text-white ring-[#004225]'
            : 'bg-white ring-stone-300 text-stone-700 hover:ring-stone-400 hover:text-stone-900'
        }`}
      >
        <Icon
          aria-hidden
          className={`h-[11px] w-[11px] shrink-0 ${active ? 'text-white' : tint}`}
        />
        <span>{displaySport(value)}</span>
      </button>
    )
  }

  // Active-filter summary pills shown in the collapsed bar. Each pill has a
  // tiny × to clear that single filter without opening the full panel.
  function activePill(param: string, label: string, value: string) {
    return (
      <span
        key={`active:${param}`}
        className="inline-flex items-center gap-1.5 text-[10px] tracking-wider px-2 py-1 rounded-full bg-[#004225]/10 text-[#004225] ring-1 ring-[#004225]/30"
      >
        <span className="text-stone-400">{label}:</span>
        <span className="font-semibold">{value.toUpperCase()}</span>
        <button
          type="button"
          onClick={() => go({ [param]: null })}
          className="text-[#004225]/60 hover:text-[#004225] transition"
          aria-label={`Clear ${label}`}
        >
          ×
        </button>
      </span>
    )
  }

  const activeFilters: Array<{ param: string; label: string; value: string }> = []
  if (currentCategory) activeFilters.push({ param: 'category', label: 'Category', value: currentCategory })
  if (currentPhase) activeFilters.push({ param: 'phase', label: 'Phase', value: currentPhase })
  if (currentPlatform) activeFilters.push({ param: 'platform', label: 'Book', value: currentPlatform })
  if (currentSport) activeFilters.push({ param: 'sport', label: 'Sport', value: currentSport })
  if (currentSort && currentSort !== 'volume') activeFilters.push({ param: 'sort', label: 'Sort', value: currentSort.replace('_', ' ') })

  return (
    <div className="space-y-3">
      {/* Single row: search + active filter summary + expand toggle */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          go({ q: q.trim() || null })
        }}
        className="flex gap-2 items-center flex-wrap"
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search player, team, question…"
          className="flex-1 min-w-[240px] bg-white ring-1 ring-stone-300 focus:ring-[#004225]/60 focus:outline-none px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition rounded"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-[#004225] hover:bg-[#00703c] text-white px-4 py-2 text-xs tracking-wider transition disabled:opacity-60 rounded font-semibold"
        >
          SEARCH
        </button>

        {/* Active filter pills inline, so users see what's filtering even when collapsed */}
        {activeFilters.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            {activeFilters.map((f) => activePill(f.param, f.label, f.value))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ring-1 ring-stone-300 text-stone-700 px-3 py-2 text-xs tracking-wider hover:bg-stone-100 hover:ring-stone-400 transition rounded inline-flex items-center gap-1.5"
        >
          {expanded ? 'HIDE' : 'FILTERS'}
          <span className="text-stone-400">{expanded ? '▴' : '▾'}</span>
        </button>

        {(activeFilters.length > 0 || currentQuery) && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-stone-500 hover:text-stone-900 tracking-wider transition"
          >
            clear all
          </button>
        )}
      </form>

      {expanded && (
        <div className="space-y-3 rounded-lg bg-white ring-1 ring-stone-200 p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-stone-500 tracking-wider pr-1 w-16">CATEGORY</span>
            {chip('', 'ALL', 'category', currentCategory)}
            {CATEGORIES.map((c) => chip(c.id, c.label, 'category', currentCategory))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-stone-500 tracking-wider pr-1 w-16">PHASE</span>
            {chip('', 'ALL', 'phase', currentPhase)}
            {PHASES.map((p) => chip(p.id, p.label, 'phase', currentPhase))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-stone-500 tracking-wider pr-1 w-16">BOOK</span>
            {chip('', 'ALL', 'platform', currentPlatform)}
            {platforms.map((p) => bookChip(p, currentPlatform))}
          </div>

          {sports.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-stone-500 tracking-wider pr-1 w-16">SPORT</span>
              {chip('', 'ALL', 'sport', currentSport)}
              {sports.map((s) => sportChip(s, currentSport))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-stone-500 tracking-wider pr-1 w-16">SORT</span>
            {SORTS.map((s) => chip(s.id, s.label, 'sort', currentSort))}
          </div>
        </div>
      )}
    </div>
  )
}
