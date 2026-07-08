import { describe, it, expect } from 'vitest'
import { marketsPageOrderBy } from './markets-order-by'

// Regression guard for the /dashboard/markets outage (2026-07-08): the ORDER BY
// built for the paged_markets CTE referenced the LATERAL alias `l.` (and `m.`),
// which is out of scope inside a CTE that selects FROM ranked_markets — every
// request failed with `missing FROM-clause entry for table "l"` and the page
// fell into a 300s unbounded fallback. The clause may only use the CTE's own
// output columns.
const CTE_COLUMNS = [
  'id', 'source', 'question', 'category', 'close_time', 'status',
  'raw_metadata', 'latest_observed_at', 'volume_traded', 'overround',
]

describe('marketsPageOrderBy', () => {
  const sorts = ['overround', 'resolves_at', 'updated', 'volume', undefined] as const

  it('never references table aliases (l., m., p.) that are out of CTE scope', () => {
    for (const sort of sorts) {
      const clause = marketsPageOrderBy(sort)
      expect(clause, `sort=${sort}`).not.toMatch(/\b[lmp]\./)
    }
  })

  it('orders only by columns the ranked_markets CTE actually exposes', () => {
    for (const sort of sorts) {
      const clause = marketsPageOrderBy(sort)
      const column = clause.split(' ')[0]
      expect(CTE_COLUMNS, `sort=${sort} column=${column}`).toContain(column)
    }
  })

  it('maps each sort to the intended column and direction', () => {
    expect(marketsPageOrderBy('overround')).toBe('overround DESC NULLS LAST')
    expect(marketsPageOrderBy('resolves_at')).toBe('close_time ASC NULLS LAST')
    expect(marketsPageOrderBy('updated')).toBe('latest_observed_at DESC NULLS LAST')
    expect(marketsPageOrderBy('volume')).toBe('volume_traded DESC NULLS LAST')
    expect(marketsPageOrderBy(undefined)).toBe('volume_traded DESC NULLS LAST')
  })
})
