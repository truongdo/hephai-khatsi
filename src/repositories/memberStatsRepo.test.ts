import { where, type QueryConstraint } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import { createMemberStatsRepo } from './memberStatsRepo'

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

describe('createMemberStatsRepo', () => {
  it('loads totals, org breakdown, and rank rows with unknown', async () => {
    const countMembers = vi.fn(async (constraints: QueryConstraint[]) => {
      const key = constraintKey(constraints)
      const table: Record<string, number> = {
        [constraintKey([])]: 10,
        [constraintKey([where('sanghaType', '==', 'tang')])]: 6,
        [constraintKey([where('sanghaType', '==', 'ni')])]: 4,
        [constraintKey([where('orgUnitId', '==', 'gd-i')])]: 7,
        [constraintKey([where('orgUnitId', '==', 'gd-ii')])]: 3,
      }
      const parsed = JSON.parse(key) as Array<{
        field: string | null
        value: unknown
      }>
      if (
        parsed.some(
          (p) => p.field === 'giaoPhamHePhai.rank' && p.value === 'hoa_thuong',
        ) &&
        parsed.some((p) => p.field === 'sanghaType' && p.value === 'tang')
      ) {
        return 2
      }
      if (parsed.some((p) => p.field === 'giaoPhamHePhai.rank')) return 0
      if (key in table) return table[key]!
      throw new Error(`unexpected constraints: ${key}`)
    })

    const repo = createMemberStatsRepo(countMembers)
    const stats = await repo.loadDashboardStats({
      orgUnitId: null,
      orgUnitIdsForBreakdown: ['gd-i', 'gd-ii'],
    })

    expect(stats.totals).toEqual({ all: 10, tang: 6, ni: 4 })
    expect(stats.byOrgUnit).toEqual([
      { orgUnitId: 'gd-i', count: 7 },
      { orgUnitId: 'gd-ii', count: 3 },
    ])
    expect(stats.byRankTang[0]).toEqual({ rank: 'hoa_thuong', count: 2 })
    expect(stats.byRankTang.at(-1)).toEqual({ rank: 'unknown', count: 4 })
    expect(stats.byRankNi.at(-1)?.rank).toBe('unknown')
  })

  it('scopes all counts when orgUnitId set and skips org breakdown when empty', async () => {
    const countMembers = vi.fn(async (constraints: QueryConstraint[]) => {
      const parsed = JSON.parse(
        JSON.stringify(
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
        ),
      ) as Array<{ field: string | null; value: unknown }>
      expect(
        parsed.some((p) => p.field === 'orgUnitId' && p.value === 'gd-i'),
      ).toBe(true)
      if (parsed.some((p) => p.field === 'giaoPhamHePhai.rank')) return 0
      if (parsed.some((p) => p.field === 'sanghaType' && p.value === 'tang'))
        return 5
      if (parsed.some((p) => p.field === 'sanghaType' && p.value === 'ni'))
        return 3
      return 8
    })

    const repo = createMemberStatsRepo(countMembers)
    const stats = await repo.loadDashboardStats({
      orgUnitId: 'gd-i',
      orgUnitIdsForBreakdown: [],
    })

    expect(stats.totals).toEqual({ all: 8, tang: 5, ni: 3 })
    expect(stats.byOrgUnit).toEqual([])
  })
})
