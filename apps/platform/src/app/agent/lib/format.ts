export function formatMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatMoneyWhole(cents: number): string {
  return '$' + Math.round(cents / 100).toLocaleString('en-US')
}

export function formatSigned(cents: number): string {
  const sign = cents < 0 ? '−' : '+'
  return sign + formatMoney(Math.abs(cents))
}

export function formatPerf(perf30d: number | null): string {
  if (perf30d === null) return '—'
  return (perf30d >= 0 ? '+' : '') + perf30d + '%'
}
