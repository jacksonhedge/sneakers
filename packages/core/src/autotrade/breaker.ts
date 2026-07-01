export type ExecutionStatus = 'pending' | 'filled' | 'rejected' | 'cancelled' | 'error'

export interface BreakerInput {
  /** Most-recent-first. Only 'error'/'rejected' count as failures; anything else resets the streak. */
  recentStatuses: ExecutionStatus[]
  maxConsecutiveFailures: number
}

export type BreakerResult =
  | { tripped: false }
  | { tripped: true; reason: 'consecutive_failures'; consecutiveFailures: number }

const FAILURE_STATUSES = new Set<ExecutionStatus>(['error', 'rejected'])

export function checkConsecutiveFailures(input: BreakerInput): BreakerResult {
  let streak = 0
  for (const status of input.recentStatuses) {
    if (!FAILURE_STATUSES.has(status)) break
    streak++
  }

  if (streak >= input.maxConsecutiveFailures) {
    return { tripped: true, reason: 'consecutive_failures', consecutiveFailures: streak }
  }
  return { tripped: false }
}
