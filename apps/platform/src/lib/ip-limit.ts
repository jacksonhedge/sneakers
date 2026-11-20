// The small per-address limit the waitlist routes use (this server only; one process): at most `max` hits per address per minute.
// Enough to stop a loop, nothing more. Each caller makes its own limiter, so one route's traffic never uses up another's allowance.
export function ipLimiter(max: number, windowMs = 60_000): (ip: string) => boolean {
  const hits = new Map<string, number[]>()
  return (ip) => {
    const now = Date.now()
    if (hits.size > 5_000) for (const [key, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(key)
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) return false
    hits.set(ip, [...recent, now])
    return true
  }
}

export const requestIp = (headers: Headers): string => headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
