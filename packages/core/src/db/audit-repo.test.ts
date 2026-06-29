import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { AuditRepo } from './audit-repo'

const url = process.env.TEST_DATABASE_URL
const maybe = url ? describe : describe.skip

maybe('AuditRepo', () => {
  let pool: Pool, repo: AuditRepo
  before(async () => { pool = new Pool({ connectionString: url }); repo = new AuditRepo(pool) })
  after(async () => { await pool.end() })

  test('record returns a positive id', async () => {
    const entry = {
      botConfigId: 1,
      windowId: 1,
      mode: 'dry_run' as const,
      side: 'YES' as const,
      requestedUsd: 100,
      sizeUsd: 100,
      status: 'pending',
    }
    const id = await repo.record(entry)
    assert.ok(typeof id === 'number' && id > 0)
  })

  test('record works with minimal fields', async () => {
    const entry = {
      botConfigId: 1,
      windowId: null,
      mode: 'blocked' as const,
      side: 'NO' as const,
      requestedUsd: 50,
      sizeUsd: null,
      blockedReason: 'insufficient liquidity',
    }
    const id = await repo.record(entry)
    assert.ok(typeof id === 'number' && id > 0)
  })
})

describe('AuditRepo (pure)', () => {
  test('has no update/delete/mutate methods on prototype', () => {
    const proto = Object.getPrototypeOf(new AuditRepo(null as any))
    assert.ok(typeof proto.record === 'function', 'has record method')
    assert.ok(!('update' in proto), 'no update method')
    assert.ok(!('delete' in proto), 'no delete method')
    assert.ok(!('mutate' in proto), 'no mutate method')
  })
})
