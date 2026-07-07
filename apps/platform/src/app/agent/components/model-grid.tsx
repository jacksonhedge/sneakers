'use client'
import { marketplaceModels } from '../lib/catalog'
import { useAgent } from '../lib/store'
import { formatPerf } from '../lib/format'
import { Orb } from './orb'
import type { AgentModel } from '../lib/types'

export function ModelGrid({ onOpen, onAdd }: { onOpen: (m: AgentModel) => void; onAdd: () => void }) {
  const { state, owned, dispatch } = useAgent()
  const models = marketplaceModels(state.models)
  return (
    <div className="mgrid">
      {models.map(m => {
        const isOwned = owned(m.id)
        const price = m.status === 'review' ? 'In review'
          : m.included ? 'Included'
          : isOwned ? 'Subscribed ✓'
          : m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo'
        const cls = ['mcell',
          isOwned ? 'mcell--owned' : '',
          m.featured ? 'mcell--featured' : '',
          m.brand ? `mcell--${m.brand}` : '',
        ].filter(Boolean).join(' ')
        return (
          <button key={m.id} className={cls} onClick={() => onOpen(m)}>
            {m.status !== 'review' && (
              <span
                className={'mcell__add' + (isOwned ? ' mcell__add--added' : '')}
                onClick={e => { e.stopPropagation(); if (!isOwned) dispatch({ type: 'subscribe', id: m.id }) }}
              >
                {isOwned ? '✓' : '+'}
              </span>
            )}
            <Orb color={m.color} emoji={m.emoji} size={84} />
            <div className="mcell__name">{m.name}</div>
            <div className="mcell__by">by {m.by}</div>
            {m.tagline
              ? <div className="mcell__tag">{m.tagline}</div>
              : <div className={'mcell__perf ag-num' + (m.perf30d !== null ? (m.perf30d < 0 ? ' ag-neg' : ' ag-pos') : '')}>
                  {formatPerf(m.perf30d)}{m.perf30d !== null ? ' · 30d' : ''}
                </div>}
            <div className="mcell__price ag-num">{price}</div>
          </button>
        )
      })}
      <button className="mcell mcell--dashed" onClick={onAdd}>
        <div className="mcell__plusorb">＋</div>
        <div className="mcell__name">Add Agent</div>
        <div className="mcell__by">build one or connect your own bot</div>
      </button>
    </div>
  )
}
