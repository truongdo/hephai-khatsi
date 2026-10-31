import type { AuditAction, AuditActor } from '#/domain/auditLog'
import { buildAuditLogWrite } from '#/domain/auditLogWrite'
import { canListDirectory } from '#/domain/authz/caller'
import { canCreateAuditLog } from '#/domain/authz/auditLogs'
import { canCreateTemple, canDeleteTemple, canUpdateTemple } from '#/domain/authz/temples'
import { DomainError } from '#/domain/errors'
import { buildTempleListSortKeys } from '#/domain/listSortKeys'
import type { Temple } from '#/domain/types'
import type { TempleAdminSortBy } from '#/repositories/adminListTypes'
import type { TempleProfilePatch } from '#/repositories/templeRepo'
import type { DataContext } from '../context'
import {
  nullableStringField,
  optionalBooleanField,
  optionalEnumField,
  optionalIntField,
  optionalStringField,
  stringArrayField,
  stringField,
  type Body,
} from '../input'
import { eq, listPage } from '../listPage'
import {
  auditLogInsert,
  authorize,
  loadInviteExists,
  loadOrgUnitName,
  type Versioned,
} from '../records'
import { route, type DataRoute } from '../route'
import {
  templeFromRow,
  templeManagerPhoneRows,
  templeToRow,
  type TempleRow,
} from '../rows/temple'
import {
  conflictGuard,
  deleteVersionedRowsStatements,
  insertNewStatement,
  insertStatement,
  newRecordId,
  runBatch,
  selectAll,
  selectByIds,
  selectFirst,
  updateVersionedStatement,
} from '../sql'
import {
  actorField,
  actorIdForPhone,
  authorizePhoneLookup,
  optionalActorField,
  isNullableString,
  isObject,
  isStringOrObject,
  patchField,
  RECORD_STATUSES,
  type PatchFieldChecks,
  SORT_DIRS,
} from './shared'

// Ports of the TempleStore methods of src/repositories/templeRepo.ts.

const TEMPLE_SORT_COLUMNS: Record<TempleAdminSortBy, string> = {
  listCityName: 'list_city_name',
  orgUnitName: 'org_unit_name',
  updatedAt: 'updated_at',
}
const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 500
const PHONE_MATCH_LIMIT = 20
const MAX_MANAGER_PHONES = 20
const MAX_IDS = 500

/** Fields the server sets: never taken from a profile patch (TempleProfilePatch). */
const PROTECTED_PATCH_FIELDS = [
  'id',
  'orgUnitId',
  'status',
  'managerPhones',
  'inviteId',
  'createdAt',
  'updatedAt',
  'lockedAt',
  'lockedBy',
  'listCityName',
  'orgUnitName',
]

const PATCH_FIELD_CHECKS: PatchFieldChecks = {
  photoPath: isNullableString,
  diaChiMoi: isStringOrObject,
  diaChiCu: isStringOrObject,
  truTriHienNay: isObject,
}

type StoredTemple = { temple: Temple; version: number }

async function readTemple(db: D1Database, id: string): Promise<StoredTemple | null> {
  const row = await selectFirst<Versioned<TempleRow>>(db, 'SELECT * FROM temples WHERE id = ?', [id])
  return row ? { temple: templeFromRow(row), version: row.version } : null
}

async function requireTemple(db: D1Database, id: string): Promise<StoredTemple> {
  const stored = await readTemple(db, id)
  if (!stored) throw new DomainError('NOT_FOUND', 'Temple not found')
  return stored
}

type TempleAudit = { action: AuditAction; actor: AuditActor }

/**
 * Creates (`before` null) or updates the temple and rebuilds its manager phone
 * rows, with its audit entry, in one batch.
 */
async function writeTemple(
  ctx: DataContext,
  before: StoredTemple | null,
  after: Temple,
  audit?: TempleAudit,
): Promise<void> {
  const { db, caller } = ctx
  const inviteExists = await loadInviteExists(db, [after.inviteId])
  authorize(
    before
      ? canUpdateTemple(caller, before.temple, after, inviteExists)
      : canCreateTemple(caller, after, inviteExists),
  )
  const row = templeToRow(after)
  const statements = [
    before
      ? updateVersionedStatement(db, 'temples', row, before.version)
      : insertNewStatement(db, 'temples', row),
    conflictGuard(db),
    db.prepare('DELETE FROM temple_manager_phones WHERE temple_id = ?').bind(after.id),
    ...templeManagerPhoneRows(after).map((phoneRow) =>
      insertStatement(db, 'temple_manager_phones', phoneRow),
    ),
  ]
  const auditWrite =
    audit && buildAuditLogWrite({ ...audit, at: ctx.now, before: before?.temple ?? null, after })
  if (auditWrite) {
    authorize(canCreateAuditLog(caller, after, auditWrite, inviteExists))
    statements.push(auditLogInsert(db, { type: 'temples', id: after.id }, auditWrite))
  }
  await runBatch(db, statements)
  ctx.search.upsertTemple(after)
}

async function updateTemple(
  ctx: DataContext,
  templeId: string,
  change: (existing: Temple) => { temple: Temple; audit?: TempleAudit } | null,
): Promise<Temple> {
  const stored = await requireTemple(ctx.db, templeId)
  const next = change(stored.temple)
  if (!next) return stored.temple
  await writeTemple(ctx, stored, next.temple, next.audit)
  return next.temple
}

// --- writes ---

type SaveInput = {
  orgUnitId: string
  inviteId: string | null
  managerPhones: string[]
  templeId?: string
  patch: TempleProfilePatch
  allowWhenLocked: boolean
  allowOrgUnitChange: boolean
  audit?: AuditActor
}

function parseSave(body: Body): SaveInput {
  return {
    orgUnitId: stringField(body, 'orgUnitId'),
    inviteId: nullableStringField(body, 'inviteId'),
    managerPhones: stringArrayField(body, 'managerPhones', MAX_MANAGER_PHONES),
    templeId: optionalStringField(body, 'templeId'),
    patch: patchField(body, PROTECTED_PATCH_FIELDS, PATCH_FIELD_CHECKS) as TempleProfilePatch,
    allowWhenLocked: optionalBooleanField(body, 'allowWhenLocked') ?? false,
    allowOrgUnitChange: optionalBooleanField(body, 'allowOrgUnitChange') ?? false,
    audit: optionalActorField(body, 'audit'),
  }
}

async function createOrUpdate(
  ctx: DataContext,
  input: SaveInput,
  lock: boolean,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
  const now = ctx.now
  const stored = input.templeId ? await requireTemple(ctx.db, input.templeId) : null
  const existing = stored?.temple ?? null
  if (existing?.status === 'locked' && !input.allowWhenLocked) {
    throw new DomainError('RECORD_LOCKED', 'Temple is locked')
  }
  if (existing && existing.orgUnitId !== input.orgUnitId && !input.allowOrgUnitChange) {
    throw new DomainError('FORBIDDEN', 'Temple does not belong to this invite org unit')
  }
  const base: Temple = existing
    ? {
        ...existing,
        ...input.patch,
        id: existing.id,
        orgUnitId: input.orgUnitId,
        status: lock ? 'locked' : existing.status === 'locked' ? 'locked' : 'draft',
        managerPhones: input.managerPhones,
        // Admin writes pass null and keep the invite the record was created under.
        inviteId: input.inviteId ?? existing.inviteId,
        photoPath:
          'photoPath' in input.patch ? (input.patch.photoPath ?? null) : (existing.photoPath ?? null),
        createdAt: existing.createdAt,
        updatedAt: now,
        lockedAt: lock ? now : existing.lockedAt,
        lockedBy: lock ? 'filler' : existing.lockedBy,
        editRequestedAt: lock ? null : existing.editRequestedAt,
        editRequestedBy: lock ? null : existing.editRequestedBy,
      }
    : {
        ...input.patch,
        id: newRecordId(),
        orgUnitId: input.orgUnitId,
        status: lock ? 'locked' : 'draft',
        managerPhones: input.managerPhones,
        inviteId: input.inviteId,
        photoPath: input.patch.photoPath ?? null,
        createdAt: now,
        updatedAt: now,
        lockedAt: lock ? now : null,
        lockedBy: lock ? 'filler' : null,
        editRequestedAt: null,
        editRequestedBy: null,
      }
  const temple: Temple = {
    ...base,
    ...buildTempleListSortKeys({
      diaChiMoi: base.diaChiMoi,
      orgUnitName: await loadOrgUnitName(ctx.db, input.orgUnitId),
    }),
  }
  const mode = existing ? 'updated' : 'created'
  await writeTemple(ctx, stored, temple, input.audit && { action: mode, actor: input.audit })
  return { temple, mode }
}

function requestEdit(ctx: DataContext, input: { templeId: string; phone: string }): Promise<Temple> {
  return updateTemple(ctx, input.templeId, (existing) => {
    if (existing.status !== 'locked') {
      throw new DomainError('INVALID_STATUS', 'Temple is not locked')
    }
    if (existing.editRequestedAt) return null
    return {
      temple: {
        ...existing,
        editRequestedAt: ctx.now,
        editRequestedBy: input.phone,
        updatedAt: ctx.now,
      },
      audit: { action: 'edit_requested', actor: { actorType: 'filler', actorId: actorIdForPhone(input.phone) } },
    }
  })
}

function lock(
  ctx: DataContext,
  input: { templeId: string; lockedBy: string; audit: AuditActor },
): Promise<Temple> {
  return updateTemple(ctx, input.templeId, (existing) => ({
    temple: {
      ...existing,
      status: 'locked',
      lockedAt: ctx.now,
      lockedBy: input.lockedBy,
      editRequestedAt: null,
      editRequestedBy: null,
      updatedAt: ctx.now,
    },
    audit: { action: 'locked', actor: input.audit },
  }))
}

function unlock(ctx: DataContext, input: { templeId: string; audit: AuditActor }): Promise<Temple> {
  return updateTemple(ctx, input.templeId, (existing) =>
    existing.status === 'draft'
      ? null
      : {
          temple: {
            ...existing,
            status: 'draft',
            lockedAt: null,
            lockedBy: null,
            editRequestedAt: null,
            editRequestedBy: null,
            updatedAt: ctx.now,
          },
          audit: { action: 'unlocked', actor: input.audit },
        },
  )
}

function setPhotoPath(
  ctx: DataContext,
  input: { templeId: string; photoPath: string | null; audit: AuditActor },
): Promise<Temple> {
  return updateTemple(ctx, input.templeId, (existing) => ({
    temple: { ...existing, photoPath: input.photoPath, updatedAt: ctx.now },
    audit: {
      action: input.photoPath !== null ? 'photo_uploaded' : 'photo_deleted',
      actor: input.audit,
    },
  }))
}

async function deleteMany(ctx: DataContext, input: { ids: string[] }): Promise<{ ok: true }> {
  const { db, caller } = ctx
  const rows = await selectByIds<Versioned<TempleRow>>(db, 'temples', input.ids)
  for (const row of rows) authorize(canDeleteTemple(caller, templeFromRow(row)))
  // Manager phone rows go with their temple (ON DELETE CASCADE).
  await runBatch(
    db,
    deleteVersionedRowsStatements(db, 'temples', rows),
  )
  for (const row of rows) ctx.search.deleteTemple(row.id)
  return { ok: true }
}

// --- reads ---

async function getById(ctx: DataContext, input: { id: string }): Promise<Temple | null> {
  return (await readTemple(ctx.db, input.id))?.temple ?? null
}

/** The filler "resume by phone" lookup: needs an invite, or a directory writer. */
async function listByPhone(
  ctx: DataContext,
  input: { orgUnitId: string; phone: string; inviteToken?: string },
): Promise<Temple[]> {
  await authorizePhoneLookup(ctx, input.orgUnitId, input.inviteToken)
  const rows = await selectAll<TempleRow>(
    ctx.db,
    `SELECT temples.* FROM temple_manager_phones AS phones
       JOIN temples ON temples.id = phones.temple_id
     WHERE phones.org_unit_id = ? AND phones.phone = ?
     ORDER BY temples.id LIMIT ?`,
    [input.orgUnitId, input.phone, PHONE_MATCH_LIMIT],
  )
  return rows.map(templeFromRow)
}

async function list(
  ctx: DataContext,
  input: {
    orgUnitId?: string
    status?: Temple['status']
    limit: number
    cursor?: string
    sortBy: TempleAdminSortBy
    sortDir: 'asc' | 'desc'
  },
) {
  authorize(canListDirectory(ctx.caller, { orgUnitId: input.orgUnitId ?? null }))
  const page = await listPage<TempleRow>(ctx.db, {
    table: 'temples',
    filters: [eq('org_unit_id', input.orgUnitId), eq('status', input.status)],
    sortColumn: TEMPLE_SORT_COLUMNS[input.sortBy],
    sortDir: input.sortDir,
    limit: input.limit,
    cursor: input.cursor,
  })
  return { items: page.items.map(templeFromRow), nextCursor: page.nextCursor }
}

// --- routes ---

export const templeRoutes: Record<string, DataRoute> = {
  'temples/get': route((body) => ({ id: stringField(body, 'id') }), getById),
  'temples/list-by-phone': route(
    (body) => ({
      orgUnitId: stringField(body, 'orgUnitId'),
      phone: stringField(body, 'phone'),
      inviteToken: optionalStringField(body, 'inviteToken'),
    }),
    listByPhone,
  ),
  'temples/list': route(
    (body) => ({
      orgUnitId: optionalStringField(body, 'orgUnitId'),
      status: optionalEnumField(body, 'status', RECORD_STATUSES),
      limit: optionalIntField(body, 'limit', { min: 1, max: MAX_PAGE_SIZE }) ?? DEFAULT_PAGE_SIZE,
      cursor: optionalStringField(body, 'cursor'),
      sortBy:
        optionalEnumField(body, 'sortBy', Object.keys(TEMPLE_SORT_COLUMNS) as TempleAdminSortBy[]) ??
        'updatedAt',
      sortDir: optionalEnumField(body, 'sortDir', SORT_DIRS) ?? 'desc',
    }),
    list,
  ),
  'temples/save-draft': route(parseSave, (ctx, input) => createOrUpdate(ctx, input, false)),
  'temples/save-and-lock': route(
    (body) => ({ ...parseSave(body), audit: actorField(body, 'audit') }),
    (ctx, input) => createOrUpdate(ctx, input, true),
  ),
  'temples/request-edit': route(
    (body) => ({ templeId: stringField(body, 'templeId'), phone: stringField(body, 'phone') }),
    requestEdit,
  ),
  'temples/lock': route(
    (body) => ({
      templeId: stringField(body, 'templeId'),
      lockedBy: stringField(body, 'lockedBy'),
      audit: actorField(body, 'audit'),
    }),
    lock,
  ),
  'temples/unlock': route(
    (body) => ({ templeId: stringField(body, 'templeId'), audit: actorField(body, 'audit') }),
    unlock,
  ),
  'temples/set-photo': route(
    (body) => ({
      templeId: stringField(body, 'templeId'),
      photoPath: nullableStringField(body, 'photoPath'),
      audit: actorField(body, 'audit'),
    }),
    setPhotoPath,
  ),
  'temples/delete-many': route(
    (body) => ({ ids: stringArrayField(body, 'ids', MAX_IDS) }),
    deleteMany,
  ),
}
