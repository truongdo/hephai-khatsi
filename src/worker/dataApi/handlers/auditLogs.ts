import type { AuditLogEntry } from '#/domain/auditLog'
import { canListDirectory, directoryOrgOk } from '#/domain/authz/caller'
import { canReadAuditLogs } from '#/domain/authz/auditLogs'
import type { DataContext } from '../context'
import { enumField, optionalIntField, optionalStringField, stringField } from '../input'
import { authorize } from '../records'
import { route, type DataRoute } from '../route'
import { auditLogFromRow, type AuditLogParent, type AuditLogRow } from '../rows/auditLog'
import { selectAll, selectFirst } from '../sql'

// Port of listAuditLogs (src/repositories/auditLogRepo.ts). Entries are only
// written by the member / temple write handlers.

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

/**
 * Directory writers of the record's org unit (the rules let any directory
 * writer read every history); history of a deleted record is hệ phái only.
 */
async function authorizeRead(ctx: DataContext, parent: AuditLogParent): Promise<void> {
  authorize(canReadAuditLogs(ctx.caller))
  const record = await selectFirst<{ org_unit_id: string }>(
    ctx.db,
    `SELECT org_unit_id FROM ${parent.type} WHERE id = ?`,
    [parent.id],
  )
  authorize(
    record
      ? directoryOrgOk(ctx.caller, record.org_unit_id)
      : canListDirectory(ctx.caller, { orgUnitId: null }),
  )
}

async function list(
  ctx: DataContext,
  input: { parent: AuditLogParent; limit: number; startAfterAt?: string },
): Promise<{ entries: AuditLogEntry[]; nextStartAfterAt: string | null }> {
  await authorizeRead(ctx, input.parent)
  const rows = await selectAll<AuditLogRow>(
    ctx.db,
    `SELECT * FROM audit_logs WHERE parent_type = ? AND parent_id = ?${
      input.startAfterAt ? ' AND at < ?' : ''
    } ORDER BY at DESC LIMIT ?`,
    input.startAfterAt
      ? [input.parent.type, input.parent.id, input.startAfterAt, input.limit]
      : [input.parent.type, input.parent.id, input.limit],
  )
  const entries = rows.map(auditLogFromRow)
  return {
    entries,
    nextStartAfterAt: entries.length === input.limit ? entries[entries.length - 1]!.at : null,
  }
}

export const auditLogRoutes: Record<string, DataRoute> = {
  'audit-logs/list': route(
    (body) => ({
      parent: {
        type: enumField(body, 'parentType', ['members', 'temples'] as const),
        id: stringField(body, 'parentId'),
      },
      limit: optionalIntField(body, 'limit', { min: 1, max: MAX_PAGE_SIZE }) ?? DEFAULT_PAGE_SIZE,
      startAfterAt: optionalStringField(body, 'startAfterAt'),
    }),
    list,
  ),
}
