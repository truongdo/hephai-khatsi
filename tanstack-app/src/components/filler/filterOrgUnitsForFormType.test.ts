import { describe, expect, it } from 'vitest'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import { filterOrgUnitsForFormType } from './filterOrgUnitsForFormType'

describe('filterOrgUnitsForFormType', () => {
  it('member_tang keeps allowsTang units', () => {
    const result = filterOrgUnitsForFormType(ORG_UNIT_SEED, 'member_tang')
    expect(result.every((u) => u.allowsTang)).toBe(true)
    expect(result.map((u) => u.id)).not.toContain('ni-gioi')
  })

  it('member_ni keeps allowsNi units', () => {
    const result = filterOrgUnitsForFormType(ORG_UNIT_SEED, 'member_ni')
    expect(result.every((u) => u.allowsNi)).toBe(true)
    expect(result.map((u) => u.id)).not.toContain('gd-ii')
    expect(result.map((u) => u.id)).not.toContain('gd-v')
    expect(result.map((u) => u.id)).toContain('ni-gioi')
  })

  it('temple returns all units', () => {
    expect(filterOrgUnitsForFormType(ORG_UNIT_SEED, 'temple')).toEqual(ORG_UNIT_SEED)
  })
})
