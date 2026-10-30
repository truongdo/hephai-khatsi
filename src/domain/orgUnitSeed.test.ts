import { describe, expect, it } from 'vitest'
import { ORG_UNIT_SEED } from './orgUnitSeed'

describe('ORG_UNIT_SEED', () => {
  it('has eleven units ordered 1–11', () => {
    expect(ORG_UNIT_SEED).toHaveLength(11)
    expect(ORG_UNIT_SEED.map((u) => u.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })

  it('keeps giao doan as tang-only', () => {
    const giaoDoan = ORG_UNIT_SEED.filter((u) => u.kind === 'giao_doan')
    expect(giaoDoan).toHaveLength(6)
    expect(giaoDoan.every((u) => u.allowsTang && !u.allowsNi)).toBe(true)
  })

  it('includes ni gioi giao doan units as ni-only', () => {
    const ids = ORG_UNIT_SEED.filter((u) => u.kind === 'ni_gioi').map((u) => u.id)
    expect(ids).toEqual([
      'ni-gd-i',
      'ni-gd-iii',
      'ni-gd-iv',
      'ni-gd-vi',
      'ni-gioi',
    ])
    expect(
      ORG_UNIT_SEED.filter((u) => u.kind === 'ni_gioi').every(
        (u) => !u.allowsTang && u.allowsNi,
      ),
    ).toBe(true)
  })

  it('marks he phai ni gioi as ni-only', () => {
    const ni = ORG_UNIT_SEED.find((u) => u.code === 'ni-gioi')
    expect(ni?.kind).toBe('ni_gioi')
    expect(ni?.allowsTang).toBe(false)
    expect(ni?.allowsNi).toBe(true)
    expect(ni?.order).toBe(11)
  })
})
