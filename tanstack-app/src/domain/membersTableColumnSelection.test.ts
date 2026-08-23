import { describe, expect, it } from 'vitest'
import { defaultMembersTableColumnIds } from '#/domain/memberExcelColumns'
import {
  loadMembersTableColumnIds,
  membersTableColumnsStorageKey,
  parseStoredMembersTableColumnIds,
  saveMembersTableColumnIds,
} from '#/domain/membersTableColumnSelection'

describe('parseStoredMembersTableColumnIds', () => {
  it('returns table defaults for missing or invalid storage', () => {
    const defaults = defaultMembersTableColumnIds('tang')
    expect(parseStoredMembersTableColumnIds(null, 'tang')).toEqual(defaults)
    expect(parseStoredMembersTableColumnIds('{', 'tang')).toEqual(defaults)
    expect(parseStoredMembersTableColumnIds('[]', 'tang')).toEqual(defaults)
    expect(parseStoredMembersTableColumnIds('["not-a-column"]', 'tang')).toEqual(defaults)
  })

  it('keeps only allowed ids in catalog order', () => {
    expect(
      parseStoredMembersTableColumnIds(
        JSON.stringify(['cccd', 'phapDanh', 'bad', 'theDanh']),
        'tang',
      ),
    ).toEqual(['theDanh', 'phapDanh', 'cccd'])
  })
})

describe('load/saveMembersTableColumnIds', () => {
  it('persists selection per sangha', () => {
    const store: Record<string, string> = {}
    const storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
    }

    saveMembersTableColumnIds('ni', ['phapDanh', 'cccd'], storage)
    expect(store[membersTableColumnsStorageKey('ni')]).toBe(
      JSON.stringify(['phapDanh', 'cccd']),
    )
    expect(loadMembersTableColumnIds('ni', storage)).toEqual(['phapDanh', 'cccd'])
  })
})
