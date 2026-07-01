'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnboardingFlow, type StepId, SIGNUP_ORDER, LOGIN_ORDER } from './use-onboarding-flow'
import { EmailPanel } from './panels/email-panel'

// ── Step meta ──────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<StepId, string> = {
  email: 'Email',
  password: 'Password',
  name: 'Your name',
  venues: 'Markets',
  confirm: 'Ready',
  loginPassword: 'Password',
}

// ── Ambient live ticker ────────────────────────────────────────────────────────
// Rotates through a small set of mock crypto signals. In production, swap
// the static TICKS array for a real feed. The ticker is purely ambient —
// it signals "live product" without demanding attention.

type Tick = { label: string; dir: '▲' | '▼'; value: string }
const TICKS: Tick[] = [
  { label: 'BTC 5m', dir: '▲', value: '+0.4%' },
  { label: 'ETH 5m', dir: '▼', value: '−0.2%' },
  { label: 'SOL 5m', dir: '▲', value: '+0.8%' },
  { label: 'BNB 5m', dir: '▲', value: '+0.1%' },
  { label: 'DOGE 15m', dir: '▼', value: '−1.1%' },
]

function AmbientTicker() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % TICKS.length)
        setVisible(true)
      }, 300)
    }, 3_500)
    return () => clearInterval(id)
  }, [])

  const tick = TICKS[idx]

  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-white/30 select-none"
    >
      <span
        className="transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <span className="text-white/20">{tick.label}</span>
        <span
          className={[
            'ml-1.5 font-semibold',
            tick.dir === '▲' ? 'text-emerald-400/60' : 'text-red-400/60',
          ].join(' ')}
        >
          {tick.dir} {tick.value}
        </span>
      </span>
    </div>
  )
}

// ── Progress rail (desktop: vertical left side) ────────────────────────────────

interface ProgressRailProps {
  order: StepId[]
  index: number
}

function ProgressRail({ order, index }: ProgressRailProps) {
  return (
    <nav
      aria-label="Onboarding steps"
      className="flex flex-col items-center gap-3"
    >
      {order.map((stepId, i) => {
        const isActive = i === index
        const isPast = i < index
        return (
          <div key={stepId} className="flex flex-col items-center gap-1">
            <div
              aria-label={`${STEP_LABELS[stepId]}${isActive ? ' (current)' : isPast ? ' (complete)' : ''}`}
              className={[
                'rounded-full transition-all duration-300',
                isActive
                  ? 'w-2 h-2 bg-blue-400 shadow-[0_0_8px_2px_rgba(96,165,250,0.5)]'
                  : isPast
                  ? 'w-1.5 h-1.5 bg-blue-400/40'
                  : 'w-1.5 h-1.5 bg-white/20',
              ].join(' ')}
            />
            {/* Connector line between dots */}
            {i < order.length - 1 && (
              <div
                className={[
                  'w-px h-5 transition-all duration-500',
                  isPast ? 'bg-blue-400/30' : 'bg-white/[0.08]',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Progress bar (mobile: top horizontal strip) ────────────────────────────────

interface ProgressBarProps {
  index: number
  total: number
}

function ProgressBar({ index, total }: ProgressBarProps) {
  const pct = total <= 1 ? 100 : Math.round((index / (total - 1)) * 100)
  return (
    <div className="h-0.5 w-full bg-white/[0.06] overflow-hidden rounded-full">
      <div
        className="h-full bg-blue-400 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Panel wrapper with enter/exit animation ────────────────────────────────────

interface AnimatedPanelProps {
  stepKey: string
  children: React.ReactNode
}

function AnimatedPanel({ stepKey, children }: AnimatedPanelProps) {
  const [displayed, setDisplayed] = useState(stepKey)
  const [opacity, setOpacity] = useState(1)
  const [translateY, setTranslateY] = useState(0)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // Fade out + drift up
    setOpacity(0)
    setTranslateY(-8)
    const swap = setTimeout(() => {
      setDisplayed(stepKey)
      setTranslateY(12)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpacity(1)
          setTranslateY(0)
        })
      })
    }, 180)
    return () => clearTimeout(swap)
  }, [stepKey])

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        transition: 'opacity 180ms ease, transform 180ms ease',
      }}
    >
      {/* key is the DISPLAYED step so React remounts panels on step change */}
      <div key={displayed}>{children}</div>
    </div>
  )
}

// ── Placeholder for steps not yet built (Tasks 4 & 5) ─────────────────────────

interface PanelPlaceholderProps {
  step: StepId
  flow: ReturnType<typeof useOnboardingFlow>
}

function PanelPlaceholder({ step, flow }: PanelPlaceholderProps) {
  const label = STEP_LABELS[step]

  return (
    // TODO(task 4): replace this placeholder with the real password panel
    // TODO(task 5): replace venue/name/confirm placeholders with real panels
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-[10px] tracking-widest text-blue-400/60 uppercase font-mono">
          Coming in Task 4 / 5
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {label}
        </h1>
        <p className="text-sm text-white/40">
          This panel is a placeholder — the real implementation ships in the next task.
        </p>
      </div>

      {/* Step data preview (dev aid) */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 text-xs font-mono text-white/40 space-y-1">
        <div>step: <span className="text-blue-300/70">{step}</span></div>
        <div>track: <span className="text-blue-300/70">{flow.track}</span></div>
        <div>email: <span className="text-blue-300/70">{flow.values.email || '—'}</span></div>
      </div>

      {/* Back control so shell is navigable during development */}
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

// ── Disc / coin logo ───────────────────────────────────────────────────────────

function DiscLogo() {
  return (
    <div className="flex items-center gap-2.5" aria-label="Sneakers Terminal">
      {/* The disc: a coin-shaped mark with a concentric ring detail */}
      <div
        className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_12px_2px_rgba(96,165,250,0.25)]"
        aria-hidden="true"
      >
        {/* Inner ring */}
        <div className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
        </div>
      </div>
      <span className="text-sm font-semibold tracking-tight text-white/90">
        Sneakers
      </span>
    </div>
  )
}

// ── AuthShell — the public API ─────────────────────────────────────────────────

export interface AuthShellProps {
  entry: 'login' | 'signup'
}

export function AuthShell({ entry }: AuthShellProps) {
  const flow = useOnboardingFlow(entry)

  // Choose correct order for the progress rail
  const order = flow.track === 'login' ? LOGIN_ORDER : SIGNUP_ORDER

  // The current step drives the panel content
  const currentStep = flow.step

  function renderPanel() {
    switch (currentStep) {
      case 'email':
        return <EmailPanel flow={flow} entry={entry} />
      default:
        return <PanelPlaceholder step={currentStep} flow={flow} />
    }
  }

  return (
    <div
      className="min-h-svh w-full flex flex-col"
      style={{ background: '#0b0d13' }}
    >
      {/*
        ── Mobile: top header ──────────────────────────────────────────────
        Logo + ticker side by side, progress bar below on small screens.
        Hidden on md+ (replaced by the left rail).
      */}
      <header className="flex flex-col gap-3 px-5 pt-5 pb-4 md:hidden">
        <div className="flex items-center justify-between">
          <DiscLogo />
          <AmbientTicker />
        </div>
        <ProgressBar index={flow.index} total={order.length} />
      </header>

      {/*
        ── Desktop layout: 3-column grid ───────────────────────────────────
        [left rail: logo + progress] [center: panel] [right: ambient ticker]
      */}
      <div className="flex-1 flex">
        {/* Left rail — desktop only */}
        <aside
          className="hidden md:flex flex-col items-center gap-8 px-10 py-10 w-[200px] shrink-0"
          aria-label="Navigation"
        >
          <DiscLogo />
          <div className="flex-1 flex items-center">
            <ProgressRail order={order} index={flow.index} />
          </div>
          {/* Step label below rail */}
          <div className="text-[10px] tracking-widest text-white/30 uppercase font-mono text-center">
            {flow.index + 1} / {order.length}
          </div>
        </aside>

        {/* Center: the active panel, vertically centered */}
        <main className="flex-1 flex items-center justify-center px-5 py-10 md:py-0">
          <div className="w-full max-w-sm">
            {/*
              Glass card — backdrop-blur not used here because the bg is opaque,
              but the subtle border + bg create the glassy shelf effect.
            */}
            <div
              className="rounded-2xl border border-white/[0.07] p-8"
              style={{
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              }}
            >
              <AnimatedPanel stepKey={currentStep}>
                {renderPanel()}
              </AnimatedPanel>
            </div>
          </div>
        </main>

        {/* Right ambient ticker — desktop only */}
        <aside
          className="hidden md:flex flex-col justify-end px-10 py-10 w-[200px] shrink-0"
          aria-hidden="true"
        >
          <AmbientTicker />
        </aside>
      </div>
    </div>
  )
}
