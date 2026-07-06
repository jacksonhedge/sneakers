import { describe, it, expect } from 'vitest'
import { initialState, agentReducer, isOwned, currentStatus, todayPnlCents } from './engine'

describe('engine', () => {
  it('starts equipped with updown, unpaused, seeded balance', () => {
    const s = initialState()
    expect(s.equippedId).toBe('updown')
    expect(s.paused).toBe(false)
    expect(s.balanceCents).toBe(124762)
    expect(isOwned(s, 'updown')).toBe(true)   // included
    expect(isOwned(s, 'longshot')).toBe(true) // mine
    expect(isOwned(s, 'wave')).toBe(false)
  })
  it('subscribe marks owned; equip auto-subscribes', () => {
    let s = agentReducer(initialState(), { type: 'subscribe', id: 'wave' })
    expect(isOwned(s, 'wave')).toBe(true)
    s = agentReducer(initialState(), { type: 'equip', id: 'drift' })
    expect(s.equippedId).toBe('drift')
    expect(isOwned(s, 'drift')).toBe(true)
  })
  it('cannot equip a model in review', () => {
    const s = agentReducer(initialState(), { type: 'equip', id: 'news' })
    expect(s.equippedId).toBe('updown')
  })
  it('tick advances the status machine; paused freezes it', () => {
    const s0 = initialState()
    const s1 = agentReducer(s0, { type: 'tick' })
    expect(currentStatus(s1).title).not.toBe(currentStatus(s0).title)
    const p = agentReducer(s0, { type: 'togglePaused' })
    expect(currentStatus(p).phase).toBe('paused')
    expect(agentReducer(p, { type: 'tick' }).tick).toBe(p.tick)
  })
  it('deposit grows balance and prepends ledger + spark', () => {
    const s = agentReducer(initialState(), { type: 'deposit', cents: 10000 })
    expect(s.balanceCents).toBe(134762)
    expect(s.ledger[0].kind).toBe('deposit')
    expect(s.spark[s.spark.length - 1]).toBe(134762)
  })
  it('createAgent appends an owned private model and can default the name', () => {
    const s = agentReducer(initialState(), {
      type: 'createAgent',
      input: { name: '', emoji: '🤖', color: 'cyan', kind: 'prompt', prompt: 'buy dips' },
    })
    const m = s.models[s.models.length - 1]
    expect(m.name).toBe('My Agent 1')
    expect(m.status).toBe('private')
    expect(isOwned(s, m.id)).toBe(true)
  })
  it('derives today P&L from settled decisions', () => {
    expect(todayPnlCents(initialState())).toBe(3580) // +$21.60 + $14.20 seeds
  })
})
