import type { AuditLogWrite } from '#/domain/auditLog'
import type { InviteExists } from '#/domain/authz/caller'
import type { RecordFiles } from './context'
import { DomainError } from '#/domain/errors'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import { auditLogToRow, type AuditLogParent } from './rows/auditLog'
import { insertStatement, newRecordId, placeholders, selectAll, selectFirst } from './sql'

// Helpers shared by the write handlers.

/** A row as read for a write: `version` is the optimistic-lock guard. */
export type Versioned<R> = R & { version: number }

/** Throws FORBIDDEN (403) unless an authz check passed. */
export function authorize(allowed: boolean): void {
  if (!allowed) throw new DomainError('FORBIDDEN', 'Not allowed')
}

/** Denormalized into members / temples for sorting (same fallback as the Firestore repos). */
export async function loadOrgUnitName(db: D1Database, orgUnitId: string): Promise<string> {
  const row = await selectFirst<{ name: string }>(db, 'SELECT name FROM org_units WHERE id = ?', [
    orgUnitId,
  ])
  if (row) return row.name
  return ORG_UNIT_SEED.find((unit) => unit.id === orgUnitId)?.name ?? orgUnitId
}

/** The authz `inviteExists` for the invite ids a write names. */
export async function loadInviteExists(
  db: D1Database,
  ids: ReadonlyArray<string | null | undefined>,
): Promise<InviteExists> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === 'string'))]
  if (wanted.length === 0) return () => false
  const rows = await selectAll<{ id: string }>(
    db,
    `SELECT id FROM invites WHERE id IN (${placeholders(wanted.length)})`,
    wanted,
  )
  const found = new Set(rows.map((row) => row.id))
  return (id) => found.has(id)
}

/**
 * The files a write adds to a record must be its own keys (`foreign` lists
 * the others) and already uploaded: a write that drops files deletes them,
 * so a record never takes another record's file or a missing one.
 */
export async function requireOwnUploadedFiles(
  files: RecordFiles,
  foreign: readonly string[],
  added: readonly string[],
): Promise<void> {
  if (foreign.length > 0) {
    throw new DomainError('INVALID_INPUT', 'File path does not belong to this record')
  }
  const found = await Promise.all(added.map((path) => files.exists(path)))
  if (found.includes(false)) throw new DomainError('INVALID_INPUT', 'File was not uploaded')
}

export function auditLogInsert(
  db: D1Database,
  parent: AuditLogParent,
  write: AuditLogWrite,
): D1PreparedStatement {
  return insertStatement(db, 'audit_logs', auditLogToRow(parent, { id: newRecordId(), ...write }))
}
