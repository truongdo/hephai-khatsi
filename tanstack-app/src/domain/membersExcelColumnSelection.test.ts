import { describe, expect, it } from 'vitest'
import { defaultMembersExcelColumnIds } from '#/domain/memberExcelColumns'
import {
  loadMembersExcelColumnIds,
  membersExcelColumnsStorageKey,
  parseStoredMembersExcelColumnIds,
  saveMembersExcelColumnIds,
} from '#/domain/membersExcelColumnSelection'

describe('parseStoredMembersExcelColumnIds', () => {
  it('returns defaults for null, invalid JSON, non-array, and empty after stripping', () => {
    const defaults = defaultMembersExcelColumnIds('tang')
    expect(parseStoredMembersExcelColumnIds(null, 'tang')).toEqual(defaults)
    expect(parseStoredMembersExcelColumnIds('{', 'tang')).toEqual(defaults)
    expect(parseStoredMembersExcelColumnIds('{}', 'tang')).toEqual(defaults)
    expect(parseStoredMembersExcelColumnIds('["not-a-column"]', 'tang')).toEqual(defaults)
  })

  it('keeps known ids in catalog order and drops unknown and ni-only ids on tang', () => {
    expect(
      parseStoredMembersExcelColumnIds(
        JSON.stringify(['hienTuHoc', 'gioiTyKheoNi_ngayGh', 'theDanh', 'nope']),
        'tang',
      ),
    ).toEqual(['theDanh', 'hienTuHoc'])
  })
})

describe('load/save', () => {
  it('round-trips through a Storage mock', () => {
    const store: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    }
    saveMembersExcelColumnIds('ni', ['phapDanh', 'cccd'], storage)
    expect(store[membersExcelColumnsStorageKey('ni')]).toBe(JSON.stringify(['phapDanh', 'cccd']))
    expect(loadMembersExcelColumnIds('ni', storage)).toEqual(['phapDanh', 'cccd'])
  })
})
