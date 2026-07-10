const MINUS = '−'

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? MINUS : ''
  return sign + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMoneyWhole(cents: number): string {
  const sign = cents < 0 ? MINUS : ''
  return sign + '$' + Math.round(Math.abs(cents) / 100).toLocaleString('en-US')
}

export function formatSigned(cents: number): string {
  const sign = cents < 0 ? MINUS : '+'
  return sign + formatMoney(Math.abs(cents)).replace(MINUS, '')
}

export function formatPerf(perf30d: number | null): string {
  if (perf30d === null) return '—'
  return (perf30d >= 0 ? '+' : MINUS) + Math.abs(perf30d) + '%'
}
