// Abramowitz & Stegun 7.1.26 approximation of the error function.
export function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return x >= 0 ? y : -y
}

// Standard normal cumulative distribution function.
export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}
