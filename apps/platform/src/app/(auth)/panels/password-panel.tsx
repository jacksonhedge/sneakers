'use client'

import { useState, useRef, useEffect } from 'react'
import type { OnboardingFlow } from '../use-onboarding-flow'
import { PASSWORD_MIN } from '../use-onboarding-flow'

interface PasswordPanelProps {
  flow: OnboardingFlow
}

export function PasswordPanel({ flow }: PasswordPanelProps) {
  const [localPassword, setLocalPassword] = useState(flow.values.password)
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isStrong = localPassword.length >= PASSWORD_MIN
  const showStrengthHint = localPassword.length > 0 && !isStrong
  const canContinue = flow.canAdvance

  function handleChange(v: string) {
    setLocalPassword(v)
    flow.set('password', v)
  }

  function handleContinue() {
    if (!canContinue) return
    flow.next()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleContinue()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">
          Create a password.
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          At least {PASSWORD_MIN} characters. You won't be asked to change it.
        </p>
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="auth-password"
          className="text-xs font-medium tracking-widest text-white/40 uppercase"
        >
          Password
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            spellCheck={false}
            value={localPassword}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            className={[
              'w-full px-4 py-3 pr-16 rounded-lg text-sm',
              'bg-white/[0.05] border text-white placeholder:text-white/25',
              'outline-none transition-all duration-150',
              'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
              showStrengthHint
                ? 'border-amber-500/40'
                : 'border-white/[0.08] focus-visible:border-blue-500/60',
            ].join(' ')}
            aria-describedby={showStrengthHint ? 'password-hint' : undefined}
          />
          {/* Show / hide toggle — never changes input type to text when hidden;
              only toggles the visible echo. spellCheck=false on input prevents
              spell-jacking regardless of type. */}
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

        {/* Inline strength hint */}
        {showStrengthHint && (
          <p
            id="password-hint"
            role="status"
            className="text-xs text-amber-400/80"
          >
            {PASSWORD_MIN - localPassword.length} more character
            {PASSWORD_MIN - localPassword.length === 1 ? '' : 's'} needed.
          </p>
        )}
      </div>

      {/* Continue */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!canContinue}
        className={[
          'relative w-full py-3 rounded-lg text-sm font-semibold',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          canContinue
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            : 'bg-white/[0.06] text-white/30 cursor-not-allowed',
        ].join(' ')}
      >
        Continue
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
