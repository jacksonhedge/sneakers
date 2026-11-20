import { ipLimiter, requestIp } from '@/lib/ip-limit'
import { json, readJson, requireIngestSecret } from '@/lib/spare-change-admin'
import { ingestIssue, parseIssue } from '@/lib/spare-change-core'
import { ingestStore } from '@/lib/spare-change-core-store'

export const dynamic = 'force-dynamic'

// Per address, per minute, on this server. The pipeline posts once a day; this only slows down someone guessing at the secret.
const mayPost = ipLimiter(10)

/**
 * Store one day's issue. Body: the pipeline's `issue.json`, as is (`tools/publish_issue.py` posts it).
 * `Authorization: Bearer <SPARE_CHANGE_INGEST_SECRET>`. 503 `not_configured` while that variable is unset; 401 `unauthorized` without it.
 * 400 `invalid_issue` with `detail` naming the first thing wrong (a number that is not whole cents, a leg price of 1 or less, an
 * estimate that does not match buy-in x (product of leg decimals - 1) within one cent). Nothing is stored from a body that fails.
 * 200 `{ ok, issue_date, tickets: [{ position, id, site, min_age, action }], refused: [...], warnings: [...] }`. Posting the same issue
 * again is safe: a ticket keeps its id. A ticket that already has wagers is updated in place and is never deleted or turned into a
 * different ticket; anything refused for that reason is listed in `refused`.
 */
export async function POST(req: Request) {
  if (!mayPost(requestIp(req.headers))) return json({ ok: false, error: 'too_many' }, 429)
  const gate = requireIngestSecret(req)
  if (!gate.ok) return gate.response
  const body = await readJson(req)
  if (body === null) return json({ ok: false, error: 'invalid_issue', detail: 'the body is not JSON (or is over 1 MB)' }, 400)
  const parsed = parseIssue(body)
  if (!parsed.ok) return json(parsed, 400)
  try {
    return json(await ingestIssue(parsed.issue, body, ingestStore))
  } catch {
    // Every write is an upsert, so posting the same issue again after a failure finishes the job.
    console.error('[spare-change-ingest] store failed')
    return json({ ok: false, error: 'server_error', detail: 'the issue may be partly stored; post it again' }, 500)
  }
}
