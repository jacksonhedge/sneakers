'use client'

import { VENUES } from '@/lib/venues'
import type { OnboardingFlow } from '../use-onboarding-flow'

interface VenuesPanelProps {
  flow: OnboardingFlow
}

// Only show venues that are actively live — these are the accounts
// users are most likely to want to connect right away.
const LIVE_VENUES = VENUES.filter((v) => v.status === 'live')

// De-duplicate by id (venues.ts has a duplicate 'opinion' entry)
const UNIQUE_LIVE_VENUES = LIVE_VENUES.filter(
  (v, i, arr) => arr.findIndex((u) => u.id === v.id) === i,
)

export function VenuesPanel({ flow }: VenuesPanelProps) {
  const selected = new Set(flow.values.venues)

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    flow.set('venues', Array.from(next))
  }

  function handleContinue() {
    // Persist selection for later connect-suggestions
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'sneakers_signup_venues',
        JSON.stringify(Array.from(selected)),
      )
    }
    flow.next()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">
          Where do you want to play?
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          Select any platforms you use. We'll suggest the best markets for you there.
          Skip if you're not sure yet.
        </p>
      </div>

      {/* Venue chips */}
      <div
        role="group"
        aria-label="Select your platforms"
        className="flex flex-wrap gap-2"
      >
        {UNIQUE_LIVE_VENUES.map((venue) => {
          const isSelected = selected.has(venue.id)
          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => toggle(venue.id)}
              aria-pressed={isSelected}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono tracking-wide',
                'border transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
                isSelected
                  ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                  : 'bg-white/[0.04] border-white/[0.10] text-white/50 hover:border-white/25 hover:text-white/75',
              ].join(' ')}
            >
              {/* Status dot */}
              <span
                aria-hidden="true"
                className={[
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isSelected ? 'bg-blue-400' : 'bg-emerald-400/50',
                ].join(' ')}
              />
              {venue.name}
            </button>
          )
        })}
      </div>

      {/* Selection count hint */}
      {selected.size > 0 && (
        <p className="text-xs text-white/30 -mt-3">
          {selected.size} platform{selected.size === 1 ? '' : 's'} selected
        </p>
      )}

      {/* Continue — always enabled */}
      <button
        type="button"
        onClick={handleContinue}
        className={[
          'relative w-full py-3 rounded-lg text-sm font-semibold',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer',
        ].join(' ')}
      >
        {selected.size === 0 ? 'Skip for now' : 'Continue'}
      </button>

      {/* Back */}
      {flow.index > 0 && (
        <button
          type="button"
          onClick={flow.back}
          className="self-start text-sm text-white/40 hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
        >
          ← Back
        </button>
      )}
    </div>
  )
}
