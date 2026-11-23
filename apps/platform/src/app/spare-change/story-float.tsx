import { Tweet } from 'react-tweet'
import { NAVY } from '../visuals'

// Real posts from X, drawn from X's own embed data (react-tweet: the account, the text, the slip photos), each in a sticker frame.
// Wide screens: down the left edge, bobbing like the partner tiles on the right. Narrower screens: stacked below the form (StoryRow).
// When a post doesn't say how the ticket ended, a caption does: most long shots miss, and one of these did.

type Post = { id: string; caption?: string }

export const POSTS: readonly Post[] = [
  // Hard Rock Bet, Nov 23, 2026: "ONE DOLLAR 7 LEGS ONE DREAM $1 ➡️ $96,473.44" (the winning slip in the photos).
  { id: '2124990101893636297' },
  // B/R Betting, Feb 23, 2022: "$1.10 into $532K off CBB", a 23-leg college basketball parlay at FanDuel.
  { id: '1496623774812327941' },
  // Sep 24, 2019: an 89-cent, 20-leg parlay one game from half a million. It lost.
  { id: '1176310867052265472', caption: 'It missed on the last leg. (CBS Sports, Sep 2019)' },
]

const CREAM = '#FFF3D6'
const GREEN = '#0F7A45'
const sauce = 'var(--font-open-sauce), sans-serif'
const peace = 'var(--font-peace), var(--font-open-sauce), sans-serif'
const bob = (dur: number, delay: number) => ({ ['--sc-dur' as string]: `${dur}s`, ['--sc-delay' as string]: `${delay}s` })

// Each post's own tilt and bob in the left column on wide screens.
const SPOTS = [
  { tilt: -2.5, dur: 5.2, delay: 0 },
  { tilt: 2, dur: 5.8, delay: 0.8 },
  { tilt: -1.5, dur: 5.5, delay: 0.4 },
] as const

// A post X no longer serves (deleted, or the account went private): one plain line instead of X's error card.
const Missing = () => <p className="m-0 p-4 text-sm" style={{ color: NAVY, fontFamily: sauce }}>This post is no longer on X.</p>

function Framed({ p, tilt = 0 }: { p: Post; tilt?: number }) {
  return (
    <figure className="pointer-events-auto m-0 flex flex-col gap-2" style={{ transform: `rotate(${tilt}deg)` }}>
      <div data-theme="light" className="overflow-hidden" style={{ border: `0.2rem solid ${NAVY}`, borderRadius: '1.1rem', boxShadow: `0.35rem 0.4rem 0 ${NAVY}`, background: '#FFFFFF', ['--tweet-container-margin' as string]: '0' }}>
        <Tweet id={p.id} components={{ TweetNotFound: Missing }} />
      </div>
      {p.caption ? (
        <figcaption className="rounded-full px-3 py-1 text-center text-sm font-bold" style={{ background: CREAM, color: NAVY, border: `0.15rem solid ${NAVY}`, fontFamily: sauce }}>
          {p.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** Wide screens: the posts down the left edge. Put it inside the page's `relative overflow-hidden` box, beside PartnerFloat. */
export function StoryFloat() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden xl:block">
      {/* One column, the posts close together. Drawn at a readable width, then scaled to fit beside the page (more room from 1536px up). */}
      <ul aria-label="Real long shots on X" className="absolute flex w-[30rem] flex-col gap-10 [zoom:0.58] 2xl:[zoom:0.74]" style={{ top: '5%', left: '2.5vw' }}>
        {POSTS.map((p, i) => {
          const s = SPOTS[i % SPOTS.length]
          return (
            <li key={p.id} className="sc-bob" style={bob(s.dur, s.delay)}>
              <Framed p={p} tilt={s.tilt} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Narrower screens: the same posts, stacked below the form. */
export function StoryRow() {
  return (
    <section aria-labelledby="stories-heading" className="flex w-full max-w-md flex-col items-center gap-5 xl:hidden">
      <h2 id="stories-heading" className="text-lg font-bold" style={{ fontFamily: sauce }}>
        Real long shots
      </h2>
      <ul className="flex w-full flex-col gap-6">
        {POSTS.map((p, i) => (
          <li key={p.id} className="w-full">
            <Framed p={p} tilt={i % 2 ? 1 : -1} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// More real long shots that hit, from reporting with no post to show: sourced cards in a grid below the form, on every screen.
type Story = { key: string; who: string; date: string; text: string; buyIn: string; payout: string; outcome: string; href: string }

const FOX_130K = 'https://www.foxsports.com/stories/college-football/big-bets-report-bettors-1-20-leg-parlay-cashes-130k'
const FOX_MENDOZA = 'https://foxsports.com/stories/nfl/big-bets-report-fernando-mendozas-1st-nfl-td-helps-bettor-win-58k'
const FOX_POCKET = 'https://www.foxsports.com/stories/betting/big-bets-report-pocket-change-parlays-pay-major-dividends-bettors'

export const STORIES: readonly Story[] = [
  { key: 'hardrock-130k', who: 'FOX Sports', date: 'Sep 2026', text: 'A 20-leg college football parlay at Hard Rock Bet.', buyIn: '$1.06', payout: '$130,636.47', outcome: 'All 20 hit', href: FOX_130K },
  { key: 'hardrock-first-td', who: 'FOX Sports', date: 'Nov 2026', text: 'Three first-touchdown picks at Hard Rock Bet, with a 20% profit boost.', buyIn: '$2', payout: '$8,735', outcome: 'All 3 hit', href: FOX_MENDOZA },
  { key: 'hardrock-19-leg', who: 'FOX Sports', date: 'Mar 2026', text: 'A 19-leg college hoops parlay at Hard Rock Bet.', buyIn: '$1', payout: '$4,590', outcome: 'All 19 hit', href: FOX_POCKET },
  { key: 'fanatics-50-cents', who: 'FOX Sports', date: 'Mar 2026', text: 'A 10-leg parlay at Fanatics: NBA, UFC and golf.', buyIn: '$0.50', payout: '$3,663', outcome: 'All 10 hit', href: FOX_POCKET },
]

function Card({ s, tilt = 0 }: { s: Story; tilt?: number }) {
  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${s.who}, ${s.date}: ${s.buyIn} to ${s.payout}. ${s.outcome}. Opens the source.`}
      className="block h-full px-4 py-3.5 text-left transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      style={{ background: CREAM, color: NAVY, border: `0.18rem solid ${NAVY}`, borderRadius: '1.1rem', boxShadow: `0.3rem 0.35rem 0 ${NAVY}`, transform: `rotate(${tilt}deg)`, fontFamily: sauce }}
    >
      <span className="flex items-baseline justify-between gap-2 text-sm font-bold">
        <span>{s.who}</span>
        <span className="text-xs font-semibold opacity-70">{s.date}</span>
      </span>
      <span className="mt-1.5 block text-sm font-semibold leading-snug">{s.text}</span>
      {/* A long amount steps down a size so it stays inside the card. */}
      <span className={`mt-2 block whitespace-nowrap leading-none tabular-nums ${(s.buyIn + s.payout).length > 13 ? 'text-[1.2rem]' : 'text-[1.45rem]'}`} style={{ fontFamily: peace }}>
        {s.buyIn} → {s.payout}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
        <span className="whitespace-nowrap rounded-full px-2 py-0.5" style={{ background: GREEN, color: CREAM }}>
          {s.outcome}
        </span>
        <span className="whitespace-nowrap underline">Source ↗</span>
      </span>
    </a>
  )
}

/** Below the form, every screen: the sourced cards, two across where there's room. */
export function MoreStories() {
  return (
    <section aria-labelledby="more-stories-heading" className="flex w-full max-w-xl flex-col items-center gap-4">
      <h2 id="more-stories-heading" className="text-lg font-bold" style={{ fontFamily: sauce }}>
        More real long shots
      </h2>
      <ul className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
        {STORIES.map((s, i) => (
          <li key={s.key}>
            <Card s={s} tilt={i % 2 ? 1.2 : -1.2} />
          </li>
        ))}
      </ul>
    </section>
  )
}
