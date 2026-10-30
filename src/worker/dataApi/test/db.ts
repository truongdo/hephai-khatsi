import { env } from 'cloudflare:workers'
import type { ColumnValue } from '../rows/rowValues'

// Children before parents, so foreign keys allow the deletes. org_units keeps
// the seed from migrations/0002.
const DATA_TABLES = [
  'retreat_registrations',
  'retreats',
  'audit_logs',
  'temple_manager_phones',
  'temples',
  'members',
  'invites',
]

/** D1 is fresh per test file, not per test: call in `beforeEach`. */
export async function clearData(): Promise<void> {
  await env.DB.batch(DATA_TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)))
}

export function insertStatement(table: string, row: Record<string, ColumnValue>): D1PreparedStatement {
  const columns = Object.keys(row)
  return env.DB.prepare(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
  ).bind(...Object.values(row))
}
