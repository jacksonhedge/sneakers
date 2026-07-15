'use client'
import { useRef } from 'react'
import { Orb } from './orb'
import type { AgentModel } from '../lib/types'

interface CoverFlowProps {
  models: AgentModel[]
  centerIndex: number
  equippedId: string
  paused: boolean
  phase: 'scanning' | 'entering' | 'holding' | 'paused'
  onCenter: (i: number) => void
  onOpen: (m: AgentModel) => void
}

function slotClass(delta: number): string {
  if (delta === 0) return 'ag-cf__item--p0'
  if (delta === -1) return 'ag-cf__item--m1'
  if (delta === 1) return 'ag-cf__item--p1'
  if (delta === -2) return 'ag-cf__item--m2'
  if (delta === 2) return 'ag-cf__item--p2'
  return 'ag-cf__item--hide'
}

export function CoverFlow({ models, centerIndex, equippedId, paused, phase, onCenter, onOpen }: CoverFlowProps) {
  const touchX = useRef<number | null>(null)
  const clamp = (i: number) => Math.max(0, Math.min(models.length - 1, i))
  return (
    <div
      className="ag-cf"
      role="group"
      aria-roledescription="carousel"
      aria-label={`Agents — ${models[centerIndex].name} selected. Use arrow keys to browse, Enter to open.`}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onCenter(clamp(centerIndex - 1)) }
        else if (e.key === 'ArrowRight') { e.preventDefault(); onCenter(clamp(centerIndex + 1)) }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(models[centerIndex]) }
      }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) < 30) return
        onCenter(clamp(centerIndex + (dx < 0 ? 1 : -1)))
      }}
    >
      {models.map((m, i) => (
        <div
          key={m.id}
          role="button"
          tabIndex={-1}
          aria-label={i === centerIndex ? `${m.name} — open details` : `${m.name} — bring to center`}
          className={'ag-cf__item ' + slotClass(i - centerIndex)}
          onClick={() => (i === centerIndex ? onOpen(m) : onCenter(i))}
        >
          <Orb
            color={m.color}
            emoji={m.emoji}
            size={150}
            live={m.id === equippedId && i === centerIndex && !paused}
            paused={m.id === equippedId && paused}
            phase={m.id === equippedId && phase !== 'paused' ? phase : undefined}
          />
        </div>
      ))}
    </div>
  )
}
