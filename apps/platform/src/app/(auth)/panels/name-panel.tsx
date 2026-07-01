'use client'

import { useState, useRef, useEffect } from 'react'
import type { OnboardingFlow } from '../use-onboarding-flow'
import { NAME_MIN } from '../use-onboarding-flow'

interface NamePanelProps {
  flow: OnboardingFlow
}

export function NamePanel({ flow }: NamePanelProps) {
  const [localName, setLocalName] = useState(flow.values.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isValid = localName.trim().length >= NAME_MIN
  const showError = localName.length > 0 && !isValid

  function handleChange(v: string) {
    setLocalName(v)
    flow.set('name', v)
  }

  function handleContinue() {
    if (!isValid) return
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
          What should we call you?
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          This shows on the leaderboard and in your profile.
        </p>
      </div>

      {/* Name field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="auth-name"
          className="text-xs font-medium tracking-widest text-white/40 uppercase"
        >
          Display name
        </label>
        <input
          ref={inputRef}
          id="auth-name"
          type="text"
          autoComplete="name"
          spellCheck={false}
          value={localName}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your name"
          className={[
            'w-full px-4 py-3 rounded-lg text-sm',
            'bg-white/[0.05] border text-white placeholder:text-white/25',
            'outline-none transition-all duration-150',
            'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
            showError
              ? 'border-red-500/50'
              : 'border-white/[0.08] focus-visible:border-blue-500/60',
          ].join(' ')}
          aria-describedby={showError ? 'name-error' : undefined}
          aria-invalid={showError ? true : undefined}
        />

        {/* Inline validation */}
        {showError && (
          <p
            id="name-error"
            role="alert"
            className="text-xs text-red-400/90"
          >
            Name must be at least {NAME_MIN} characters.
          </p>
        )}
      </div>

      {/* Continue */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!isValid}
        className={[
          'relative w-full py-3 rounded-lg text-sm font-semibold',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
          isValid
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
