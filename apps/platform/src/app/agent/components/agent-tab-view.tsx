'use client'
import { useState } from 'react'
import { useAgent } from '../lib/store'
import { CoverFlow } from './cover-flow'
import { ActivityFeed } from './activity-feed'
import { ModelSheet } from './model-sheet'
import { formatMoney, formatPerf, formatSigned } from '../lib/format'
import type { AgentModel, AgentDest } from '../lib/types'

export function AgentTabView({ startAtEnd, badge = 'PAPER', onNavigate }: { startAtEnd?: boolean; badge?: string; onNavigate?: (dest: AgentDest) => void }) {
  const { state, status, todayPnl, owned, dispatch } = useAgent()
  const [centerIndex, setCenterIndex] = useState(() => (startAtEnd ? state.models.length - 1 : 0))
  const [sheetModel, setSheetModel] = useState<AgentModel | null>(null)

  const m = state.models[centerIndex]
  const isEquipped = m.id === state.equippedId

  let equipLabel = 'Equipped ✓'
  if (!isEquipped) {
    if (m.status === 'review') equipLabel = 'In review'
    else if (owned(m.id)) equipLabel = 'Equip'
    else equipLabel = 'Subscribe · ' + (m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo')
  }

  return (
    <>
      <div className="ag-apphead">
        <span className="ag-brand">Sneakers</span>
        <span className="ag-badge ag-badge--paper">{badge}</span>
      </div>

      <CoverFlow
        models={state.models}
        centerIndex={centerIndex}
        equippedId={state.equippedId}
        paused={state.paused}
        phase={status.phase}
        onCenter={setCenterIndex}
        onOpen={setSheetModel}
      />
      <div className="cf-name">{m.name}</div>
      {isEquipped ? (
        <>
          <div className="ag-status">
            <span className={'ag-status__dot' + (state.paused ? ' ag-status__dot--off' : '')} />
            {status.title}
          </div>
          <div className="ag-statussub">{status.sub}</div>
        </>
      ) : (
        <>
          <div className="ag-status">{m.tagline ?? formatPerf(m.perf30d) + ' · 30d paper'}</div>
          <div className="ag-statussub">
            by {m.by}{m.runners > 1 ? ` · ${m.runners.toLocaleString('en-US')} running` : ''}
          </div>
        </>
      )}
      <div className="cf-dots">
        {state.models.map((x, i) => <span key={x.id} className={i === centerIndex ? 'on' : ''} />)}
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '14px 0 12px' }}>
        <button
          className={'ag-pill ag-num ' + (isEquipped ? 'ag-pill--ghost' : 'ag-pill--primary')}
          disabled={equipLabel === 'In review'}
          onClick={() => dispatch({ type: 'equip', id: m.id })}
        >
          {equipLabel}
        </button>
        <button className="ag-pill ag-pill--ghost" onClick={() => dispatch({ type: 'togglePaused' })}>
          {state.paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div className="ag-balrow">
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Balance</div>
          <div className="ag-balcell__val ag-num">{formatMoney(state.balanceCents)}</div>
        </div>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Today</div>
          <div className={'ag-balcell__val ag-num ' + (todayPnl < 0 ? 'ag-neg' : 'ag-pos')}>{formatSigned(todayPnl)}</div>
        </div>
      </div>

      <div className="ag-sechead">Activity</div>
      <ActivityFeed decisions={state.decisions} />

      <ModelSheet model={sheetModel} onClose={() => setSheetModel(null)} onNavigate={onNavigate} />
    </>
  )
}
