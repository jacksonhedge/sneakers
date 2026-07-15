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
    'ag-orb',
    `ag-orb--${color}`,
    live ? 'ag-orb--live' : '',
    paused ? 'ag-orb--paused' : '',
    phase ? `ag-orb--${phase}` : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ width: size, height: size, ['--orb-size' as string]: `${size}px` }}>
      <div className="ag-orb__halo" />
      <div className="ag-orb__blob" />
      <div className="ag-orb__swirl" />
      {emoji ? <span className="ag-orb__emoji">{emoji}</span> : null}
      <div className="ag-orb__sheen" />
    </div>
  )
}
