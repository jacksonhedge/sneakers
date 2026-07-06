import type { OrbColor } from '../lib/types'

interface OrbProps {
  color: OrbColor
  emoji?: string
  size: number
  live?: boolean
  paused?: boolean
  phase?: 'scanning' | 'entering' | 'holding'
}

export function Orb({ color, emoji, size, live, paused, phase }: OrbProps) {
  const cls = [
    'orb',
    `orb--${color}`,
    live ? 'orb--live' : '',
    paused ? 'orb--paused' : '',
    phase ? `orb--${phase}` : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ width: size, height: size, ['--orb-size' as string]: `${size}px` }}>
      <div className="orb__halo" />
      <div className="orb__blob" />
      <div className="orb__swirl" />
      {emoji ? <span className="orb__emoji">{emoji}</span> : null}
      <div className="orb__sheen" />
    </div>
  )
}
