import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { liveEligibility, PROOF_MIN_DAYS, PROOF_MIN_TRADES, type LiveContext, type EligibilityResult } from './eligibility'

const ctx = (over: Partial<LiveContext> = {}): LiveContext => ({
  botCreatedAtMs: 1_000_000,
  settledDryRunTrades: 50,
  consentVersionAccepted: '1.0.0',
  currentConsentVersion: '1.0.0',
  venueConnected: true,
  nowMs: 1_000_000 + 7 * 24 * 60 * 60 * 1000, // 7 days later
  ...over,
})

describe('liveEligibility', () => {
  describe('proof_period (must be >= 7 days old)', () => {
    test('rejects if only 6 days old', () => {
      const sixDaysMs = 6 * 24 * 60 * 60 * 1000
      const result = liveEligibility(ctx({ nowMs: 1_000_000 + sixDaysMs }))
      assert.deepEqual(result, { eligible: false, reason: 'proof_period' })
    })

    test('accepts if exactly 7 days old', () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      const result = liveEligibility(ctx({ nowMs: 1_000_000 + sevenDaysMs }))
      assert.ok(result.eligible === true)
    })

    test('accepts if older than 7 days', () => {
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000
      const result = liveEligibility(ctx({ nowMs: 1_000_000 + eightDaysMs }))
      assert.ok(result.eligible === true)
    })
  })

  describe('proof_trades (must have >= 50 settled dry-run trades)', () => {
    test('rejects if only 49 trades', () => {
      const result = liveEligibility(ctx({ settledDryRunTrades: 49 }))
      assert.deepEqual(result, { eligible: false, reason: 'proof_trades' })
    })

    test('accepts if exactly 50 trades', () => {
      const result = liveEligibility(ctx({ settledDryRunTrades: 50 }))
      assert.ok(result.eligible === true)
    })

    test('accepts if more than 50 trades', () => {
      const result = liveEligibility(ctx({ settledDryRunTrades: 75 }))
      assert.ok(result.eligible === true)
    })
  })

  describe('consent_required (must accept current version)', () => {
    test('rejects if consent is null', () => {
      const result = liveEligibility(ctx({ consentVersionAccepted: null }))
      assert.deepEqual(result, { eligible: false, reason: 'consent_required' })
    })

    test('rejects if accepted version is older than current', () => {
      const result = liveEligibility(ctx({ consentVersionAccepted: '1.0.0', currentConsentVersion: '2.0.0' }))
      assert.deepEqual(result, { eligible: false, reason: 'consent_required' })
    })

    test('accepts if versions match', () => {
      const result = liveEligibility(ctx({ consentVersionAccepted: '1.5.0', currentConsentVersion: '1.5.0' }))
      assert.ok(result.eligible === true)
    })
  })

  describe('not_connected (must have venue connected)', () => {
    test('rejects if venue not connected', () => {
      const result = liveEligibility(ctx({ venueConnected: false }))
      assert.deepEqual(result, { eligible: false, reason: 'not_connected' })
    })

    test('accepts if venue connected', () => {
      const result = liveEligibility(ctx({ venueConnected: true }))
      assert.ok(result.eligible === true)
    })
  })

  describe('check order (first failing reason returned)', () => {
    test('returns proof_period if all others fail too', () => {
      const result = liveEligibility(
        ctx({
          nowMs: 1_000_000 + 6 * 24 * 60 * 60 * 1000, // 6 days
          settledDryRunTrades: 0,
          consentVersionAccepted: null,
          venueConnected: false,
        }),
      )
      assert.deepEqual(result, { eligible: false, reason: 'proof_period' })
    })

    test('returns proof_trades if period passes but trades fail', () => {
      const result = liveEligibility(
        ctx({
          settledDryRunTrades: 0,
          consentVersionAccepted: null,
          venueConnected: false,
        }),
      )
      assert.deepEqual(result, { eligible: false, reason: 'proof_trades' })
    })

    test('returns consent_required if period and trades pass but consent fails', () => {
      const result = liveEligibility(ctx({ consentVersionAccepted: null, venueConnected: false }))
      assert.deepEqual(result, { eligible: false, reason: 'consent_required' })
    })

    test('returns not_connected if only venue fails', () => {
      const result = liveEligibility(ctx({ venueConnected: false }))
      assert.deepEqual(result, { eligible: false, reason: 'not_connected' })
    })
  })

  describe('happy path (all checks pass)', () => {
    test('eligible when all conditions met', () => {
      const result = liveEligibility(
        ctx({
          botCreatedAtMs: 1_000_000,
          settledDryRunTrades: 50,
          consentVersionAccepted: '1.0.0',
          currentConsentVersion: '1.0.0',
          venueConnected: true,
          nowMs: 1_000_000 + 7 * 24 * 60 * 60 * 1000,
        }),
      )
      assert.deepEqual(result, { eligible: true })
    })

    test('eligible with generous margins', () => {
      const result = liveEligibility(
        ctx({
          botCreatedAtMs: 100_000,
          settledDryRunTrades: 200,
          consentVersionAccepted: '2.1.0',
          currentConsentVersion: '2.1.0',
          venueConnected: true,
          nowMs: 100_000 + 30 * 24 * 60 * 60 * 1000, // 30 days
        }),
      )
      assert.deepEqual(result, { eligible: true })
    })
  })

  test('PROOF_MIN_DAYS exported as 7', () => {
    assert.strictEqual(PROOF_MIN_DAYS, 7)
  })

  test('PROOF_MIN_TRADES exported as 50', () => {
    assert.strictEqual(PROOF_MIN_TRADES, 50)
  })
})
