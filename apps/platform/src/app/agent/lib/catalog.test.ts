import { describe, it, expect } from 'vitest'
import { CATALOG, marketplaceModels } from './catalog'

describe('catalog', () => {
  it('has unique ids', () => {
    const ids = CATALOG.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('starts the carousel with the equipped flagship Up/Down', () => {
    expect(CATALOG[0].id).toBe('updown')
    expect(CATALOG[0].included).toBe(true)
  })
  it('orders the marketplace featured-first, excluding my models', () => {
    const ids = marketplaceModels(CATALOG).map(m => m.id)
    expect(ids).toEqual(['oddsjam', 'gambly', 'updown', 'wave', 'drift', 'sniper', 'news'])
  })
  it('partner cards carry no metrics but do carry taglines', () => {
    for (const id of ['oddsjam', 'gambly']) {
      const m = CATALOG.find(x => x.id === id)!
      expect(m.perf30d).toBeNull()
      expect(m.tagline).toBeTruthy()
      expect(m.featured).toBe(true)
    }
  })
})
