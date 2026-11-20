import { json, readJson, requireAdminSession } from '@/lib/spare-change-admin'
import { markRewardsPaid } from '@/lib/spare-change-core'
import { payoutStore, payoutsDue } from '@/lib/spare-change-core-store'

export const dynamic = 'force-dynamic'

/**
 * What is owed. Signed-in admin only. `due` is the sc_payouts_due view (one row per member with unpaid rewards, a Venmo username and
 * not removed: name, venmo_handle, state, age_at_signup, unpaid_count, unpaid_cents, oldest_earned_at) and `rewards` is the unpaid
 * ledger rows behind it; their ids are what POST takes.
 */
export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) return gate.response
  try {
    const list = await payoutsDue()
    return json({ ok: true, ...list, total_due_cents: list.due.reduce((sum, d) => sum + Number(d.unpaid_cents), 0) })
  } catch {
    console.error('[spare-change-payouts] read failed')
    return json({ ok: false, error: 'server_error' }, 500)
  }
}

/**
 * Write down that rewards were paid (by hand, on Venmo). Signed-in admin only. Body: `reward_ids` (1 to 500) and a `batch` label.
 * Sets paid_at, pay_batch and paid_to (the member's Venmo username right now) on each. A reward that is already paid, or whose member
 * has no Venmo username, is refused and listed in `refused`; the rest are marked. This moves no money.
 */
export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) return gate.response
  try {
    const result = await markRewardsPaid(await readJson(req), { store: payoutStore, by: gate.by })
    return json(result, result.ok ? 200 : 400)
  } catch {
    console.error('[spare-change-payouts] write failed')
    return json({ ok: false, error: 'server_error', detail: 'some rewards may be marked; read the list again before retrying' }, 500)
  }
}
