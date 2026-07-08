'use client'
import { useState } from 'react'
import { useAgent } from '../lib/store'
import { ModelGrid } from './model-grid'
import { ModelSheet } from './model-sheet'
import { AddAgentSheet } from './add-agent-sheet'
import { formatPerf } from '../lib/format'
import type { AgentModel } from '../lib/types'

export function ModelsTabView({ badge = 'PAPER' }: { badge?: string }) {
  const { state } = useAgent()
  const [seg, setSeg] = useState<'mine' | 'best'>('best')
  const [sheetModel, setSheetModel] = useState<AgentModel | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const mine = state.models.find(m => m.mine) ?? state.models[0]

  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Models</span>
        <span className="ag-badge ag-badge--paper">{badge}</span>
      </div>
      <div className="ag-seg" role="tablist">
        <button className={seg === 'mine' ? 'on' : ''} onClick={() => setSeg('mine')}>My Model</button>
        <button className={seg === 'best' ? 'on' : ''} onClick={() => setSeg('best')}>Trading Agents</button>
      </div>

      {seg === 'best' ? (
        <>
          <div className="ag-sub" style={{ padding: '0 2px 12px' }}>
            Ranked by 30-day paper performance. Tap a model for details — subscribe to add it to your Agent carousel.
          </div>
          <ModelGrid onOpen={setSheetModel} onAdd={() => setAddOpen(true)} />
          <div className="ag-sub" style={{ padding: '12px 4px 2px' }}>
            Subscriptions bill through your Sneakers plan (Stripe). Creator payouts via Stripe Connect.
          </div>
        </>
      ) : (
        <>
          <div className="ag-card">
            <div className="ag-row" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{mine.name}</div>
              <div className={'ag-sub ag-num' + (mine.perf30d !== null ? (mine.perf30d < 0 ? ' ag-neg' : ' ag-pos') : '')}>{formatPerf(mine.perf30d)} · 30d paper</div>
            </div>
            <div className="mprompt">
              Trade 5 and 15-minute crypto markets only. Favor longshots priced 10–35¢ with momentum confirmation.
              Max 5% of bankroll per trade. Skip anything with a spread over 4¢.
            </div>
            <div className="mchips">
              <button className="mchip mchip--on">Longshot 10–35¢</button>
              <button className="mchip">Momentum</button>
              <button className="mchip">Fade the spike</button>
              <button className="mchip">Conservative</button>
            </div>
            <div className="ag-sub" style={{ marginTop: 12 }}>
              Your model re-reads this prompt before every window. Changes apply to the next scan.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ag-pill ag-pill--primary" style={{ fontSize: 14 }}>Run this model</button>
            <button className="ag-pill ag-pill--ghost" style={{ fontSize: 14 }}>Backtest</button>
          </div>
          <button className="ag-pill ag-pill--ghost" style={{ width: '100%', marginTop: 10, fontSize: 14, color: 'var(--ag-green)' }}
            onClick={() => setAddOpen(true)}>
            ＋ Add Agent
          </button>
        </>
      )}

      <ModelSheet model={sheetModel} onClose={() => setSheetModel(null)} />
      <AddAgentSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
