import { canListDirectory } from '#/domain/authz/caller'
import { canCreateRetreat, canDeleteRetreat, canUpdateRetreat } from '#/domain/authz/retreats'
import { DomainError } from '#/domain/errors'
import {
  validateRetreatFields,
  type QuyenDangKy,
  type Retreat,
  type RetreatExtraField,
  type RetreatStatus,
  type RetreatWritableFields,
} from '#/domain/retreat'
import type { DataContext } from '../context'
import {
  enumField,
  isPlainObject,
  objectField,
  optionalEnumField,
  optionalIntField,
  optionalStringField,
  stringField,
  type Body,
} from '../input'
import { eq, listPage } from '../listPage'
import { authorize, type Versioned } from '../records'
import { route, type DataRoute } from '../route'
import { retreatFromRow, retreatToRow, type RetreatRow } from '../rows/retreat'
import {
  conflictGuard,
  deleteVersionedStatement,
  insertNewStatement,
  newRecordId,
  runBatch,
  selectFirst,
  updateVersionedStatement,
} from '../sql'

// Ports of the RetreatStore methods of src/repositories/retreatRepo.ts.

const RETREAT_STATUSES: readonly RetreatStatus[] = ['draft', 'open', 'closed']
const QUYEN_DANG_KY: readonly QuyenDangKy[] = ['tu_dang_ky', 'proxy_only', 'both']
const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const MAX_EXTRA_FIELDS = 50

type StoredRetreat = { retreat: Retreat; version: number }

async function readRetreat(db: D1Database, id: string): Promise<StoredRetreat | null> {
  const row = await selectFirst<Versioned<RetreatRow>>(db, 'SELECT * FROM retreats WHERE id = ?', [id])
  return row ? { retreat: retreatFromRow(row), version: row.version } : null
}

async function requireRetreat(db: D1Database, id: string): Promise<StoredRetreat> {
  const stored = await readRetreat(db, id)
  if (!stored) throw new DomainError('NOT_FOUND', 'Retreat not found')
  return stored
}

async function writeUpdate(ctx: DataContext, before: StoredRetreat, after: Retreat): Promise<void> {
  authorize(canUpdateRetreat(ctx.caller, before.retreat, after))
  await runBatch(ctx.db, [
    updateVersionedStatement(ctx.db, 'retreats', retreatToRow(after), before.version),
    conflictGuard(ctx.db),
  ])
}

async function create(
  ctx: DataContext,
  input: { orgUnitId: string; fields: RetreatWritableFields },
): Promise<Retreat> {
  validateRetreatFields(input.fields)
  const retreat: Retreat = {
    id: newRecordId(),
    type: 'giao_doan',
    orgUnitId: input.orgUnitId,
    status: 'draft',
    // The creator is the caller, not a body field.
    createdBy: ctx.caller?.uid ?? '',
    createdAt: ctx.now,
    updatedAt: ctx.now,
    ...input.fields,
  }
  authorize(canCreateRetreat(ctx.caller, retreat))
  await runBatch(ctx.db, [insertNewStatement(ctx.db, 'retreats', retreatToRow(retreat)), conflictGuard(ctx.db)])
  return retreat
}

async function update(
  ctx: DataContext,
  input: { id: string; fields: RetreatWritableFields },
): Promise<Retreat> {
  validateRetreatFields(input.fields)
  const stored = await requireRetreat(ctx.db, input.id)
  const existing = stored.retreat
  const retreat: Retreat = {
    ...existing,
    ...input.fields,
    id: existing.id,
    type: existing.type,
    orgUnitId: existing.orgUnitId,
    status: existing.status,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: ctx.now,
  }
  await writeUpdate(ctx, stored, retreat)
  return retreat
}

/** Allowed transitions are checked by authz (draft/closed → open, open → closed). */
async function setStatus(
  ctx: DataContext,
  input: { id: string; status: RetreatStatus },
): Promise<Retreat> {
  const stored = await requireRetreat(ctx.db, input.id)
  const retreat: Retreat = { ...stored.retreat, status: input.status, updatedAt: ctx.now }
  await writeUpdate(ctx, stored, retreat)
  return retreat
}

async function deleteRetreat(ctx: DataContext, input: { id: string }): Promise<{ ok: true }> {
  const stored = await readRetreat(ctx.db, input.id)
  if (!stored) return { ok: true }
  authorize(canDeleteRetreat(ctx.caller, stored.retreat))
  await runBatch(ctx.db, [
    deleteVersionedStatement(ctx.db, 'retreats', input.id, stored.version),
    conflictGuard(ctx.db),
  ])
  return { ok: true }
}

async function getById(ctx: DataContext, input: { id: string }): Promise<Retreat | null> {
  return (await readRetreat(ctx.db, input.id))?.retreat ?? null
}

async function list(
  ctx: DataContext,
  input: { orgUnitId?: string; status?: RetreatStatus; limit: number; cursor?: string },
) {
  authorize(canListDirectory(ctx.caller, { orgUnitId: input.orgUnitId ?? null }))
  const page = await listPage<RetreatRow>(ctx.db, {
    table: 'retreats',
    filters: [eq('org_unit_id', input.orgUnitId), eq('status', input.status)],
    sortColumn: 'updated_at',
    sortDir: 'desc',
    limit: input.limit,
    cursor: input.cursor,
  })
  return { items: page.items.map(retreatFromRow), nextCursor: page.nextCursor }
}

// --- routes ---

function parseExtraFields(fields: Body): RetreatExtraField[] {
  const value = fields.extraFields
  if (!Array.isArray(value) || value.length > MAX_EXTRA_FIELDS || !value.every(isPlainObject)) {
    throw new DomainError('INVALID_INPUT', `extraFields must be a list of at most ${MAX_EXTRA_FIELDS} objects`)
  }
  return value.map((field) => {
    if (typeof field.key !== 'string' || typeof field.label !== 'string' || typeof field.required !== 'boolean') {
      throw new DomainError('INVALID_INPUT', 'extraFields items need key, label and required')
    }
    return { key: field.key, label: field.label, required: field.required }
  })
}

const TEXT_FIELDS = [
  'name',
  'diaDiem',
  'noiDung',
  'doiTuongThamDu',
  'thoiGianBatDau',
  'thoiGianKetThuc',
  'dangKyMoTu',
  'dangKyDongLuc',
] as const

/** Only the writable fields, so nothing else reaches the `data` JSON. */
function parseFields(body: Body): RetreatWritableFields {
  const fields = objectField(body, 'fields')
  const text = Object.fromEntries(
    TEXT_FIELDS.map((key) => {
      if (typeof fields[key] !== 'string') {
        throw new DomainError('INVALID_INPUT', `fields.${key} must be a string`)
      }
      return [key, fields[key]]
    }),
  ) as Record<(typeof TEXT_FIELDS)[number], string>
  return {
    ...text,
    extraFields: parseExtraFields(fields),
    quyenDangKy: enumField(fields, 'quyenDangKy', QUYEN_DANG_KY),
  }
}

export const retreatRoutes: Record<string, DataRoute> = {
  'retreats/get': route((body) => ({ id: stringField(body, 'id') }), getById),
  'retreats/list': route(
    (body) => ({
      orgUnitId: optionalStringField(body, 'orgUnitId'),
      status: optionalEnumField(body, 'status', RETREAT_STATUSES),
      limit: optionalIntField(body, 'limit', { min: 1, max: MAX_PAGE_SIZE }) ?? DEFAULT_PAGE_SIZE,
      cursor: optionalStringField(body, 'cursor'),
    }),
    list,
  ),
  'retreats/create': route(
    (body) => ({ orgUnitId: stringField(body, 'orgUnitId'), fields: parseFields(body) }),
    create,
  ),
  'retreats/update': route(
    (body) => ({ id: stringField(body, 'id'), fields: parseFields(body) }),
    update,
  ),
  'retreats/set-status': route(
    (body) => ({ id: stringField(body, 'id'), status: enumField(body, 'status', RETREAT_STATUSES) }),
    setStatus,
  ),
  'retreats/delete': route((body) => ({ id: stringField(body, 'id') }), deleteRetreat),
}
