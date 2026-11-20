import { ipLimiter, requestIp } from '@/lib/ip-limit'
import { json, readJson, requireIngestSecretOrAdmin } from '@/lib/spare-change-admin'
import { parseSettle, settleIssue } from '@/lib/spare-change-core'
import { settleStore } from '@/lib/spare-change-core-store'

export const dynamic = 'force-dynamic'

const mayPost = ipLimiter(10)

/**
 * Write the results of an issue. The pipeline posts its grading here (`tools/publish_issue.py --settle`) with
 * `Authorization: Bearer <SPARE_CHANGE_INGEST_SECRET>`; a signed-in admin can post the same body. 401 without either.
 * Body: `{ issue_date, tickets: [{ position, result, legs: [{ n, result }] }] }`. Leg results: hit, miss, push (stored as void), pending,
 * ungraded. Ticket results: won / lost / pending / void (or the pipeline's Hit / Miss / Pending), and it must be what the legs make it.
 * 400 `invalid_settle`; 404 `unknown_issue`, `unknown_ticket` or `unknown_leg` (nothing is changed in those cases).
 * Updates sc_legs.result, sc_tickets.result and settled_at, and each wager's result (payout_cents only for a won wager with a known
 * stake). Safe to post again as more games finish. No money moves.
 */
export async function POST(req: Request) {
  if (!mayPost(requestIp(req.headers))) return json({ ok: false, error: 'too_many' }, 429)
  const gate = await requireIngestSecretOrAdmin(req)
  if (!gate.ok) return gate.response
  const parsed = parseSettle(await readJson(req))
  if (!parsed.ok) return json(parsed, 400)
  try {
    const result = await settleIssue(parsed, { store: settleStore })
    return json(result, result.ok ? 200 : 404)
  } catch {
    console.error('[spare-change-settle] store failed')
    return json({ ok: false, error: 'server_error', detail: 'post the same results again' }, 500)
  }
}
