import { where, type QueryConstraint } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import { createTempleStatsRepo } from './templeStatsRepo'

function constraintKey(constraints: QueryConstraint[]): string {
  return JSON.stringify(
    constraints.map((c) => {
      const anyC = c as unknown as {
        type: string
        _field?: { segments?: string[] }
        _value?: unknown
      }
      return {
        type: anyC.type,
        field: anyC._field?.segments?.join('.') ?? null,
        value: anyC._value ?? null,
      }
    }),
  )
}

describe('createTempleStatsRepo', () => {
  it('loads totals, org breakdown, and city rows with unknown', async () => {
    const countTemples = vi.fn(async (constraints: QueryConstraint[]) => {
      const key = constraintKey(constraints)
      const table: Record<string, number> = {
        [constraintKey([])]: 10,
        [constraintKey([where('orgUnitId', '==', 'gd-i')])]: 7,
        [constraintKey([where('orgUnitId', '==', 'gd-ii')])]: 3,
        [constraintKey([where('listCityName', '==', 'Hà Nội')])]: 4,
        [constraintKey([where('listCityName', '==', 'Huế')])]: 2,
      }
      if (key in table) return table[key]!
      throw new Error(`unexpected constraints: ${key}`)
    })

    const repo = createTempleStatsRepo(countTemples)
    const stats = await repo.loadDashboardStats({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'],
      cityNamesForBreakdown: ['Hà Nội', 'Huế'],
    })

    expect(stats.totals).toEqual({ all: 10 })
    expect(stats.byOrgUnit).toEqual([
      { orgUnitId: 'gd-i', count: 7 },
      { orgUnitId: 'gd-ii', count: 3 },
    ])
    expect(stats.byCity).toEqual([
      { cityName: 'Hà Nội', count: 4 },
      { cityName: 'Huế', count: 2 },
      { cityName: 'unknown', count: 4 },
    ])
  })

  it('scopes city counts when orgUnitId set and skips org breakdown when empty', async () => {
    const countTemples = vi.fn(async (constraints: QueryConstraint[]) => {
      const parsed = JSON.parse(constraintKey(constraints)) as Array<{
        field: string | null
        value: unknown
      }>
      expect(
        parsed.some((p) => p.field === 'orgUnitId' && p.value === 'gd-i'),
      ).toBe(true)
      if (parsed.some((p) => p.field === 'listCityName' && p.value === 'Hà Nội'))
        return 3
      if (parsed.some((p) => p.field === 'listCityName')) return 0
      return 5
    })

    const repo = createTempleStatsRepo(countTemples)
    const stats = await repo.loadDashboardStats({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
      cityNamesForBreakdown: ['Hà Nội', 'Huế'],
    })

    expect(stats.totals).toEqual({ all: 5 })
    expect(stats.byOrgUnit).toEqual([])
    expect(stats.byCity.at(-1)).toEqual({ cityName: 'unknown', count: 2 })
  })
})
