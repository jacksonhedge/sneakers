'use client'
import { useRouter } from 'next/navigation'
import { Sheet } from './sheet'
import { Orb } from './orb'
import { useAgent } from '../lib/store'
import { formatPerf } from '../lib/format'
import type { AgentModel } from '../lib/types'

export function ModelSheet({ model, onClose }: { model: AgentModel | null; onClose: () => void }) {
  const { state, owned, dispatch } = useAgent()
  const router = useRouter()
  if (!model) return null
  const m = model
  const equipped = m.id === state.equippedId

  let label = 'Subscribe · ' + (m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo')
  let ghost = false
  if (m.mine) { label = 'Edit in My Model'; ghost = true }
  else if (m.status === 'review') { label = 'In review — coming soon'; ghost = true }
  else if (equipped) { label = 'Equipped ✓'; ghost = true }
  else if (owned(m.id)) { label = 'Equip now' }

  function onAction() {
    if (m.status === 'review') return
    if (m.mine) { onClose(); router.push('/agent/models'); return }
    if (equipped) return
    if (!owned(m.id)) { dispatch({ type: 'subscribe', id: m.id }); return }
    dispatch({ type: 'equip', id: m.id })
    onClose()
    router.push('/agent')
  }

  return (
    <Sheet open onClose={onClose}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <Orb color={m.color} emoji={m.emoji} size={64} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{m.name}</div>
          <div className="ag-sub">by {m.by}</div>
        </div>
      </div>
      <div className="ag-balrow" style={{ margin: '0 0 12px' }}>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">30d paper</div>
          <div className={'ag-balcell__val ag-num' + (m.perf30d !== null ? (m.perf30d < 0 ? ' ag-neg' : ' ag-pos') : '')} style={{ fontSize: 18 }}>
            {formatPerf(m.perf30d)}
          </div>
        </div>
        <div className="ag-balcell">
          <div className="ag-balcell__lab">Running</div>
          <div className="ag-balcell__val ag-num" style={{ fontSize: 18 }}>
            {m.runners > 1 ? m.runners.toLocaleString('en-US') : '—'}
          </div>
        </div>
      </div>
      <div className="ag-sub" style={{ marginBottom: 16 }}>{m.description}</div>
      <button className={'ag-pill ' + (ghost ? 'ag-pill--ghost' : 'ag-pill--primary')} style={{ width: '100%' }} onClick={onAction}>
        {label}
      </button>
    </Sheet>
  )
}
