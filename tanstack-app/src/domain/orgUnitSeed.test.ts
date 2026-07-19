import { describe, expect, it } from 'vitest'
import { ORG_UNIT_SEED } from './orgUnitSeed'

describe('ORG_UNIT_SEED', () => {
  it('has seven units ordered 1–7', () => {
    expect(ORG_UNIT_SEED).toHaveLength(7)
    expect(ORG_UNIT_SEED.map((u) => u.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('marks ni gioi as ni-only', () => {
    const ni = ORG_UNIT_SEED.find((u) => u.code === 'ni-gioi')
    expect(ni?.kind).toBe('ni_gioi')
    expect(ni?.allowsTang).toBe(false)
    expect(ni?.allowsNi).toBe(true)
  })
})
