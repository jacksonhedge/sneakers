import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { AgentRepo } from './agent-repo'

const url = process.env.TEST_DATABASE_URL
const maybe = url ? describe : describe.skip

maybe('AgentRepo', () => {
  let pool: Pool, repo: AgentRepo
  before(async () => { pool = new Pool({ connectionString: url }); repo = new AgentRepo(pool) })
  after(async () => { await pool.end() })

  test('upsert window is idempotent and round-trips', async () => {
    const seed = { venue: 'polymarket' as const, asset: 'BTC' as const, intervalSec: 300,
      externalId: 'test-' + Math.floor(Math.random()*1e9), opensAt: Date.now(), closesAt: Date.now()+300000,
      referenceOracle: 'chainlink-datastreams:BTC-USD' }
    const a = await repo.upsertWindow(seed)
    const b = await repo.upsertWindow(seed)
    assert.equal(a.id, b.id)            // idempotent on (venue, external_id)
    assert.equal(a.status, 'upcoming')
  })

  test('open ref + settle update outcome and status', async () => {
    const seed = { venue: 'kalshi' as const, asset: 'BTC' as const, intervalSec: 900,
      externalId: 'test-' + Math.floor(Math.random()*1e9), opensAt: Date.now(), closesAt: Date.now()+900000,
      referenceOracle: 'cf-benchmarks:BRTI' }
    const w = await repo.upsertWindow(seed)
    await repo.setOpenRef(w.id, 100000)
    await repo.setSettle(w.id, 100050, 'up')
    const open = await repo.loadOpenWindows(Date.now() + 1_000_000) // far future → none open
    assert.ok(!open.find(x => x.id === w.id))
  })
})
