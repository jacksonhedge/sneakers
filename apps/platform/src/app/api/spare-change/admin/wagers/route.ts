import { json, readJson, requireAdminSession } from '@/lib/spare-change-admin'
import { rejectWager, rewardConfig, submitSlip, verifyWager } from '@/lib/spare-change-core'
import { wagerStore } from '@/lib/spare-change-core-store'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = {
  unknown_member: 404,
  unknown_ticket: 404,
  unknown_wager: 404,
  duplicate_slip: 409,
  already_verified: 409,
  not_submitted: 409,
}

/**
 * Slips and verification. Signed-in admin only (the same gate as /api/admin/*): 401 `unauthenticated`, 403 `forbidden`.
 * Body: `action` and, to say which wager, either `wager_id` or a member (`member_id` or `email`) plus a ticket (`ticket_id`, or
 * `issue_date` + `position`).
 *   `submit`: a slip arrived. Also `slip_ref` (email message id or storage path), optional `slip_bet_id` and `stake_cents`.
 *             409 `duplicate_slip` when that slip_bet_id is already on another wager.
 *   `verify`: the slip is real. Runs the reward rule and the referral rule (spare-change-core.ts) and answers
 *             `{ granted: [...], withheld: [{ what, code, detail }] }`. Verifying again grants nothing new.
 *   `reject`: with `reason`. A verified wager cannot be rejected (409 `already_verified`).
 * This records what a member did on another site. It places nothing and moves no money.
 */
export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) return gate.response
  const body = await readJson(req)
  const action = body && typeof body === 'object' ? (body as { action?: unknown }).action : null
  if (action !== 'submit' && action !== 'verify' && action !== 'reject') return json({ ok: false, error: 'invalid_action', detail: 'action is submit, verify or reject' }, 400)
  try {
    const deps = { store: wagerStore, by: gate.by }
    const result = action === 'submit' ? await submitSlip(body, deps) : action === 'reject' ? await rejectWager(body, deps) : await verifyWager(body, { ...deps, config: rewardConfig(process.env) })
    return json(result, result.ok ? 200 : (STATUS[result.error] ?? 400))
  } catch {
    // Each step is safe to repeat, so sending the same action again finishes whatever this left undone.
    console.error('[spare-change-wagers] store failed')
    return json({ ok: false, error: 'server_error', detail: 'send the same action again' }, 500)
  }
}
