'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { VENUES } from '@/lib/venues'
import type { OnboardingFlow } from '../use-onboarding-flow'
import { resolveAuthRedirect } from '@/lib/auth-redirect'

interface ConfirmPanelProps {
  flow: OnboardingFlow
}

type SubmitState = 'idle' | 'submitting' | 'queued'

// Inline format-check: 8-char alphanumeric code using the same alphabet as
// invite-code.ts. Cannot import invite-code.ts in a client component because
// it imports node:crypto and supabase-server.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function isValidInviteCodeFormat(code: string): boolean {
  if (typeof code !== 'string' || code.length !== 8) return false
  for (const ch of code) {
    if (!INVITE_ALPHABET.includes(ch)) return false
  }
  return true
}

export function ConfirmPanel({ flow }: ConfirmPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null)

  // Source invite code the same way signup-form's page.tsx does:
  // read ?code from URL, validate format, uppercase it.
  const rawCode = searchParams.get('code')?.toUpperCase() ?? null
  const inviteCode =
    rawCode && isValidInviteCodeFormat(rawCode) ? rawCode : null

  // Resolve selected venue names for the review
  const venueNames = flow.values.venues
    .map((id) => VENUES.find((v) => v.id === id)?.name ?? id)
    .filter(Boolean)

  async function handleSubmit() {
    if (submitState === 'submitting') return
    setSubmitState('submitting')
    setError(null)

    const payload: { email: string; name: string; password: string; code?: string } = {
      email: flow.values.email.trim().toLowerCase(),
      name: flow.values.name.trim(),
      password: flow.values.password,
    }
    if (inviteCode) payload.code = inviteCode

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
        hasAccess?: boolean
        needsEmailConfirmation?: boolean
      }

      if (res.ok && json.ok) {
        if (json.hasAccess && !json.needsEmailConfirmation) {
          const host = typeof window !== 'undefined' ? window.location.host : ''
          router.push(resolveAuthRedirect(searchParams, host))
          router.refresh()
          return
        }
        // Needs email confirmation or no immediate access — show queued state
        setConfirmedEmail(flow.values.email.trim().toLowerCase())
        setSubmitState('queued')
        return
      }

      // Error path
      setSubmitState('idle')

      if (json.error === 'email_in_use' || json.error === 'invite_used') {
        // Show brief affordance, then jump to login track
        setError('account_exists')
        setTimeout(() => {
          flow.setTrack('login')
        }, 1_200)
        return
      }

      setError(
        json.message ??
          'Something went wrong. Try again, or contact support if it keeps failing.',
      )
    } catch {
      setSubmitState('idle')
      setError("Couldn't reach our servers. Check your connection and try again.")
    }
  }

  // ── Queued / email-confirmation state ──
  if (submitState === 'queued' && confirmedEmail) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] tracking-widest text-blue-400/60 uppercase font-mono">
            Account created
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">
            Check your email.
          </h1>
          <p className="text-sm text-white/50 leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="font-mono text-white/70">{confirmedEmail}</span>.
            Click it to activate your account, then sign in.
          </p>
        </div>

        <div className="rounded-lg bg-blue-500/[0.07] border border-blue-500/20 px-4 py-3">
          <p className="text-xs text-blue-300/80 leading-relaxed">
            Didn't get it? Check your spam folder, or{' '}
            <a
              href="/login"
              className="underline underline-offset-2 hover:text-blue-200 transition-colors"
            >
              try signing in
            </a>{' '}
            — sometimes it gets there fast.
          </p>
        </div>

        <a
          href="/login"
          className={[
            'block w-full py-3 rounded-lg text-sm font-semibold text-center',
            'transition-all duration-150',
            'bg-blue-600 hover:bg-blue-500 text-white',
          ].join(' ')}
        >
          Go to sign in →
        </a>
      </div>
    )
  }

  const isSubmitting = submitState === 'submitting'

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">
          Ready to trade.
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          Review your details, then create your account.
        </p>
      </div>

      {/* Review surface */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05]">
        <ReviewRow label="Email" value={flow.values.email} />
        <ReviewRow label="Name" value={flow.values.name} />
        <ReviewRow
          label="Markets"
          value={
            venueNames.length > 0
              ? venueNames.join(', ')
              : 'None selected'
          }
          muted={venueNames.length === 0}
        />
        {inviteCode && (
          <ReviewRow label="Invite code" value={inviteCode} />
        )}
      </div>

      {/* Inline error */}
      {error && error !== 'account_exists' && (
        <div
          role="alert"
          className="text-xs text-red-400/90 bg-red-950/30 border border-red-500/20 rounded-lg px-4 py-3 leading-relaxed"
        >
          <span className="font-mono text-red-400/60 mr-1.5">{'>'}</span>
          {error}
        </div>
      )}

      {/* email_in_use — brief note before the redirect */}
      {error === 'account_exists' && (
        <div
          role="status"
          className="text-xs text-amber-400/80 leading-relaxed"
        >
          Account already exists — signing you in…
        </div>
      )}

      {/* Primary CTA */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || error === 'account_exists'}
        aria-busy={isSubmitting}
        className={[
          'relative w-full py-3 rounded-lg text-sm font-semibold',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          isSubmitting || error === 'account_exists'
            ? 'bg-white/[0.06] text-white/30 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer',
        ].join(' ')}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Creating account…
          </span>
        ) : (
          'Create account & enter →'
        )}
      </button>

      {/* Back */}
      {flow.index > 0 && !isSubmitting && (
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

// ── Review row ──────────────────────────────────────────────────────────────

interface ReviewRowProps {
  label: string
  value: string
  muted?: boolean
}

function ReviewRow({ label, value, muted = false }: ReviewRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-[10px] tracking-widest text-white/35 uppercase font-mono shrink-0 mt-px">
        {label}
      </span>
      <span
        className={[
          'text-xs text-right leading-relaxed',
          muted ? 'text-white/25 italic' : 'text-white/70',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
