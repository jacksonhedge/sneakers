export interface CircuitBreakerConfig {
  maxConsecutiveErrors: number
  dailyLossCapUsd: number
}

export interface TripStatus {
  tripped: boolean
  reason?: string
}

export class CircuitBreaker {
  private consecutiveErrorCount: number = 0
  private dailyPnlAccumulator: number = 0
  private maxConsecutiveErrors: number
  private dailyLossCapUsd: number

  constructor(cfg: CircuitBreakerConfig) {
    this.maxConsecutiveErrors = cfg.maxConsecutiveErrors
    this.dailyLossCapUsd = cfg.dailyLossCapUsd
  }

  recordError(): void {
    this.consecutiveErrorCount++
  }

  recordPnl(usd: number): void {
    this.dailyPnlAccumulator += usd
    // Treat any PnL record (success signal) as resetting the error streak
    this.consecutiveErrorCount = 0
  }

  tripped(): TripStatus {
    // Check consecutive errors first
    if (this.consecutiveErrorCount >= this.maxConsecutiveErrors) {
      return { tripped: true, reason: 'consecutive_errors' }
    }

    // Check daily loss cap (negative cumulative PnL meets or exceeds cap)
    if (this.dailyPnlAccumulator <= -this.dailyLossCapUsd) {
      return { tripped: true, reason: 'daily_loss' }
    }

    return { tripped: false }
  }

  reset(): void {
    this.consecutiveErrorCount = 0
    this.dailyPnlAccumulator = 0
  }
}
