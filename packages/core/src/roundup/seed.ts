import type { Txn } from './engine.js'

const FEED: Array<{ merchant: string; amountCents: number; date: string }> = [
  { merchant: 'Blue Bottle Coffee', amountCents: 475, date: '2026-06-24' },
  { merchant: 'Uber', amountCents: 1899, date: '2026-06-24' },
  { merchant: 'Whole Foods', amountCents: 6312, date: '2026-06-23' },
  { merchant: 'Spotify', amountCents: 1099, date: '2026-06-23' },
  { merchant: 'Shell', amountCents: 4287, date: '2026-06-22' },
  { merchant: 'Chipotle', amountCents: 1340, date: '2026-06-22' },
  { merchant: 'Amazon', amountCents: 2399, date: '2026-06-21' },
  { merchant: 'Netflix', amountCents: 1549, date: '2026-06-21' },
  { merchant: 'CVS Pharmacy', amountCents: 824, date: '2026-06-20' },
  { merchant: "Trader Joe's", amountCents: 3711, date: '2026-06-20' },
]

export function seedTransactions(count = 10): Txn[] {
  const n = Math.min(count, FEED.length)
  return FEED.slice(0, n).map((f, i) => ({ id: `seed-${i + 1}`, ...f }))
}
