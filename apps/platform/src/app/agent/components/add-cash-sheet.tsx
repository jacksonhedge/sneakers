'use client'
import { useState } from 'react'
import { Sheet } from './sheet'
import { useAgent } from '../lib/store'

const AMOUNTS = [2500, 10000, 25000]

export function AddCashSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useAgent()
  const [cents, setCents] = useState(10000)
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="ag-row">
        <div style={{ fontSize: 17, fontWeight: 700 }}>Add cash</div>
        <span className="ag-badge ag-badge--test">STRIPE TEST</span>
      </div>
      <div className="ag-sub" style={{ marginTop: 8 }}>
        Test mode — card 4242 4242 4242 4242. No real money moves.
      </div>
      <div className="ag-pickrow" style={{ margin: '14px 0 16px' }}>
        {AMOUNTS.map(a => (
          <button key={a} className={'mchip ag-num' + (a === cents ? ' mchip--on' : '')}
            style={{ flex: 1, textAlign: 'center', fontSize: 14, padding: '11px 0' }}
            onClick={() => setCents(a)}>
            ${a / 100}
          </button>
        ))}
      </div>
      <button className="ag-pill ag-pill--primary ag-num" style={{ width: '100%' }}
        onClick={() => { dispatch({ type: 'deposit', cents }); setCents(10000); onClose() }}>
        Add ${cents / 100}
      </button>
    </Sheet>
  )
}
