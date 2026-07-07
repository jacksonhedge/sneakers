/**
 * Unrealized P&L for a simulated Polymarket position, in signed cents.
 * entryPrice/currentPrice are Polymarket YES prices in the 0-1 range.
 * A position of sizeCents "bought" at entryPrice is worth
 * sizeCents * (currentPrice / entryPrice) today; P&L is that minus sizeCents.
 */
export function computePositionPnlCents(
  entryPrice: number,
  currentPrice: number,
  sizeCents: number,
): number {
  return Math.round(((currentPrice - entryPrice) / entryPrice) * sizeCents)
}
