import { describe, expect, it } from 'vitest'
import { buildRankStatRows } from './memberDirectoryStats'

describe('buildRankStatRows', () => {
  it('appends unknown as total minus known sum', () => {
    expect(buildRankStatRows(['a', 'b'], [3, 5], 12)).toEqual([
      { rank: 'a', count: 3 },
      { rank: 'b', count: 5 },
      { rank: 'unknown', count: 4 },
    ])
  })

  it('clamps unknown at 0 when known sum exceeds total', () => {
    expect(buildRankStatRows(['a'], [5], 3)).toEqual([
      { rank: 'a', count: 5 },
      { rank: 'unknown', count: 0 },
    ])
  })

  it('throws when rankValues and knownCounts length mismatch', () => {
    expect(() => buildRankStatRows(['a'], [1, 2], 3)).toThrow()
  })
})
