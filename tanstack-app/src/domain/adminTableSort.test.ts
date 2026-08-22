import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_TABLE_SORT,
  nextAdminTableSort,
} from './adminTableSort'

describe('nextAdminTableSort', () => {
  it('from default, clicking another column goes asc', () => {
    expect(nextAdminTableSort(DEFAULT_ADMIN_TABLE_SORT, 'orgUnitName')).toEqual({
      sortBy: 'orgUnitName',
      sortDir: 'asc',
    })
  })

  it('toggles asc → desc → default on same column', () => {
    const asc = { sortBy: 'orgUnitName' as const, sortDir: 'asc' as const }
    const desc = nextAdminTableSort(asc, 'orgUnitName')
    expect(desc).toEqual({ sortBy: 'orgUnitName', sortDir: 'desc' })
    expect(nextAdminTableSort(desc, 'orgUnitName')).toEqual(DEFAULT_ADMIN_TABLE_SORT)
  })

  it('from default updatedAt desc, clicking updatedAt goes asc', () => {
    expect(nextAdminTableSort(DEFAULT_ADMIN_TABLE_SORT, 'updatedAt')).toEqual({
      sortBy: 'updatedAt',
      sortDir: 'asc',
    })
  })
})
