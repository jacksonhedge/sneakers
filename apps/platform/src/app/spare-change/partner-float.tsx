import { PARTNERS, partnerLinkOk, type Partner } from '@/lib/spare-change-partners'
import { NAVY } from '../visuals'

// The partner logos around the page. Wide screens (1280px+): sticker tiles down the right edge, each bobbing a little on its own
// beat, with a few large faint ones behind everything. Narrow screens have no room at the sides, so the faint ones stay and the tiles
// come back as one small row (PartnerRow) inside the page. Every tile is a link (see spare-change-partners.ts). The bobbing stops
// for people who ask for less motion (.sc-bob in globals.css).

type Spot = { lane: 'outer' | 'inner'; size: string; tilt: number; dur: number; delay: number }
// One spot per partner, in PARTNERS order, down the right edge in two staggered lanes (the left edge holds the real posts,
// story-float.tsx). Tile n sits at 114px + n x --tile-gap, so the lanes start level with the title and end level with the left
// column at every width (the gap grows with the posts' scale). The outer lane matches the posts' 2vw edge; the inner one is 80px in.
const SPOTS: readonly Spot[] = [
  { lane: 'outer', size: '6rem', tilt: 7, dur: 4.8, delay: 0.6 },
  { lane: 'inner', size: '5.25rem', tilt: -8, dur: 4.2, delay: 0 },
  { lane: 'outer', size: '5.5rem', tilt: -6, dur: 4.4, delay: 0.3 },
  { lane: 'inner', size: '5.25rem', tilt: 6, dur: 5.2, delay: 1.1 },
  { lane: 'outer', size: '6rem', tilt: 5, dur: 5.4, delay: 1.4 },
  { lane: 'inner', size: '5.25rem', tilt: -4, dur: 4.9, delay: 0.9 },
  { lane: 'outer', size: '5.5rem', tilt: 8, dur: 4.6, delay: 0.5 },
]
// From 1800px the two lanes (80px apart, tiles up to 96px: 176px in all) are centered in the space right of the page instead.
const LANE = { outer: 'var(--lane-right)', inner: 'calc(var(--lane-right) + 80px)' } as const
// The big faint ones in the background: which partner, and where.
const GHOSTS: ReadonlyArray<{ i: number; top: string; left: string; size: string; tilt: number; dur: number; delay: number }> = [
  { i: 0, top: '4%', left: '24%', size: '15rem', tilt: -12, dur: 7, delay: 0.2 },
  { i: 1, top: '30%', left: '62%', size: '17rem', tilt: 10, dur: 8, delay: 1.2 },
  { i: 2, top: '58%', left: '18%', size: '16rem', tilt: 8, dur: 7.5, delay: 0.7 },
  { i: 4, top: '78%', left: '58%', size: '14rem', tilt: -9, dur: 8.5, delay: 1.6 },
]

const bob = (dur: number, delay: number) => ({ ['--sc-dur' as string]: `${dur}s`, ['--sc-delay' as string]: `${delay}s` })

function Tile({ p, size, tilt }: { p: Partner; size: string; tilt: number }) {
  const label = `${p.name}${p.minAge > 18 ? `, ${p.minAge}+` : ''}`
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.logo} alt="" width={160} height={160} loading="lazy" decoding="async" className={`size-full ${p.fit === 'cover' ? 'object-cover' : 'object-contain p-[12%]'}`} />
      {p.minAge > 18 ? (
        <span className="absolute -bottom-2 -right-2 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: '#FFF3D6', color: NAVY, border: `0.12rem solid ${NAVY}`, fontFamily: 'var(--font-open-sauce), sans-serif' }}>
          {p.minAge}+
        </span>
      ) : null}
    </>
  )
  const style = { width: size, height: size, background: p.tile, border: `0.2rem solid ${NAVY}`, borderRadius: '24%', boxShadow: `0.3rem 0.35rem 0 ${NAVY}`, transform: `rotate(${tilt}deg)` } as const
  const cls = 'pointer-events-auto relative block transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
  return partnerLinkOk(p) ? (
    <a href={p.href} target="_blank" rel="noopener noreferrer sponsored" aria-label={label} title={label} className={cls} style={style}>
      <span className="block size-full overflow-hidden" style={{ borderRadius: '20%' }}>{body}</span>
    </a>
  ) : (
    <span role="img" aria-label={label} className={cls} style={style}>
      <span className="block size-full overflow-hidden" style={{ borderRadius: '20%' }}>{body}</span>
    </span>
  )
}

/** The layer behind the page: faint giants everywhere, sticker tiles at the sides on wide screens. Put it first inside a `relative overflow-hidden` box. */
export function PartnerFloat() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div aria-hidden="true">
        {GHOSTS.map((g) => {
          const p = PARTNERS[g.i]
          return (
            <div key={`ghost-${p.key}`} className="sc-bob absolute opacity-[0.13]" style={{ top: g.top, left: g.left, ...bob(g.dur, g.delay) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" width={320} height={320} loading="lazy" decoding="async" className={p.fit === 'cover' ? 'object-cover' : 'object-contain p-[12%]'} style={{ width: g.size, height: g.size, background: p.tile, borderRadius: '24%', transform: `rotate(${g.tilt}deg)` }} />
            </div>
          )
        })}
      </div>
      {/* Same breakpoint as the posts on the left (xl): below it the tiles become PartnerRow. */}
      <ul className="hidden [--lane-right:2vw] [--tile-gap:159px] min-[1440px]:[--tile-gap:176px] min-[1536px]:[--tile-gap:186px] min-[1800px]:[--lane-right:max(2vw,calc((50%_-_336px_-_176px)/2))] min-[1800px]:[--tile-gap:208px] xl:block" aria-label="Sites we cover">
        {PARTNERS.map((p, i) => {
          const s = SPOTS[i % SPOTS.length]
          return (
            <li key={p.key} className="sc-bob absolute" style={{ top: `calc(114px + ${i} * var(--tile-gap))`, right: LANE[s.lane], ...bob(s.dur, s.delay) }}>
              <Tile p={p} size={s.size} tilt={s.tilt} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The same tiles as one small bobbing row, for screens with no room at the sides (under 1280px). */
export function PartnerRow() {
  return (
    // One row: 52px tiles 12px apart from 640px (436px wide), 40px tiles 8px apart below it (328px), so nothing wraps.
    <ul className="flex max-w-md flex-wrap items-center justify-center gap-2 [--row-tile:2.5rem] sm:gap-3 sm:[--row-tile:3.25rem] xl:hidden" aria-label="Sites we cover">
      {PARTNERS.map((p, i) => (
        <li key={p.key} className="sc-bob" style={bob(4 + (i % 3) * 0.5, i * 0.25)}>
          <Tile p={p} size="var(--row-tile)" tilt={i % 2 ? 5 : -5} />
        </li>
      ))}
    </ul>
  )
}
