import { DomainError } from '#/domain/errors'
import type { AdminListPage, AdminSortDir } from '#/repositories/adminListTypes'
import type { ColumnValue } from './rows/rowValues'
import { selectAll } from './sql'

// Keyset pagination: the cursor is the (sort value, id) of the last row of the
// previous page, so pages stay stable while rows are added or edited. It is
// opaque to the client, which only passes `nextCursor` back.

type CursorKey = [ColumnValue, string]

export function encodeCursor(key: CursorKey): string {
  return btoa(encodeURIComponent(JSON.stringify(key)))
}

export function decodeCursor(cursor: string): CursorKey {
  let key: unknown
  try {
    key = JSON.parse(decodeURIComponent(atob(cursor)))
  } catch {
    throw new DomainError('INVALID_INPUT', 'cursor is invalid')
  }
  if (
    !Array.isArray(key) ||
    key.length !== 2 ||
    !['string', 'number'].includes(typeof key[0]) ||
    typeof key[1] !== 'string'
  ) {
    throw new DomainError('INVALID_INPUT', 'cursor is invalid')
  }
  return key as CursorKey
}

export type Filter = { sql: string; params: ColumnValue[] }

export function eq(column: string, value: ColumnValue | undefined): Filter | null {
  return value === undefined ? null : { sql: `${column} = ?`, params: [value] }
}

export type ListPageQuery = {
  table: string
  filters: Array<Filter | null>
  sortColumn: string
  sortDir: AdminSortDir
  limit: number
  cursor?: string
}

/**
 * One page ordered by `sortColumn` then id, both in `sortDir`. Rows whose sort
 * column is NULL are left out (a Firestore orderBy skips documents missing the
 * field). `nextCursor` is set when the page is full, like the Firestore repos.
 */
export async function listPage<R extends { id: string }>(
  db: D1Database,
  query: ListPageQuery,
): Promise<AdminListPage<R>> {
  const filters = query.filters.filter((filter): filter is Filter => filter !== null)
  filters.push({ sql: `${query.sortColumn} IS NOT NULL`, params: [] })
  const dir = query.sortDir === 'asc' ? 'ASC' : 'DESC'
  if (query.cursor) {
    filters.push({
      sql: `(${query.sortColumn}, id) ${dir === 'ASC' ? '>' : '<'} (?, ?)`,
      params: decodeCursor(query.cursor),
    })
  }
  const rows = await selectAll<R>(
    db,
    `SELECT * FROM ${query.table} WHERE ${filters.map((f) => f.sql).join(' AND ')} ` +
      `ORDER BY ${query.sortColumn} ${dir}, id ${dir} LIMIT ?`,
    [...filters.flatMap((f) => f.params), query.limit],
  )
  const last = rows[rows.length - 1]
  const nextCursor =
    rows.length === query.limit && last
      ? encodeCursor([(last as unknown as Record<string, ColumnValue>)[query.sortColumn]!, last.id])
      : null
  return { items: rows, nextCursor }
}
