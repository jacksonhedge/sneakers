import { Tweet } from 'react-tweet'
import { NAVY } from '../visuals'

// Real posts from X, drawn from X's own embed data (react-tweet: the account, the text, the slip photos), each in a sticker frame.
// Wide screens: down the left edge, bobbing like the partner tiles on the right. Narrower screens: stacked below the form (StoryRow).
// When a post doesn't say how the ticket ended, a caption does: most long shots miss, and one of these did.

type Post = { id: string; caption?: string }

export const POSTS: readonly Post[] = [
  // Hard Rock Bet, Nov 23, 2026: "ONE DOLLAR 7 LEGS ONE DREAM $1 ➡️ $96,473.44" (the winning slip in the photos).
  { id: '2124990101893636297' },
  // Sep 24, 2019: an 89-cent, 20-leg parlay one game from half a million. It lost.
  { id: '1176310867052265472', caption: 'It missed on the last leg. (CBS Sports, Sep 2019)' },
]

const CREAM = '#FFF3D6'
const sauce = 'var(--font-open-sauce), sans-serif'
const bob = (dur: number, delay: number) => ({ ['--sc-dur' as string]: `${dur}s`, ['--sc-delay' as string]: `${delay}s` })

// Each post's own tilt and bob in the left column on wide screens.
const SPOTS = [
  { tilt: -2.5, dur: 5.2, delay: 0 },
  { tilt: 2, dur: 5.8, delay: 0.8 },
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
