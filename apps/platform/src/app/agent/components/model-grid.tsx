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
    <div className="ag-mgrid">
      {models.map(m => {
        const isOwned = owned(m.id)
        const price = m.status === 'review' ? 'In review'
          : m.included ? 'Included'
          : isOwned ? 'Subscribed ✓'
          : m.priceLabel ?? '$' + ((m.priceCents ?? 0) / 100).toFixed(2) + '/mo'
        const cls = ['ag-mcell',
          isOwned ? 'ag-mcell--owned' : '',
          m.featured ? 'ag-mcell--featured' : '',
          m.brand ? `ag-mcell--${m.brand}` : '',
        ].filter(Boolean).join(' ')
        return (
          // div+role, not <button>: the subscribe badge inside is itself a button,
          // and interactive content is invalid inside a native button.
          <div
            key={m.id}
            role="button"
            tabIndex={0}
            aria-label={`${m.name} — details`}
            className={cls}
            onClick={() => onOpen(m)}
            onKeyDown={e => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(m) }
            }}
          >
            {m.status !== 'review' && (
              <button
                type="button"
                className={'ag-mcell__add' + (isOwned ? ' ag-mcell__add--added' : '')}
                aria-label={isOwned ? `${m.name}: subscribed` : `Subscribe to ${m.name}`}
                onClick={e => { e.stopPropagation(); if (!isOwned) dispatch({ type: 'subscribe', id: m.id }) }}
              >
                {isOwned ? '✓' : '+'}
              </button>
            )}
            <Orb color={m.color} emoji={m.emoji} size={84} />
            <div className="ag-mcell__name">{m.name}</div>
            <div className="ag-mcell__by">by {m.by}</div>
            {m.tagline
              ? <div className="ag-mcell__tag">{m.tagline}</div>
              : <div className={'ag-mcell__perf ag-num' + (m.perf30d !== null ? (m.perf30d < 0 ? ' ag-neg' : ' ag-pos') : '')}>
                  {formatPerf(m.perf30d)}{m.perf30d !== null ? ' · 30d' : ''}
                </div>}
            <div className="ag-mcell__price ag-num">{price}</div>
          </div>
        )
      })}
      <button type="button" className="ag-mcell ag-mcell--dashed" onClick={onAdd}>
        <div className="ag-mcell__plusorb">＋</div>
        <div className="ag-mcell__name">Add Agent</div>
        <div className="ag-mcell__by">build one or connect your own bot</div>
      </button>
    </div>
  )
}
