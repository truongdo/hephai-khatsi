import { describe, expect, it } from 'vitest'
import { cities, getWards } from './index'

describe('vietnam-locations', () => {
  it('exports a non-empty city list', () => {
    expect(cities.length).toBeGreaterThan(0)
    expect(cities[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      fullName: expect.any(String),
    })
  })

  it('loads wards for Hanoi lazily', async () => {
    const wards = await getWards('01')
    expect(wards.length).toBeGreaterThan(0)
    expect(wards[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      type: 'ward',
    })
  })

  it('returns empty array for unknown city code', async () => {
    expect(await getWards('999')).toEqual([])
  })
})
