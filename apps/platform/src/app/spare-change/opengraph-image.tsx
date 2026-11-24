import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EXAMPLE_TICKET, NEWSLETTER_NAME } from '@/lib/spare-change'

// The card iMessage, X and Slack show for a /spare-change link (with or without ?ref=): the page's sticker look on its blue, the
// name, the lime line, the example ticket, and the 18+ and help lines. Next serves it as og:image (twitter-image.tsx re-exports it).

export const SHARE_LINE = 'Daily Sports Betting Lottery Ticket'
export const alt = `Sneakers. ${NEWSLETTER_NAME}: ${SHARE_LINE}. One quarter, one dream: ${EXAMPLE_TICKET.buyIn} buy-in, ${EXAMPLE_TICKET.payout} payout if it hits. 18+.`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BLUE = '#2B5FB4'
const CREAM = '#FFF3D6'
const NAVY = '#0B1E3F'
const RED = '#E03A3E'
const LIME = '#C9F73A'
// A hard navy outline and drop, like the page's sticker letters (the image renderer has no text-stroke).
const sticker = `3px 3px 0 ${NAVY}, -3px 3px 0 ${NAVY}, 3px -3px 0 ${NAVY}, -3px -3px 0 ${NAVY}, 7px 9px 0 ${NAVY}`

export default async function Image() {
  const [peace, sauce, shoes] = await Promise.all([
    readFile(join(process.cwd(), 'src/fonts/PeaceSans.otf')),
    readFile(join(process.cwd(), 'src/fonts/OpenSauceSans-Regular.woff')),
    // The Sneakers shoes on their red tile, shown as a small app-icon sticker beside the wordmark.
    readFile(join(process.cwd(), 'public/sneakers-shoes-s.png')),
  ])
  const shoesSrc = `data:image/png;base64,${shoes.toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: BLUE, padding: '56px 64px', fontFamily: 'Sauce', color: NAVY }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div style={{ display: 'flex', width: 78, height: 78, background: RED, borderRadius: 18, border: `3px solid ${NAVY}`, boxShadow: `4px 5px 0 ${NAVY}`, transform: 'rotate(-6deg)', overflow: 'hidden' }}>
              <img src={shoesSrc} width={72} height={72} alt="" />
            </div>
            <div style={{ display: 'flex', fontFamily: 'Peace', fontSize: 38, color: CREAM, textShadow: `2px 2px 0 ${NAVY}, -2px 2px 0 ${NAVY}, 2px -2px 0 ${NAVY}, -2px -2px 0 ${NAVY}, 4px 5px 0 ${NAVY}` }}>Sneakers</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Peace', fontSize: 80, lineHeight: 1, color: CREAM, textShadow: sticker }}>
            <span>Spare Change</span>
            <span style={{ color: LIME }}>Millionaire</span>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', background: LIME, border: `4px solid ${NAVY}`, borderRadius: 999, padding: '12px 28px', fontSize: 30, whiteSpace: 'nowrap', boxShadow: `6px 7px 0 ${NAVY}`, transform: 'rotate(-1.5deg)' }}>
              {SHARE_LINE}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 19, color: CREAM, whiteSpace: 'nowrap' }}>sneakersterminal.com · 18+ · Gambling problem? Call 1-800-GAMBLER</div>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 452, background: CREAM, border: `5px solid ${NAVY}`, borderRadius: 34, boxShadow: `10px 12px 0 ${NAVY}`, padding: '30px 34px', transform: 'rotate(3deg)' }}>
            {/* Still an illustration, not a real ticket: "one quarter, one dream", after the long-shot posts on the page. */}
            <div style={{ display: 'flex', fontSize: 21, letterSpacing: 1.5, color: RED, whiteSpace: 'nowrap' }}>ONE QUARTER. ONE DREAM.</div>
            {/* One line: a cartoon quarter (the 25-cent buy-in) going to the payout. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, fontFamily: 'Peace', color: NAVY }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 999, background: 'linear-gradient(145deg, #F4F6F9 0%, #C7CED8 55%, #9AA3AF 100%)', border: `4px solid ${NAVY}`, boxShadow: `3px 4px 0 ${NAVY}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 999, border: '2px dashed #5E6773', fontSize: 24 }}>25¢</div>
              </div>
              <span style={{ fontSize: 42 }}>→</span>
              <span style={{ fontSize: 54, whiteSpace: 'nowrap' }}>{EXAMPLE_TICKET.payout}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `4px dashed ${NAVY}`, marginTop: 22, paddingTop: 16, fontSize: 22 }}>
              <span>buy-in</span>
              <span>payout if it hits</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Peace', data: peace, style: 'normal', weight: 400 },
        { name: 'Sauce', data: sauce, style: 'normal', weight: 400 },
      ],
    },
  )
}
