// ORDER BY builder for the markets-listing page query (loadMarketsPage).
//
// IMPORTANT: this clause is applied inside the `paged_markets` CTE, which
// selects FROM `ranked_markets` — so it may reference ONLY the columns that
// CTE exposes (id, source, question, category, close_time, status,
// raw_metadata, latest_observed_at, volume_traded, overround). Table aliases
// from inside ranked_markets (`m.`, `l.`, `p.`) are OUT OF SCOPE there;
// using them produced `missing FROM-clause entry for table "l"` and took the
// whole /dashboard/markets page down (2026-07-08 outage).
export type MarketsSort = 'overround' | 'resolves_at' | 'updated' | 'volume'

export function marketsPageOrderBy(sort: MarketsSort | undefined): string {
  switch (sort) {
    case 'overround':
      return 'overround DESC NULLS LAST'
    case 'resolves_at':
      return 'close_time ASC NULLS LAST'
    case 'updated':
      return 'latest_observed_at DESC NULLS LAST'
    case 'volume':
    default:
      return 'volume_traded DESC NULLS LAST'
  }
}
