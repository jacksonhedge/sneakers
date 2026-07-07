'use client'
import { VENUE_META } from '../lib/catalog'

const CONNECTED: { venue: keyof typeof VENUE_META; status: 'connected' | 'soon' }[] = [
  { venue: 'kalshi', status: 'connected' },
  { venue: 'polymarket', status: 'connected' },
  { venue: 'prophetx', status: 'soon' },
]

export default function ProfileTab() {
  return (
    <>
      <div className="ag-apphead"><span className="ag-brand">Profile</span></div>

      <div className="ag-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2FD37A,#1a9e97)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#0B0D10', flexShrink: 0,
        }}>JF</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Jackson</div>
          <div className="ag-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            jacksonfitzgerald25@gmail.com
          </div>
        </div>
        <button className="ag-linkish">Edit</button>
      </div>

      <div className="ag-sechead">Your plan</div>
      <div className="ag-card ag-row">
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sneakers Pro</div>
          <div className="ag-sub ag-num" style={{ marginTop: 3 }}>$39/mo · trial ends Jul 20</div>
        </div>
        <button className="ag-linkish">Change</button>
      </div>

      <div className="ag-sechead">Trading venues</div>
      <div className="ag-card" style={{ padding: '4px 16px' }}>
        {CONNECTED.map(({ venue, status }) => {
          const v = VENUE_META[venue]
          return (
            <div className="conn" key={venue}>
              <div className="conn__logo" style={{ background: v.bg }}>{v.abbr}</div>
              <div>
                <div className="conn__nm">{v.label}</div>
                {status === 'connected' ? (
                  <div className="conn__st ag-pos"><span className="conn__dot" style={{ background: '#2FD37A' }} />Connected · live prices</div>
                ) : (
                  <div className="conn__st" style={{ color: '#98A2A8' }}><span className="conn__dot" style={{ background: '#98A2A8' }} />Available</div>
                )}
              </div>
              <div className="conn__act">
                {status === 'connected' ? <button className="ag-linkish">Manage</button> : <button className="ag-soon">Soon</button>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="ag-sechead">Data &amp; bots</div>
      <div className="ag-card" style={{ padding: '4px 16px' }}>
        <div className="conn">
          <div className="conn__logo" style={{ background: '#d98fff' }}>OJ</div>
          <div>
            <div className="conn__nm">OddsJam</div>
            <div className="conn__st" style={{ color: '#98A2A8' }}><span className="conn__dot" style={{ background: '#98A2A8' }} />Data plan · not subscribed</div>
          </div>
          <div className="conn__act"><button className="ag-soon">Soon</button></div>
        </div>
        <div className="conn">
          <div className="conn__logo" style={{ background: '#7de0d6' }}>🤖</div>
          <div>
            <div className="conn__nm">Trading Agents</div>
            <div className="conn__st" style={{ color: '#98A2A8' }}><span className="conn__dot" style={{ background: '#98A2A8' }} />Subscribe in Models tab</div>
          </div>
        </div>
      </div>

      <button className="ag-linkish" style={{ width: '100%', padding: '12px 0', marginTop: 14, color: '#FF5C5C', borderColor: '#2a323a' }}>
        Sign out
      </button>
    </>
  )
}
