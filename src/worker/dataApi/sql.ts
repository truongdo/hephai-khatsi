import { DomainError } from '#/domain/errors'
import type { ColumnValue } from './rows/rowValues'

// D1 has no interactive transactions: handlers read, compute the new rows,
// then write everything in one atomic `db.batch`. The main row's write is
// guarded (`version` match on update, no existing row on insert) and followed
// by `conflictGuard`, which aborts the batch when that write changed nothing.

export type Row = Record<string, ColumnValue>

/** D1 binds at most 100 parameters per statement. */
export const MAX_BOUND_PARAMS = 100

export function insertStatement(db: D1Database, table: string, row: Row): D1PreparedStatement {
  const columns = Object.keys(row)
  return db
    .prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    )
    .bind(...Object.values(row))
}

/** Insert that changes nothing when the id exists (follow with `conflictGuard`). */
export function insertNewStatement(db: D1Database, table: string, row: Row): D1PreparedStatement {
  const columns = Object.keys(row)
  return db
    .prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`,
    )
    .bind(...Object.values(row))
}

/** Replaces every column of the row if its version is still `version`, and bumps it. */
export function updateVersionedStatement(
  db: D1Database,
  table: string,
  row: Row & { id: string },
  version: number,
): D1PreparedStatement {
  const { id, ...columns } = row
  const assignments = Object.keys(columns).map((column) => `${column} = ?`)
  return db
    .prepare(
      `UPDATE ${table} SET ${assignments.join(', ')}, version = version + 1 WHERE id = ? AND version = ?`,
    )
    .bind(...Object.values(columns), id, version)
}

export function deleteVersionedStatement(
  db: D1Database,
  table: string,
  id: string,
  version: number,
): D1PreparedStatement {
  return db.prepare(`DELETE FROM ${table} WHERE id = ? AND version = ?`).bind(id, version)
}

/**
 * Aborts the batch unless the statement before it changed `expected` rows
 * (see migrations/0003).
 */
export function conflictGuard(db: D1Database, expected = 1): D1PreparedStatement {
  return db.prepare('INSERT INTO write_conflicts SELECT 1 WHERE changes() <> ?').bind(expected)
}

export type VersionedId = { id: string; version: number }

/** Rows per set-based write: two bound parameters each, under the limit with room for SET values. */
export const VERSIONED_IDS_PER_STATEMENT = 45

/** `WHERE (id, version) IN (...)` for up to VERSIONED_IDS_PER_STATEMENT rows. */
function versionedIdsFilter(rows: readonly VersionedId[]): { sql: string; params: Array<string | number> } {
  return {
    sql: `(id, version) IN (VALUES ${rows.map(() => '(?, ?)').join(', ')})`,
    params: rows.flatMap((row) => [row.id, row.version]),
  }
}

/**
 * Deletes rows still at their read version, one statement and guard per chunk
 * (D1 caps the queries of one Worker invocation).
 */
export function deleteVersionedRowsStatements(
  db: D1Database,
  table: string,
  rows: readonly VersionedId[],
): D1PreparedStatement[] {
  return chunk(rows, VERSIONED_IDS_PER_STATEMENT).flatMap((rowChunk) => {
    const filter = versionedIdsFilter(rowChunk)
    return [
      db.prepare(`DELETE FROM ${table} WHERE ${filter.sql}`).bind(...filter.params),
      conflictGuard(db, rowChunk.length),
    ]
  })
}

/** Sets the same column values on rows still at their read version (and bumps them), per chunk. */
export function updateVersionedRowsStatements(
  db: D1Database,
  table: string,
  values: Row,
  rows: readonly VersionedId[],
): D1PreparedStatement[] {
  const assignments = Object.keys(values).map((column) => `${column} = ?`)
  return chunk(rows, VERSIONED_IDS_PER_STATEMENT).flatMap((rowChunk) => {
    const filter = versionedIdsFilter(rowChunk)
    return [
      db
        .prepare(`UPDATE ${table} SET ${assignments.join(', ')}, version = version + 1 WHERE ${filter.sql}`)
        .bind(...Object.values(values), ...filter.params),
      conflictGuard(db, rowChunk.length),
    ]
  })
}

const CONFLICT_MESSAGE = 'WRITE_CONFLICT'

/** Runs the batch; a guarded write that lost a race becomes CONFLICT (409). */
export async function runBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  if (statements.length === 0) return
  try {
    await db.batch(statements)
  } catch (error) {
    if (error instanceof Error && error.message.includes(CONFLICT_MESSAGE)) {
      throw new DomainError('CONFLICT', 'The record was changed by someone else; try again')
    }
    throw error
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

export async function selectAll<T>(
  db: D1Database,
  sql: string,
  params: ColumnValue[] = [],
): Promise<T[]> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<T>()
  return results
}

export async function selectFirst<T>(
  db: D1Database,
  sql: string,
  params: ColumnValue[] = [],
): Promise<T | null> {
  return db
    .prepare(sql)
    .bind(...params)
    .first<T>()
}

/** Rows by id, chunked under the bound-parameter limit; order not kept. */
export async function selectByIds<T>(db: D1Database, table: string, ids: readonly string[]): Promise<T[]> {
  const rows: T[] = []
  for (const idChunk of chunk([...new Set(ids)], MAX_BOUND_PARAMS)) {
    rows.push(
      ...(await selectAll<T>(
        db,
        `SELECT * FROM ${table} WHERE id IN (${placeholders(idChunk.length)})`,
        idChunk,
      )),
    )
  }
  return rows
}

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** A random 20-character id, the shape of Firestore auto ids (temples, retreats, audit logs). */
export function newRecordId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}
