import { describe, expect, it } from 'vitest'
import {
  decisionRowToWire, myModelEntry, phaseAt, rowToModel, sparkFromLedger,
  validateConfigPut, validateCreateAgent,
} from './wire'

const updownRow = {
  id: 'updown', name: 'Up/Down', emoji: '🎢', brand: null, color: 'updown',
  author: 'Sneakers Labs', perf_30d: 14.6, runners: 2481, price_cents: null,
  price_label: null, tagline: null, description: 'The flagship.',
  status: 'live', featured: false, included: true, kind: 'prompt',
  owner_user_id: null, sort_order: 10,
} as const

describe('rowToModel', () => {
  it('maps snake_case row to the Phase-1 AgentModel shape', () => {
    const m = rowToModel({ ...updownRow }, 'user-1')
    expect(m).toMatchObject({
      id: 'updown', name: 'Up/Down', emoji: '🎢', color: 'updown',
      by: 'Sneakers Labs', perf30d: 14.6, runners: 2481, priceCents: null,
      status: 'live', included: true, kind: 'prompt',
    })
    expect(m.mine).toBeUndefined()
  })
  it('marks user-owned rows mine and hides numeric perf noise', () => {
    const m = rowToModel({ ...updownRow, id: 'custom-ab12', owner_user_id: 'user-1', status: 'private', perf_30d: null }, 'user-1')
    expect(m.mine).toBe(true)
    expect(m.by).toBe('you')
  })
})

describe('myModelEntry', () => {
  it('builds the virtual my-model orb from config', () => {
    const m = myModelEntry({ name: 'Longshot v3', emoji: '🐎', color: 'green' })
    expect(m).toMatchObject({ id: 'my-model', mine: true, status: 'private', kind: 'prompt', by: 'you', perf30d: null })
  })
})

describe('phaseAt', () => {
  it('is paused when paused', () => {
    expect(phaseAt(0, true).phase).toBe('paused')
  })
  it('cycles the 4 phase slots every 4.5s deterministically', () => {
    expect(phaseAt(0, false).phase).toBe('scanning')
    expect(phaseAt(4500, false).phase).toBe('entering')
    expect(phaseAt(9000, false).phase).toBe('holding')
    expect(phaseAt(18000, false)).toEqual(phaseAt(0, false))
  })
})

describe('sparkFromLedger', () => {
  it('returns the running balance series in chronological order', () => {
    const entries = [
      { amountCents: 3814, at: '2026-07-10' },
      { amountCents: 50000, at: '2026-07-03' },
      { amountCents: -1248, at: '2026-07-02' },
      { amountCents: 72196, at: '2026-06-30' },
    ]
    expect(sparkFromLedger(entries)).toEqual([72196, 70948, 120948, 124762])
  })
  it('pads a single point so the sparkline can draw a line', () => {
    expect(sparkFromLedger([{ amountCents: 100000, at: '2026-07-10' }])).toEqual([100000, 100000])
  })
})

describe('validateCreateAgent', () => {
  it('accepts a prompt agent', () => {
    const r = validateCreateAgent({ name: 'Fade Bot', emoji: '🧊', color: 'cyan', kind: 'prompt', prompt: 'Fade spikes.' })
    expect(r.error).toBeNull()
    expect(r.value?.kind).toBe('prompt')
  })
  it('requires https endpoint + apiKey for connected agents', () => {
    const r = validateCreateAgent({ name: 'X', emoji: '🤖', color: 'blue', kind: 'connected', endpointUrl: 'http://x.dev', apiKey: 'k'.repeat(20) })
    expect(r.error?.field).toBe('endpointUrl')
  })
  it('rejects unknown colors and over-long names', () => {
    expect(validateCreateAgent({ name: 'X', emoji: '🤖', color: 'magenta', kind: 'prompt' }).error?.field).toBe('color')
    expect(validateCreateAgent({ name: 'x'.repeat(41), emoji: '🤖', color: 'blue', kind: 'prompt' }).error?.field).toBe('name')
  })
})

describe('validateConfigPut', () => {
  it('accepts partial updates', () => {
    const r = validateConfigPut({ prompt: 'Only BTC.', preset: 'momentum' })
    expect(r.error).toBeNull()
    expect(r.value).toEqual({ prompt: 'Only BTC.', preset: 'momentum' })
  })
  it('rejects unknown presets and over-long prompts', () => {
    expect(validateConfigPut({ preset: 'yolo' }).error?.field).toBe('preset')
    expect(validateConfigPut({ prompt: 'x'.repeat(2001) }).error?.field).toBe('prompt')
  })
})
