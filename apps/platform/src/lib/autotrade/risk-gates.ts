import { getServerClient } from '@/lib/supabase-server'
import { loadAllLatestSnapshots } from '@/lib/markets-data'
import { loadUserCredentials } from './credentials'
import { fetchBalance } from './polymarket'
import { checkCooldown, checkConsecutiveFailures, type ExecutionStatus } from '@sneakers/core'

// 7-gate risk check for a co-pilot trade draft. Modeled on the
// OctagonAI/kalshi-deep-trading-bot pattern surveyed 2026-04-29: every
// gate either passes with optional context or fails with a human-readable
// reason. The execute endpoint shows the verdict array to the user as
// part of the confirm card so they see exactly what was checked.

export type GateVerdict =
  | { gate: string; pass: true; detail?: string }
  | { gate: string; pass: false; reason: string }

export type GateResult = {
  allPassed: boolean
  verdicts: GateVerdict[]
}

export interface DraftForGates {
  user_id: string                // waitlist.id
  auth_user_id: string           // auth.users.id (for creds + executions)
  platform: string
  platform_market_id: string
  outcome_name: string
  side: 'buy' | 'sell'
  size_usd: number
  max_price: number
}

const DEFAULT_PER_TRADE_CAP = 50
const DEFAULT_DAILY_CAP = 200
const DEFAULT_COOLDOWN_SECONDS = 60
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3

export async function runRiskGates(draft: DraftForGates): Promise<GateResult> {
  const verdicts: GateVerdict[] = []
  const admin = getServerClient()

  // ── Gate 1: kill switch off ────────────────────────────────────────
  // Pull settings — if no row exists we treat it as "defaults, kill
  // switch off" so users don't have to opt in just to receive a default
  // configuration.
  const { data: settings } = await admin
    .from('autotrade_settings')
    .select(
      'per_trade_cap_usd, daily_cap_usd, kill_switch_active, kill_switch_reason, cooldown_seconds, max_consecutive_failures',
    )
    .eq('user_id', draft.auth_user_id)
    .maybeSingle()

  const perTradeCap = Number(settings?.per_trade_cap_usd ?? DEFAULT_PER_TRADE_CAP)
  const dailyCap = Number(settings?.daily_cap_usd ?? DEFAULT_DAILY_CAP)
  const cooldownSeconds = Number(settings?.cooldown_seconds ?? DEFAULT_COOLDOWN_SECONDS)
  const maxConsecutiveFailures = Number(
    settings?.max_consecutive_failures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES,
  )

  if (settings?.kill_switch_active) {
    verdicts.push({
      gate: 'kill_switch',
      pass: false,
      reason: settings.kill_switch_reason
        ? `Kill switch active: ${settings.kill_switch_reason}`
        : 'Kill switch active. Disable it on /dashboard/settings/autotrade.',
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({ gate: 'kill_switch', pass: true })

  // ── Gate 2: cooldown since last placed order + Gate 3: reliability breaker ──
  // Both read the same recent-executions window, so fetch it once. Only
  // 'error'/'rejected' count as breaker failures — trade_executions has no
  // win/loss tracking (positions can sit open for days), so this protects
  // against a broken credential or repeated system failure, not a losing
  // streak.
  const { data: recentExecs, error: recentErr } = await admin
    .from('trade_executions')
    .select('status, attempted_at')
    .eq('user_id', draft.auth_user_id)
    .order('attempted_at', { ascending: false })
    .limit(Math.max(maxConsecutiveFailures, 10))
  if (recentErr) {
    verdicts.push({
      gate: 'cooldown',
      pass: false,
      reason: `Could not read recent executions: ${recentErr.message}`,
    })
    return { allPassed: false, verdicts }
  }

  const lastPlaced = (recentExecs ?? []).find(
    (e) => e.status === 'pending' || e.status === 'filled',
  )
  const cooldown = checkCooldown({
    lastTradeAtMs: lastPlaced ? new Date(lastPlaced.attempted_at).getTime() : null,
    cooldownSeconds,
    nowMs: Date.now(),
  })
  if (!cooldown.ok) {
    verdicts.push({
      gate: 'cooldown',
      pass: false,
      reason: `Cooldown active — try again in ${Math.ceil(cooldown.retryAfterMs / 1000)}s.`,
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({ gate: 'cooldown', pass: true })

  const breaker = checkConsecutiveFailures({
    recentStatuses: (recentExecs ?? []).map((e) => e.status as ExecutionStatus),
    maxConsecutiveFailures,
  })
  if (breaker.tripped) {
    // Best-effort write for dashboard visibility — the gate decision above
    // is always live-recomputed from recent executions, so this isn't a
    // sticky flag that needs a manual reset; it self-clears once a real
    // success lands.
    await admin
      .from('autotrade_settings')
      .update({
        breaker_tripped_at: new Date().toISOString(),
        breaker_reason: `${breaker.consecutiveFailures} consecutive failed executions`,
      })
      .eq('user_id', draft.auth_user_id)
    verdicts.push({
      gate: 'circuit_breaker',
      pass: false,
      reason: `Paused after ${breaker.consecutiveFailures} consecutive failed executions. Check your connection on /dashboard/settings/autotrade.`,
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({ gate: 'circuit_breaker', pass: true })

  // ── Gate 4: per-trade cap ──────────────────────────────────────────
  if (draft.size_usd > perTradeCap) {
    verdicts.push({
      gate: 'per_trade_cap',
      pass: false,
      reason: `Draft size $${draft.size_usd.toFixed(2)} exceeds per-trade cap $${perTradeCap.toFixed(2)}.`,
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({
    gate: 'per_trade_cap',
    pass: true,
    detail: `$${draft.size_usd.toFixed(2)} / $${perTradeCap.toFixed(2)}`,
  })

  // ── Gate 5: daily cap (UTC day) ────────────────────────────────────
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { data: todaysExecs, error: execErr } = await admin
    .from('trade_executions')
    .select('size_usd, status')
    .eq('user_id', draft.auth_user_id)
    .gte('attempted_at', todayStart.toISOString())
  if (execErr) {
    verdicts.push({
      gate: 'daily_cap',
      pass: false,
      reason: `Could not read today's executions: ${execErr.message}`,
    })
    return { allPassed: false, verdicts }
  }
  const usedToday = (todaysExecs ?? [])
    .filter((e) => e.status !== 'rejected' && e.status !== 'error')
    .reduce((acc, e) => acc + Number(e.size_usd ?? 0), 0)
  if (usedToday + draft.size_usd > dailyCap) {
    verdicts.push({
      gate: 'daily_cap',
      pass: false,
      reason: `Today's $${usedToday.toFixed(2)} + draft $${draft.size_usd.toFixed(2)} exceeds daily cap $${dailyCap.toFixed(2)}.`,
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({
    gate: 'daily_cap',
    pass: true,
    detail: `$${(usedToday + draft.size_usd).toFixed(2)} / $${dailyCap.toFixed(2)} after this trade`,
  })

  // ── Gate 6: market still tradeable ────────────────────────────────
  // Resolve the snapshot, confirm phase != closed, confirm best_ask is
  // within the user's max_price ceiling. Catches: stale drafts the AI
  // proposed 14 minutes ago that are now resolved, or markets that
  // moved past the limit since the proposal.
  const { snapshots } = await loadAllLatestSnapshots()
  const snap = snapshots.find(
    (s) => s.platform === draft.platform && s.platform_market_id === draft.platform_market_id,
  )
  if (!snap) {
    verdicts.push({
      gate: 'market_tradeable',
      pass: false,
      reason: `No fresh snapshot for ${draft.platform}:${draft.platform_market_id}.`,
    })
    return { allPassed: false, verdicts }
  }
  if (snap.phase === 'closed') {
    verdicts.push({
      gate: 'market_tradeable',
      pass: false,
      reason: 'Market is closed — no trades possible.',
    })
    return { allPassed: false, verdicts }
  }
  // Case-insensitive match: the trade route sends 'YES'/'NO' (uppercase) but
  // Polymarket's API + scraper store 'Yes'/'No' (title case). A strict === here
  // was blocking EVERY manual trade at this gate.
  const outcome = snap.outcomes.find(
    (o) => o.name.toUpperCase() === draft.outcome_name.toUpperCase(),
  )
  if (!outcome) {
    verdicts.push({
      gate: 'market_tradeable',
      pass: false,
      reason: `Outcome "${draft.outcome_name}" not on this market.`,
    })
    return { allPassed: false, verdicts }
  }
  const askNow = outcome.best_ask ?? outcome.last_price
  if (askNow == null) {
    verdicts.push({
      gate: 'market_tradeable',
      pass: false,
      reason: 'Market has no best_ask or last_price — illiquid right now.',
    })
    return { allPassed: false, verdicts }
  }
  if (askNow > draft.max_price) {
    verdicts.push({
      gate: 'market_tradeable',
      pass: false,
      reason: `Market moved: best_ask ${askNow.toFixed(3)} now exceeds limit ${draft.max_price.toFixed(3)}.`,
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({
    gate: 'market_tradeable',
    pass: true,
    detail: `phase=${snap.phase} ask=${askNow.toFixed(3)} limit=${draft.max_price.toFixed(3)}`,
  })

  // ── Gate 7: live credentials + balance check (Polymarket only) ────
  if (draft.platform !== 'polymarket') {
    verdicts.push({
      gate: 'venue_credentials',
      pass: false,
      reason: `Trade execution is only wired for Polymarket today (got ${draft.platform}).`,
    })
    return { allPassed: false, verdicts }
  }
  const creds = await loadUserCredentials(draft.auth_user_id, 'polymarket')
  if (!creds || !creds.privateKey || !creds.funderAddress) {
    verdicts.push({
      gate: 'venue_credentials',
      pass: false,
      reason:
        'Polymarket credentials not connected. Set them up on /dashboard/settings/autotrade.',
    })
    return { allPassed: false, verdicts }
  }
  let balance: { usdcCents: number } | null = null
  try {
    balance = await fetchBalance(creds)
  } catch (err) {
    verdicts.push({
      gate: 'venue_credentials',
      pass: false,
      reason: `Polymarket balance check failed: ${(err as Error).message}`,
    })
    return { allPassed: false, verdicts }
  }
  const usdcDollars = balance.usdcCents / 100
  if (usdcDollars < draft.size_usd) {
    verdicts.push({
      gate: 'venue_credentials',
      pass: false,
      reason: `USDC balance $${usdcDollars.toFixed(2)} below draft size $${draft.size_usd.toFixed(2)}.`,
    })
    return { allPassed: false, verdicts }
  }
  verdicts.push({
    gate: 'venue_credentials',
    pass: true,
    detail: `USDC $${usdcDollars.toFixed(2)} available`,
  })

  return { allPassed: true, verdicts }
}
