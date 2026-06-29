/**
 * RollingVol: Rolling realized-volatility estimator
 * Maintains recent 1-second price changes within a window and computes
 * the sample standard deviation of per-second price moves.
 */

const FLOOR = 1e-6

export class RollingVol {
  private windowSec: number
  private entries: Array<{ atMs: number; price: number }> = []

  constructor(windowSec: number) {
    this.windowSec = windowSec
  }

  /**
   * Record a price observation.
   * @param price The price at the given timestamp.
   * @param atMs Timestamp in milliseconds.
   */
  push(price: number, atMs: number): void {
    this.entries.push({ atMs, price })
    // Drop entries older than windowSec (in milliseconds)
    const cutoffMs = atMs - this.windowSec * 1000
    this.entries = this.entries.filter(e => e.atMs >= cutoffMs)
  }

  /**
   * Return the sample standard deviation of per-second price moves.
   * When stdev is near zero (below floor), return mean absolute change per second.
   * Returns a small positive floor when insufficient data.
   */
  perSec(): number {
    if (this.entries.length < 2) {
      return FLOOR
    }

    // Compute per-second price deltas
    const deltas: number[] = []
    for (let i = 1; i < this.entries.length; i++) {
      const curr = this.entries[i]
      const prev = this.entries[i - 1]
      const timeDeltaSec = (curr.atMs - prev.atMs) / 1000
      const priceDelta = curr.price - prev.price
      // Normalize to per-second move
      const perSecMove = priceDelta / timeDeltaSec
      deltas.push(perSecMove)
    }

    if (deltas.length === 0) {
      return FLOOR
    }

    // Compute sample mean and standard deviation
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
    const variance =
      deltas.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) /
      deltas.length
    const stdev = Math.sqrt(variance)

    // If stdev is above floor, return it; otherwise return mean absolute move
    if (stdev >= FLOOR) {
      return stdev
    }

    // Fallback: return mean absolute change per second
    const meanAbsChange =
      deltas.reduce((sum, x) => sum + Math.abs(x), 0) / deltas.length
    return Math.max(meanAbsChange, FLOOR)
  }
}
