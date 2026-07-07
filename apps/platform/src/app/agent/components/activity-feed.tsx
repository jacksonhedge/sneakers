import { VENUE_META } from '../lib/catalog'
import type { Decision } from '../lib/types'

const BADGE: Record<Decision['action'], { glyph: string; win: boolean }> = {
  settled: { glyph: '✓', win: true },
  entered: { glyph: '→', win: false },
  passed:  { glyph: '·', win: false },
}

export function ActivityFeed({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="ag-card" style={{ padding: '6px 14px' }}>
      {decisions.map(d => {
        const v = VENUE_META[d.venue]
        const b = BADGE[d.action]
        return (
          <div className="feed-item" key={d.id}>
            <div className="feed-item__ic" style={{ background: v.bg }}>
              {v.abbr}
              <span className={'feed-item__bdg' + (b.win ? ' feed-item__bdg--win' : '')}>{b.glyph}</span>
            </div>
            <div>
              <div className="feed-item__t">{d.title}</div>
              <div className="feed-item__m ag-num">{d.detail}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
