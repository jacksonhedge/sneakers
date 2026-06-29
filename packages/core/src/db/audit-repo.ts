import { Pool } from 'pg'
import type { Side } from '../agent/window'

export interface AuditEntry {
  botConfigId: number
  windowId: number | null
  mode: 'dry_run' | 'live' | 'blocked'
  side: Side
  requestedUsd: number
  sizeUsd: number | null
  blockedReason?: string | null
  venueOrderId?: string | null
  status?: string
  filledUsd?: number | null
  avgPrice?: number | null
  raw?: Record<string, unknown> | null
}

/**
 * Immutable append-only audit log for agent trade decisions.
 * Exposes only `record()` — no update/delete/mutate methods.
 */
export class AuditRepo {
  constructor(private pool: Pool) {}

  /**
   * Record a trade audit entry. Returns the inserted id.
   * Append-only by design — no updates, no deletes.
   */
  async record(entry: AuditEntry): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO agent_trade_audit
       (bot_config_id, window_id, mode, side, requested_usd, size_usd, blocked_reason, venue_order_id, status, filled_usd, avg_price, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        entry.botConfigId,
        entry.windowId,
        entry.mode,
        entry.side,
        entry.requestedUsd,
        entry.sizeUsd,
        entry.blockedReason || null,
        entry.venueOrderId || null,
        entry.status || 'pending',
        entry.filledUsd || null,
        entry.avgPrice || null,
        entry.raw ? JSON.stringify(entry.raw) : null,
      ]
    )
    return Number(result.rows[0].id)
  }
}
