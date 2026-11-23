import { NAVY } from '../visuals'

// Real long shots, as post cards. Wide screens: down the left edge, bobbing like the partner tiles on the right. Narrower screens have
// no room at the side, so the same cards stack inside the page (StoryRow). Every card is something that happened, with its source, and
// one is a miss, because most long shots miss. Nothing here is our ticket or our result.

type Story = {
  key: string
  who: string
  where: string
  date: string
  text: string
  buyIn: string
  payout: string
  hit: boolean
  outcome: string
  href: string
}

export const STORIES: readonly Story[] = [
  { key: 'hardrock-96k', who: 'Hard Rock Bet', where: '@HardRockBet on X', date: 'Nov 23, 2026', text: 'One dollar. 7 legs. One dream.', buyIn: '$1', payout: '$96,473.44', hit: true, outcome: 'All 7 hit', href: 'https://x.com/HardRockBet' },
  { key: 'fox-19-leg', who: 'FOX Sports', where: 'Big Bets Report', date: 'Mar 24, 2026', text: 'A 19-leg college hoops parlay at Hard Rock Bet.', buyIn: '$1', payout: '$4,590', hit: true, outcome: 'All 19 hit', href: 'https://www.foxsports.com/stories/betting/big-bets-report-pocket-change-parlays-pay-major-dividends-bettors' },
  { key: 'fox-50-cents', who: 'FOX Sports', where: 'Big Bets Report', date: 'Mar 24, 2026', text: 'Couch-cushion change on a 10-leg parlay at Fanatics.', buyIn: '$0.50', payout: '$3,663', hit: true, outcome: 'All 10 hit', href: 'https://www.foxsports.com/stories/betting/big-bets-report-pocket-change-parlays-pay-major-dividends-bettors' },
  { key: 'cbs-89-cents', who: 'CBS Sports', where: 'NFL', date: 'Sep 25, 2019', text: '89 cents on 20 legs. The first 19 hit.', buyIn: '$0.89', payout: '~$500,000', hit: false, outcome: 'Missed the last leg', href: 'https://www.cbssports.com/nfl/news/bettors-89-cent-20-team-parlay-misses-500k-payout-because-of-redskins-loss' },
]

const CREAM = '#FFF3D6'
const GREEN = '#0F7A45'
const RED = '#B42318'
const sauce = 'var(--font-open-sauce), sans-serif'
const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const bob = (dur: number, delay: number) => ({ ['--sc-dur' as string]: `${dur}s`, ['--sc-delay' as string]: `${delay}s` })

// Where each card sits down the left edge on wide screens.
const SPOTS = [
  { top: '7%', inset: '2.5vw', tilt: -3, dur: 4.6, delay: 0 },
  { top: '30%', inset: '4vw', tilt: 2.5, dur: 5.1, delay: 0.7 },
  { top: '53%', inset: '2vw', tilt: -2, dur: 4.8, delay: 1.2 },
  { top: '76%', inset: '3.5vw', tilt: 3, dur: 5.4, delay: 0.4 },
] as const

function Card({ s, tilt = 0 }: { s: Story; tilt?: number }) {
  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${s.who}, ${s.date}: ${s.buyIn} to ${s.payout}. ${s.outcome}. Opens the source.`}
      className="pointer-events-auto block w-[15rem] px-4 py-3.5 text-left transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, borderRadius: '1.1rem', boxShadow: `0.3rem 0.35rem 0 ${NAVY}`, transform: `rotate(${tilt}deg)`, fontFamily: sauce }}
    >
      <span className="flex items-baseline justify-between gap-2 text-sm font-bold">
        <span>{s.who}</span>
        <span className="text-xs font-semibold opacity-70">{s.date}</span>
      </span>
      <span className="block text-xs font-semibold opacity-70">{s.where}</span>
      <span className="mt-2 block text-sm font-semibold leading-snug">{s.text}</span>
      {/* A long amount steps down a size so it stays inside the card. */}
      <span className={`mt-2 block whitespace-nowrap leading-none tabular-nums ${(s.buyIn + s.payout).length > 13 ? 'text-[1.15rem]' : 'text-[1.45rem]'}`} style={{ fontFamily: peace }}>
        {s.buyIn} → {s.payout}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
        <span className="whitespace-nowrap rounded-full px-2 py-0.5" style={{ background: s.hit ? GREEN : RED, color: CREAM }}>
          {s.outcome}
        </span>
        <span className="whitespace-nowrap underline">Source ↗</span>
      </span>
    </a>
  )
}

/** Wide screens: the story cards down the left edge. Put it inside the page's `relative overflow-hidden` box, beside PartnerFloat. */
export function StoryFloat() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden xl:block">
      <ul aria-label="Real long shots">
        {STORIES.map((s, i) => {
          const p = SPOTS[i % SPOTS.length]
          return (
            <li key={s.key} className="sc-bob absolute" style={{ top: p.top, left: p.inset, ...bob(p.dur, p.delay) }}>
              <Card s={s} tilt={p.tilt} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Narrower screens: the same cards, stacked inside the page. */
export function StoryRow() {
  return (
    <section aria-labelledby="stories-heading" className="flex w-full max-w-md flex-col items-center gap-4 xl:hidden">
      <h2 id="stories-heading" className="text-lg font-bold" style={{ fontFamily: sauce }}>
        Real long shots
      </h2>
      <ul className="flex flex-wrap justify-center gap-4">
        {STORIES.map((s, i) => (
          <li key={s.key}>
            <Card s={s} tilt={i % 2 ? 1.5 : -1.5} />
          </li>
        ))}
      </ul>
    </section>
  )
}
