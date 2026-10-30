import { describe, expect, it } from 'vitest'
import { buildCityStatRows } from './templeDirectoryStats'

describe('buildCityStatRows', () => {
  it('appends unknown as total minus known sum', () => {
    expect(buildCityStatRows(['Hà Nội', 'Huế'], [3, 5], 12)).toEqual([
      { cityName: 'Hà Nội', count: 3 },
      { cityName: 'Huế', count: 5 },
      { cityName: 'unknown', count: 4 },
    ])
  })

  it('clamps unknown at 0 when known sum exceeds total', () => {
    expect(buildCityStatRows(['Hà Nội'], [5], 3)).toEqual([
      { cityName: 'Hà Nội', count: 5 },
      { cityName: 'unknown', count: 0 },
    ])
  })

  it('throws when cityNames and knownCounts length mismatch', () => {
    expect(() => buildCityStatRows(['Hà Nội'], [1, 2], 3)).toThrow()
  })
})
