export type RiskPreset = 'bunker' | 'cautious' | 'balanced' | 'aggressive' | 'max'

export interface RiskThresholds {
  minEdgeBps: number
  actWindowSec: number
  maxSizeUsdc: number
  perDayCapUsdc: number
  maxWindowsPerHour: number
}

// minEdgeBps + actWindowSec are spec-fixed; dollar/count values are
// simulated-balance defaults (tunable later).
export const PRESETS: Record<RiskPreset, RiskThresholds> = {
  bunker:     { minEdgeBps: 1000, actWindowSec: 2,  maxSizeUsdc: 5,   perDayCapUsdc: 25,   maxWindowsPerHour: 2 },
  cautious:   { minEdgeBps: 750,  actWindowSec: 4,  maxSizeUsdc: 15,  perDayCapUsdc: 60,   maxWindowsPerHour: 4 },
  balanced:   { minEdgeBps: 500,  actWindowSec: 7,  maxSizeUsdc: 40,  perDayCapUsdc: 150,  maxWindowsPerHour: 8 },
  aggressive: { minEdgeBps: 350,  actWindowSec: 11, maxSizeUsdc: 100, perDayCapUsdc: 400,  maxWindowsPerHour: 15 },
  max:        { minEdgeBps: 200,  actWindowSec: 20, maxSizeUsdc: 250, perDayCapUsdc: 1000, maxWindowsPerHour: 30 },
}

export function thresholdsFor(preset: RiskPreset): RiskThresholds {
  return PRESETS[preset]
}
