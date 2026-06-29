import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { ConsentRepo } from './consent-repo'

const url = process.env.TEST_DATABASE_URL
const maybe = url ? describe : describe.skip

maybe('ConsentRepo', () => {
  let pool: Pool, repo: ConsentRepo
  before(async () => {
    pool = new Pool({ connectionString: url })
    repo = new ConsentRepo(pool)
  })
  after(async () => {
    await pool.end()
  })

  test('recordConsent and latestConsent round-trip', async () => {
    const userId = crypto.randomUUID()
    const version = 'v1.0-agent-consent'

    // Record consent
    await repo.recordConsent(userId, version)

    // Fetch latest
    const latest = await repo.latestConsent(userId)

    assert.ok(latest, 'should return a consent record')
    assert.equal(latest!.version, version, 'version should match')
    assert.ok(typeof latest!.acceptedAtMs === 'number', 'acceptedAtMs should be a number')
    assert.ok(latest!.acceptedAtMs > 0, 'acceptedAtMs should be a positive epoch-ms')
  })

  test('latestConsent returns most recent when multiple exist', async () => {
    const userId = crypto.randomUUID()

    // Record two consents with different versions
    await repo.recordConsent(userId, 'v0.1-early')

    // Small delay to ensure accepted_at differs
    await new Promise((r) => setTimeout(r, 10))

    await repo.recordConsent(userId, 'v1.0-final')

    // Fetch latest
    const latest = await repo.latestConsent(userId)

    assert.ok(latest, 'should return a consent record')
    assert.equal(latest!.version, 'v1.0-final', 'should return the most recent version')
  })

  test('latestConsent returns null for non-existent user', async () => {
    const userId = crypto.randomUUID()
    const latest = await repo.latestConsent(userId)
    assert.equal(latest, null, 'should return null when no record exists')
  })
})

describe('ConsentRepo (pure)', () => {
  test('exposes recordConsent and latestConsent methods', () => {
    const proto = Object.getPrototypeOf(new ConsentRepo(null as any))
    assert.ok(
      typeof proto.recordConsent === 'function',
      'should have recordConsent method'
    )
    assert.ok(
      typeof proto.latestConsent === 'function',
      'should have latestConsent method'
    )
  })
})
