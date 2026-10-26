import { WORDMARK } from './wordmark-letters'

// The Sneakers wordmark (Peace Sans, cream letters with a navy outline and drop), drawn from outlines so it needs no font.
// One group per letter in each layer, keyed by data-sq: Squish moves a letter's drop, outline and fill together, and every
// drop stays under every letter, so a bouncing letter keeps the sticker look.
const NAVY = '#0B1E3F'
const CREAM = '#FFF3D6'

export function Wordmark({ className }: { className?: string }) {
  const { view, outline, drop, glyphs } = WORDMARK
  const outlined = (d: string) => <path d={d} fill={NAVY} stroke={NAVY} strokeWidth={outline} strokeLinejoin="round" />
  return (
    <svg viewBox={view} className={className} role="img" aria-label="Sneakers" style={{ overflow: 'visible', display: 'block' }}>
      <g transform={`translate(${drop.x} ${drop.y})`}>
        {glyphs.map((d, i) => (
          <g key={i} data-sq={`wm-${i}`}>{outlined(d)}</g>
        ))}
      </g>
      {glyphs.map((d, i) => (
        <g key={i} data-sq={`wm-${i}`}>{outlined(d)}</g>
      ))}
      {glyphs.map((d, i) => (
        <g key={i} data-sq={`wm-${i}`} style={{ cursor: 'pointer' }}>
          <path d={d} fill={CREAM} />
        </g>
      ))}
    </svg>
  )
}
