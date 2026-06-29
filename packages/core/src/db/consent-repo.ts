import { Pool } from 'pg'

export interface LatestConsent {
  version: string
  acceptedAtMs: number
}

/**
 * Immutable consent log for agent execution.
 * Records versioned legal consent timestamps for audit compliance.
 */
export class ConsentRepo {
  constructor(private pool: Pool) {}

  /**
   * Record a consent event for a user with a given version.
   * Parameterized to prevent injection.
   */
  async recordConsent(userId: string, version: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO agent_consents (user_id, version, accepted_at) VALUES ($1, $2, now())',
      [userId, version]
    )
  }

  /**
   * Fetch the most recent consent for a user (by accepted_at DESC).
   * Returns the version and epoch-millisecond timestamp, or null if no record exists.
   */
  async latestConsent(userId: string): Promise<LatestConsent | null> {
    const result = await this.pool.query(
      `SELECT version, extract(epoch from accepted_at) * 1000 as accepted_at_ms
       FROM agent_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC
       LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      version: row.version,
      acceptedAtMs: Number(row.accepted_at_ms),
    }
  }
}
