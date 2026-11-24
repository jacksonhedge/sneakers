import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EXAMPLE_TICKET, NEWSLETTER_NAME } from '@/lib/spare-change'

// The card iMessage, X and Slack show for a /spare-change link (with or without ?ref=): the page's sticker look on its blue, the
// name, the lime line, the example ticket, and the 18+ and help lines. Next serves it as og:image (twitter-image.tsx re-exports it).

export const SHARE_LINE = 'A Daily Sports Betting Lottery ticket newsletter'
// The sticker shows it on two lines.
const SHARE_LINES = ['A Daily Sports Betting', 'Lottery ticket newsletter'] as const
export const alt = `${NEWSLETTER_NAME}: ${SHARE_LINE}. Example ticket ${EXAMPLE_TICKET.buyIn} buy-in, ${EXAMPLE_TICKET.payout} payout if it hits. 18+.`
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
  const [peace, sauce] = await Promise.all([
    readFile(join(process.cwd(), 'src/fonts/PeaceSans.otf')),
    readFile(join(process.cwd(), 'src/fonts/OpenSauceSans-Regular.woff')),
  ])
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: BLUE, padding: '56px 64px', fontFamily: 'Sauce', color: NAVY }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 660 }}>
          <div style={{ display: 'flex', fontFamily: 'Peace', fontSize: 34, color: CREAM, textShadow: `2px 2px 0 ${NAVY}, -2px 2px 0 ${NAVY}, 2px -2px 0 ${NAVY}, -2px -2px 0 ${NAVY}, 4px 5px 0 ${NAVY}` }}>Sneakers</div>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Peace', fontSize: 80, lineHeight: 1, color: CREAM, textShadow: sticker }}>
            <span>Spare Change</span>
            <span>Millionaire</span>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', flexDirection: 'column', background: LIME, border: `4px solid ${NAVY}`, borderRadius: 30, padding: '12px 30px', fontSize: 32, lineHeight: 1.2, boxShadow: `6px 7px 0 ${NAVY}`, transform: 'rotate(-1.5deg)' }}>
              {SHARE_LINES.map((l) => (
                <span key={l} style={{ whiteSpace: 'nowrap' }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: CREAM, whiteSpace: 'nowrap' }}>sneakersterminal.com · 18+ · Gambling problem? Call 1-800-GAMBLER</div>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 390, background: CREAM, border: `5px solid ${NAVY}`, borderRadius: 34, boxShadow: `10px 12px 0 ${NAVY}`, padding: '30px 34px', transform: 'rotate(3deg)' }}>
            <div style={{ display: 'flex', fontSize: 22, letterSpacing: 3, color: RED }}>EXAMPLE TICKET</div>
            <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Peace', fontSize: 62, lineHeight: 1.08, marginTop: 14 }}>
              <span style={{ whiteSpace: 'nowrap' }}>{EXAMPLE_TICKET.buyIn} →</span>
              <span style={{ whiteSpace: 'nowrap' }}>{EXAMPLE_TICKET.payout}</span>
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
