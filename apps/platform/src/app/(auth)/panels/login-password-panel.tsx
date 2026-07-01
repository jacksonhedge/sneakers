'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { OnboardingFlow } from '../use-onboarding-flow'
import { MagicLinkButton } from '@/app/login/magic-link-button'
import { resolveAuthRedirect } from '@/lib/auth-redirect'

// "Remember me" mirrors email-form.tsx exactly:
// persists the email (never the password) in localStorage.
const REMEMBER_KEY = 'sneakers_login_remember'

interface LoginPasswordPanelProps {
  flow: OnboardingFlow
}

type SubmitPhase = 'idle' | 'signing-in' | 'redirecting'

export function LoginPasswordPanel({ flow }: LoginPasswordPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [localPassword, setLocalPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore remembered email preference on mount. Mirror email-form.tsx.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REMEMBER_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { email?: string; remember?: boolean }
      if (typeof parsed.remember === 'boolean') setRemember(parsed.remember)
    } catch {
      // corrupt entry — ignore
    }
  }, [])

  // Focus the password field on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const email = flow.values.email
  const canLogin = flow.canAdvance && submitPhase === 'idle'
  const busy = submitPhase === 'signing-in'

  function handleChange(v: string) {
    setLocalPassword(v)
    flow.set('password', v)
    // Clear error when user starts typing again
    if (error) setError(null)
  }

  async function handleLogin() {
    if (!canLogin) return
    const normalized = email.trim().toLowerCase()
    setSubmitPhase('signing-in')
    setError(null)

    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: normalized, password: localPassword }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
    }

    if (res.ok && data.ok) {
      // Persist remember-me preference (email, never password). Mirror email-form.tsx.
      try {
        if (remember) {
          window.localStorage.setItem(
            REMEMBER_KEY,
            JSON.stringify({ email: normalized, remember: true }),
          )
        } else {
          window.localStorage.removeItem(REMEMBER_KEY)
        }
      } catch {
        // localStorage disabled in private mode — harmless
      }
      setSubmitPhase('redirecting')
      const host = typeof window !== 'undefined' ? window.location.host : ''
      router.push(resolveAuthRedirect(searchParams, host))
      router.refresh()
      return
    }

    // Wrong password or other error — stay on panel, never stuck in submitting
    setError(
      "Email or password didn't match. Try again, or use a magic link below.",
    )
    // Reset to idle so the button re-enables
    setSubmitPhase('idle')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleLogin()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">
          Welcome back.
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          Enter your password to continue.
        </p>
      </div>

      {/* Read-only email row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <span className="text-sm text-white/60 truncate min-w-0" aria-label="Logging in as">
          {email}
        </span>
        <button
          type="button"
          onClick={() => flow.goTo('email')}
          className="shrink-0 text-xs text-white/35 hover:text-white/65 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          Not you? Edit
        </button>
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="auth-login-password"
          className="text-xs font-medium tracking-widest text-white/40 uppercase"
        >
          Password
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="auth-login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            spellCheck={false}
            value={localPassword}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            disabled={busy}
            className={[
              'w-full px-4 py-3 pr-16 rounded-lg text-sm',
              'bg-white/[0.05] border text-white placeholder:text-white/25',
              'outline-none transition-all duration-150',
              'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-red-500/40'
                : 'border-white/[0.08] focus-visible:border-blue-500/60',
            ].join(' ')}
            aria-describedby={error ? 'login-error' : undefined}
            aria-invalid={error ? true : undefined}
          />
          {/* Show / hide toggle — matches password-panel.tsx exactly */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className={[
              'absolute right-3 top-1/2 -translate-y-1/2',
              'text-[10px] tracking-widest font-semibold',
              'text-white/35 hover:text-white/60 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded',
            ].join(' ')}
          >
            {showPassword ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {/* Inline error */}
        {error && (
          <p
            id="login-error"
            role="alert"
            className="text-xs text-red-400/90"
          >
            {error}
          </p>
        )}
      </div>

      {/* Remember me — persists email, never password. Mirror email-form.tsx. */}
      <label className="flex items-center gap-2.5 text-xs text-white/50 cursor-pointer select-none -mt-2">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.05] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-1"
        />
        <span>
          Remember me
          <span className="text-white/30"> — pre-fills your email next time. Your browser handles the password.</span>
        </span>
      </label>

      {/* Log in */}
      <button
        type="button"
        onClick={handleLogin}
        disabled={!canLogin}
        aria-busy={busy}
        className={[
          'relative w-full py-3 rounded-lg text-sm font-semibold',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          canLogin
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            : 'bg-white/[0.06] text-white/30 cursor-not-allowed',
        ].join(' ')}
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Signing in…
          </span>
        ) : (
          'Log in'
        )}
      </button>

      {/* Forgot password */}
      <div className="text-center -mt-2">
        <a
          href="/forgot-password"
          className="text-xs text-white/35 hover:text-white/60 transition-colors underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          Forgot password?
        </a>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[10px] text-white/25 tracking-widest uppercase">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Magic link fallback — dark-scoped wrapper so MagicLinkButton's
          light-mode styles (blue-50/red-50 bg, blue-700/red-700 text) read
          correctly on the #0b0d13 shell. We do NOT edit the shared component. */}
      <div className="[&_button]:bg-white/[0.08] [&_button]:text-white/70 [&_button]:ring-white/10 [&_button]:hover:bg-white/[0.14] [&_button]:hover:text-white [&_button]:rounded-lg [&_div:not(:first-child)]:bg-transparent [&_div:not(:first-child)]:border-white/[0.12] [&_div:not(:first-child)]:text-white/60">
        <MagicLinkButton
          email={email}
          label="Email me a magic link instead"
        />
      </div>
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
