'use client'

import { useState, useRef, useEffect } from 'react'
import type { OnboardingFlow } from '../use-onboarding-flow'
import { canAdvanceStep } from '../use-onboarding-flow'

interface EmailPanelProps {
  flow: OnboardingFlow
  entry: 'login' | 'signup'
}

type CheckState = 'idle' | 'checking' | 'done' | 'error'

export function EmailPanel({ flow, entry }: EmailPanelProps) {
  const [localEmail, setLocalEmail] = useState(flow.values.email)
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the field on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const emailValues = { ...flow.values, email: localEmail }
  const isValidFormat = canAdvanceStep('email', emailValues)
  const canContinue = isValidFormat && checkState !== 'checking'

  async function handleContinue() {
    if (!canContinue) return

    const trimmed = localEmail.trim().toLowerCase()
    flow.set('email', trimmed)
    setCheckState('checking')
    setFallbackNote(null)

    try {
      const res = await fetch(
        `/api/auth/exists?email=${encodeURIComponent(trimmed)}`,
        { signal: AbortSignal.timeout(8_000) },
      )

      if (res.status === 429) {
        // Rate limited — fall through to signup with a note
        setFallbackNote("Too many attempts — we'll set you up fresh.")
        flow.setTrack('signup')
        setCheckState('done')
        return
      }

      if (!res.ok) {
        // Non-ok (5xx, network) — fall through to signup
        setFallbackNote("Couldn't verify your email — defaulting to sign up.")
        flow.setTrack('signup')
        setCheckState('done')
        return
      }

      const data = (await res.json()) as { ok: boolean; exists?: boolean; error?: string }

      if (!data.ok || data.error === 'invalid_email') {
        // Malformed email from server perspective — fall through
        setFallbackNote("Something looked off — we'll set you up fresh.")
        flow.setTrack('signup')
        setCheckState('done')
        return
      }

      // UNCONDITIONALLY call setTrack based on exists
      if (data.exists) {
        flow.setTrack('login')
      } else {
        flow.setTrack('signup')
      }
      setCheckState('done')
    } catch {
      // Network error / timeout — fall through to signup
      setFallbackNote("Couldn't reach our servers — defaulting to sign up.")
      flow.setTrack('signup')
      setCheckState('done')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleContinue()
    }
  }

  const headlineCopy =
    entry === 'login'
      ? "Welcome back."
      : "Let's get you into the markets."

  const subtextCopy =
    entry === 'login'
      ? "Enter your email and we'll find your account."
      : "Micro-bets on 5-minute crypto moves. Enter your email to start."

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">
          {headlineCopy}
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          {subtextCopy}
        </p>
      </div>

      {/* Email field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="auth-email"
          className="text-xs font-medium tracking-widest text-white/40 uppercase"
        >
          Email
        </label>
        <input
          ref={inputRef}
          id="auth-email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          value={localEmail}
          onChange={(e) => {
            setLocalEmail(e.target.value)
            setFallbackNote(null)
            setCheckState('idle')
          }}
          onKeyDown={handleKeyDown}
          placeholder="you@example.com"
          disabled={checkState === 'checking'}
          className={[
            'w-full px-4 py-3 rounded-lg text-sm',
            'bg-white/[0.05] border text-white placeholder:text-white/25',
            'outline-none transition-all duration-150',
            'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            localEmail && !isValidFormat
              ? 'border-red-500/50'
              : 'border-white/[0.08] focus-visible:border-blue-500/60',
          ].join(' ')}
          aria-describedby={
            (localEmail && !isValidFormat) ? 'email-error' :
            fallbackNote ? 'email-fallback-note' : undefined
          }
          aria-invalid={localEmail && !isValidFormat ? 'true' : undefined}
        />

        {/* Inline validation error */}
        {localEmail && !isValidFormat && (
          <p
            id="email-error"
            role="alert"
            className="text-xs text-red-400/90"
          >
            Enter a valid email address.
          </p>
        )}

        {/* Fallback note (rate-limit / network error) */}
        {fallbackNote && (
          <p
            id="email-fallback-note"
            role="status"
            className="text-xs text-amber-400/80"
          >
            {fallbackNote}
          </p>
        )}
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        aria-busy={checkState === 'checking'}
        className={[
          'relative w-full py-3 rounded-lg text-sm font-semibold',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          canContinue
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            : 'bg-white/[0.06] text-white/30 cursor-not-allowed',
        ].join(' ')}
      >
        {checkState === 'checking' ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Checking…
          </span>
        ) : (
          'Continue'
        )}
      </button>

      {/* Tiny policy note */}
      <p className="text-[11px] text-white/25 text-center leading-relaxed">
        By continuing you agree to our{' '}
        <a href="/terms" className="underline underline-offset-2 hover:text-white/50 transition-colors">
          Terms
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-white/50 transition-colors">
          Privacy Policy
        </a>.
      </p>
    </div>
  )
}

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
