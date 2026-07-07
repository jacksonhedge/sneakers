'use client'
import { useRef, useState } from 'react'
import { formatMoney } from '../lib/format'

const W = 320, H = 96, P = 8

export function Sparkline({ values }: { values: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const min = Math.min(...values), max = Math.max(...values)
  const X = (i: number) => P + (i * (W - 2 * P)) / (values.length - 1)
  const Y = (v: number) => H - P - 14 - ((v - min) / (max - min || 1)) * (H - 2 * P - 22)
  const pts = values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')
  const area = `${P},${H - P} ${pts} ${W - P},${H - P}`

  function locate(clientX: number) {
    const r = svgRef.current!.getBoundingClientRect()
    const i = Math.round(((clientX - r.left) / r.width) * (values.length - 1))
    setHover(Math.max(0, Math.min(values.length - 1, i)))
  }

  return (
    <div className="ag-card" style={{ position: 'relative', padding: '14px 6px 6px' }}>
      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Balance, last 7 days"
        onMouseMove={e => locate(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchStart={e => locate(e.touches[0].clientX)} onTouchMove={e => locate(e.touches[0].clientX)} onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2FD37A" stopOpacity=".28" />
            <stop offset="1" stopColor="#2FD37A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={P} y1={Y(values[0])} x2={W - P} y2={Y(values[0])} stroke="#232b31" strokeDasharray="3 4" strokeWidth="1" />
        <polygon points={area} fill="url(#sparkfill)" />
        <polyline points={pts} fill="none" stroke="#2FD37A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1])} r="4" fill="#2FD37A" stroke="#14181D" strokeWidth="2" />
        {hover !== null && (
          <>
            <line x1={X(hover)} y1={P} x2={X(hover)} y2={H - P} stroke="#3a444d" strokeWidth="1" />
            <circle cx={X(hover)} cy={Y(values[hover])} r="4.5" fill="#2FD37A" stroke="#14181D" strokeWidth="2" />
          </>
        )}
      </svg>
      {hover !== null && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', background: '#1e252b', border: '1px solid #2a323a',
          borderRadius: 9, padding: '6px 9px', fontSize: 11.5, whiteSpace: 'nowrap',
          left: `${(X(hover) / W) * 100}%`, top: `${(Y(values[hover]) / H) * 100}%`, transform: 'translate(-50%,-115%)',
        }}>
          <b className="ag-num">{formatMoney(values[hover])}</b>
        </div>
      )}
    </div>
  )
}
