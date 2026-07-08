'use client'
import { useState } from 'react'
import { useAgent } from '../lib/store'
import { Sparkline } from './sparkline'
import { AddCashSheet } from './add-cash-sheet'
import { formatMoney, formatSigned } from '../lib/format'

export function BalanceTabView() {
  const { state, todayPnl } = useAgent()
  const [addOpen, setAddOpen] = useState(false)
  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Funds</span>
        <span className="ag-badge ag-badge--test">STRIPE TEST</span>
      </div>
      <div style={{ padding: '10px 2px 4px' }}>
        <div className="ag-balcell__lab">Sneakers wallet</div>
        <div className="ag-num" style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>
          {formatMoney(state.balanceCents)}
        </div>
        <div className={'ag-num ' + (todayPnl < 0 ? 'ag-neg' : 'ag-pos')} style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
          {formatSigned(todayPnl)} today
        </div>
      </div>
      <Sparkline values={state.spark} />
      <div style={{ display: 'flex', gap: 10, margin: '2px 0 6px' }}>
        <button className="ag-pill ag-pill--primary" onClick={() => setAddOpen(true)}>Add cash</button>
        <button className="ag-pill ag-pill--ghost">Withdraw</button>
      </div>
      <div className="ag-sechead">History</div>
      <div className="ag-card" style={{ padding: '4px 16px' }}>
        {state.ledger.map(l => (
          <div key={l.id} className="ag-row" style={{ padding: '12px 2px', borderBottom: '1px solid #191f24' }}>
            <div>
              <div style={{ fontSize: 14 }}>{l.label}</div>
              <div className="ag-sub" style={{ fontSize: 11.5, marginTop: 2 }}>{l.detail}</div>
            </div>
            <div className={'ag-num' + (l.amountCents < 0 ? ' ag-neg' : l.kind === 'settlement' ? ' ag-pos' : '')}
              style={{ fontSize: 14.5, fontWeight: 600 }}>
              {l.kind === 'settlement' ? formatSigned(l.amountCents) : formatMoney(Math.abs(l.amountCents))}
            </div>
          </div>
        ))}
      </div>
      <AddCashSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
