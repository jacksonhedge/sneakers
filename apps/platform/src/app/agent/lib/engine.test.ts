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

describe('live-mode actions', () => {
  it('sync shallow-merges server truth', () => {
    const s0 = initialState()
    const s1 = agentReducer(s0, { type: 'sync', patch: { paused: true, balanceCents: 99, serverPnlCents: -500 } })
    expect(s1.paused).toBe(true)
    expect(s1.balanceCents).toBe(99)
    expect(s1.serverPnlCents).toBe(-500)
    expect(s1.models).toBe(s0.models) // untouched keys preserved by reference
  })

  it('modelCreated replaces an optimistic model with the same id, else appends', () => {
    const s0 = initialState()
    const optimistic = agentReducer(s0, { type: 'createAgent', input: { name: 'Fade', emoji: '🧊', color: 'cyan', kind: 'prompt' } })
    const serverModel = { ...optimistic.models.at(-1)!, id: optimistic.models.at(-1)!.id, description: 'server copy' }
    const s1 = agentReducer(optimistic, { type: 'modelCreated', model: serverModel })
    expect(s1.models.filter(m => m.id === serverModel.id)).toHaveLength(1)
    expect(s1.models.find(m => m.id === serverModel.id)!.description).toBe('server copy')
  })

  it('updateConfig renames the mine model in place', () => {
    const s0 = initialState()
    const s1 = agentReducer(s0, { type: 'updateConfig', patch: { name: 'Longshot v4', emoji: '🏇' } })
    const mine = s1.models.find(m => m.mine)!
    expect(mine.name).toBe('Longshot v4')
    expect(mine.emoji).toBe('🏇')
  })

  it('initialState has serverPnlCents null (mock mode)', () => {
    expect(initialState().serverPnlCents).toBeNull()
  })
})
