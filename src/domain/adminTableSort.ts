export type AdminTableSortState<T extends string> = {
  sortBy: T
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_ADMIN_TABLE_SORT = {
  sortBy: 'updatedAt',
  sortDir: 'desc',
} as const

function isSameSort<T extends string>(
  a: AdminTableSortState<T>,
  b: AdminTableSortState<T>,
): boolean {
  return a.sortBy === b.sortBy && a.sortDir === b.sortDir
}

/** Click cycle: other column → asc; same asc → desc; same desc → default. */
export function nextAdminTableSort<T extends string>(
  current: AdminTableSortState<T>,
  column: T,
  defaultSort: AdminTableSortState<T> = DEFAULT_ADMIN_TABLE_SORT as AdminTableSortState<T>,
): AdminTableSortState<T> {
  if (isSameSort(current, defaultSort) && column === defaultSort.sortBy) {
    return { sortBy: column, sortDir: 'asc' }
  }

  if (column !== current.sortBy) {
    return { sortBy: column, sortDir: 'asc' }
  }

  if (current.sortDir === 'asc') {
    return { sortBy: column, sortDir: 'desc' }
  }

  return defaultSort
}
