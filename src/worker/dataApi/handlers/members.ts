import type { AuditAction, AuditActor } from '#/domain/auditLog'
import { buildAuditLogWrite } from '#/domain/auditLogWrite'
import { canListDirectory, type Caller } from '#/domain/authz/caller'
import { canCreateAuditLog } from '#/domain/authz/auditLogs'
import { canCreateMember, canDeleteMember, canUpdateMember } from '#/domain/authz/members'
import { DATA_API_MAX_IDS as MAX_IDS, DATA_API_MAX_PAGE_SIZE as MAX_PAGE_SIZE } from '#/domain/dataApiLimits'
import { DomainError } from '#/domain/errors'
import { buildMemberDerivedSortFields } from '#/domain/listSortKeys'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import {
  MEMBER_DOCUMENT_TYPES,
  getDocumentType,
  isValidDocumentSide,
  mergeDocumentPath,
  pathFieldForSide,
  pathsFromTypeFiles,
  removeDocumentSide,
  removeDocumentType,
  type DocumentSide,
  type DocumentTypeId,
  type MemberDocuments,
} from '#/domain/memberDocumentTypes'
import { MEMBER_TINH_TRANG_VALUES } from '#/domain/memberTinhTrang'
import type { Member, SanghaType } from '#/domain/types'
import type { MemberAdminSortBy } from '#/repositories/adminListTypes'
import type { MemberProfilePatch } from '#/repositories/memberRepo'
import type { DataContext } from '../context'
import {
  enumField,
  nullableStringField,
  objectField,
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
import { memberFromRow, memberToRow, type MemberRow } from '../rows/member'
import {
  MAX_BOUND_PARAMS,
  chunk,
  conflictGuard,
  deleteVersionedRowsStatements,
  deleteVersionedStatement,
  insertNewStatement,
  placeholders,
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
  directoryListScope,
  optionalActorField,
  isNullableString,
  isObject,
  isRankRecord,
  isString,
  patchField,
  RECORD_STATUSES,
  type PatchFieldChecks,
  SORT_DIRS,
} from './shared'

// Ports of the MemberStore methods of src/repositories/memberRepo.ts; each
// write keeps the same rules and returns what the store method returns.

const SANGHA_TYPES: readonly SanghaType[] = ['tang', 'ni']
const MEMBER_SORT_COLUMNS: Record<MemberAdminSortBy, string> = {
  giaoPhamHePhaiRankOrder: 'giao_pham_he_phai_rank_order',
  orgUnitName: 'org_unit_name',
  status: 'status',
  updatedAt: 'updated_at',
}
const DEFAULT_PAGE_SIZE = 25
/** At most this many members share a phone in one lookup. */
const PHONE_MATCH_LIMIT = 20
const SECRETARIES_LIMIT = 200

/** Fields the server sets: never taken from a profile patch (MemberProfilePatch). */
const PROTECTED_PATCH_FIELDS = [
  'id',
  'orgUnitId',
  'sanghaType',
  'status',
  'cccd',
  'inviteId',
  'createdAt',
  'updatedAt',
  'lockedAt',
  'lockedBy',
  'orgUnitName',
  'giaoPhamHePhaiRankOrder',
  'sapXepHaLap',
  'haLapTabRank',
  'tinhTrang',
  'editRequestedAt',
  'editRequestedBy',
  // Granted only by the directory-role route.
  'directoryRole',
  'directoryAuthUid',
  'directoryRoleGrantedAt',
  'directoryRoleGrantedBy',
]

const PATCH_FIELD_CHECKS: PatchFieldChecks = {
  dienThoai: isString,
  email: isString,
  currentTempleId: isNullableString,
  photoPath: isNullableString,
  documents: isObject,
  giaoPhamHePhai: isRankRecord,
  giaoPhamGiaoHoi: isRankRecord,
  gioiSaDi: isObject,
  gioiSaDiNi: isObject,
  gioiThucXoaMaNa: isObject,
  gioiTyKheo: isObject,
  gioiTyKheoNi: isObject,
}

type StoredMember = { member: Member; version: number }

async function readMember(db: D1Database, id: string): Promise<StoredMember | null> {
  const row = await selectFirst<Versioned<MemberRow>>(db, 'SELECT * FROM members WHERE id = ?', [id])
  return row ? { member: memberFromRow(row), version: row.version } : null
}

async function requireMember(db: D1Database, id: string): Promise<StoredMember> {
  const stored = await readMember(db, id)
  if (!stored) throw new DomainError('NOT_FOUND', 'Member not found')
  return stored
}

function withSortKeys(member: Member, orgUnitName: string): Member {
  return { ...member, ...buildMemberDerivedSortFields(member, orgUnitName) }
}

type MemberAudit = { action: AuditAction; actor: AuditActor }

/**
 * Creates (`before` null) or updates the member after the authz checks the
 * rules made on the same write, with its audit entry in the same batch.
 */
async function writeMember(
  ctx: DataContext,
  before: StoredMember | null,
  after: Member,
  audit?: MemberAudit,
): Promise<void> {
  const { db, caller } = ctx
  const inviteExists = await loadInviteExists(db, [after.inviteId])
  authorize(
    before
      ? canUpdateMember(caller, before.member, after, inviteExists)
      : canCreateMember(caller, after, inviteExists),
  )
  const row = memberToRow(after)
  const statements = [
    before
      ? updateVersionedStatement(db, 'members', row, before.version)
      : insertNewStatement(db, 'members', row),
    conflictGuard(db),
  ]
  const auditWrite =
    audit && buildAuditLogWrite({ ...audit, at: ctx.now, before: before?.member ?? null, after })
  if (auditWrite) {
    authorize(canCreateAuditLog(caller, after, auditWrite, inviteExists))
    statements.push(auditLogInsert(db, { type: 'members', id: after.id }, auditWrite))
  }
  await runBatch(db, statements)
  ctx.search.upsertMember(after)
}

/** Loads the member, applies `change`, writes it; `change` returning null leaves it as is. */
async function updateMember(
  ctx: DataContext,
  memberId: string,
  change: (existing: Member) => { member: Member; audit?: MemberAudit } | null,
): Promise<Member> {
  const stored = await requireMember(ctx.db, memberId)
  const next = change(stored.member)
  if (!next) return stored.member
  await writeMember(ctx, stored, next.member, next.audit)
  return next.member
}

// --- writes ---

type SaveInput = {
  orgUnitId: string
  sanghaType: SanghaType
  inviteId: string | null
  cccd: string
  patch: MemberProfilePatch
  audit?: AuditActor
}

function parseSave(body: Body): SaveInput {
  return {
    orgUnitId: stringField(body, 'orgUnitId'),
    sanghaType: enumField(body, 'sanghaType', SANGHA_TYPES),
    inviteId: nullableStringField(body, 'inviteId'),
    cccd: stringField(body, 'cccd'),
    patch: patchField(body, PROTECTED_PATCH_FIELDS, PATCH_FIELD_CHECKS) as MemberProfilePatch,
    audit: optionalActorField(body, 'audit'),
  }
}

async function createOrUpdate(
  ctx: DataContext,
  input: SaveInput,
  lock: boolean,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  const memberId = memberCccdIndexId(input.orgUnitId, input.sanghaType, input.cccd)
  const [stored, orgUnitName] = await Promise.all([
    readMember(ctx.db, memberId),
    loadOrgUnitName(ctx.db, input.orgUnitId),
  ])
  const now = ctx.now
  let member: Member
  if (stored) {
    const existing = stored.member
    if (existing.status === 'locked') throw new DomainError('RECORD_LOCKED', 'Member is locked')
    member = {
      ...existing,
      ...input.patch,
      id: existing.id,
      orgUnitId: existing.orgUnitId,
      sanghaType: existing.sanghaType,
      status: lock ? 'locked' : existing.status,
      cccd: existing.cccd,
      // Re-validated per the current invite token (authz checks it exists).
      inviteId: input.inviteId,
      createdAt: existing.createdAt,
      lockedAt: lock ? now : existing.lockedAt,
      lockedBy: lock ? 'filler' : existing.lockedBy,
      editRequestedAt: lock ? null : existing.editRequestedAt,
      editRequestedBy: lock ? null : existing.editRequestedBy,
      updatedAt: now,
    }
  } else {
    member = {
      currentTempleId: null,
      photoPath: null,
      ...input.patch,
      id: memberId,
      orgUnitId: input.orgUnitId,
      sanghaType: input.sanghaType,
      status: lock ? 'locked' : 'draft',
      cccd: input.cccd,
      inviteId: input.inviteId,
      createdAt: now,
      updatedAt: now,
      lockedAt: lock ? now : null,
      lockedBy: lock ? 'filler' : null,
      editRequestedAt: null,
      editRequestedBy: null,
    }
  }
  member = withSortKeys(member, orgUnitName)
  const mode = stored ? 'updated' : 'created'
  await writeMember(ctx, stored, member, input.audit && { action: mode, actor: input.audit })
  return { member, mode }
}

type UpdateByIdInput = {
  memberId: string
  patch: MemberProfilePatch
  allowWhenLocked: boolean
  allowOrgUnitChange: boolean
  orgUnitId?: string
  audit?: AuditActor
}

/** `updateDraftById`; a new org unit gives the member a new id (delete + create). */
async function updateById(ctx: DataContext, input: UpdateByIdInput): Promise<Member> {
  const { db, caller } = ctx
  const stored = await requireMember(db, input.memberId)
  const existing = stored.member
  if (existing.status === 'locked' && !input.allowWhenLocked) {
    throw new DomainError('RECORD_LOCKED', 'Member is locked')
  }
  const nextOrgUnitId = input.orgUnitId ?? existing.orgUnitId
  const orgChanged = nextOrgUnitId !== existing.orgUnitId
  if (orgChanged && !input.allowOrgUnitChange) {
    throw new DomainError('FORBIDDEN', 'Cannot change member org unit')
  }
  const nextId = orgChanged
    ? memberCccdIndexId(nextOrgUnitId, existing.sanghaType, existing.cccd)
    : existing.id
  if (orgChanged && (await readMember(db, nextId))) {
    throw new DomainError(
      'ALREADY_EXISTS',
      'A member with this CCCD already exists in the target org unit',
    )
  }
  const member = withSortKeys(
    {
      ...existing,
      ...input.patch,
      id: nextId,
      orgUnitId: nextOrgUnitId,
      sanghaType: existing.sanghaType,
      status: existing.status,
      cccd: existing.cccd,
      inviteId: existing.inviteId,
      createdAt: existing.createdAt,
      lockedAt: existing.lockedAt,
      lockedBy: existing.lockedBy,
      editRequestedAt: existing.editRequestedAt,
      editRequestedBy: existing.editRequestedBy,
      updatedAt: ctx.now,
    },
    await loadOrgUnitName(db, nextOrgUnitId),
  )
  const audit = input.audit && { action: 'updated' as const, actor: input.audit }
  if (!orgChanged) {
    await writeMember(ctx, stored, member, audit)
    return member
  }

  // Moving is a delete plus a create for the rules; the audit history moves
  // with the member.
  const inviteExists = await loadInviteExists(db, [member.inviteId])
  authorize(canDeleteMember(caller, existing) && canCreateMember(caller, member, inviteExists))
  const statements = [
    deleteVersionedStatement(db, 'members', existing.id, stored.version),
    conflictGuard(db),
    insertNewStatement(db, 'members', memberToRow(member)),
    conflictGuard(db),
    db
      .prepare(
        "UPDATE OR REPLACE audit_logs SET parent_id = ? WHERE parent_type = 'members' AND parent_id = ?",
      )
      .bind(nextId, existing.id),
  ]
  const auditWrite = audit && buildAuditLogWrite({ ...audit, at: ctx.now, before: existing, after: member })
  if (auditWrite) {
    authorize(canCreateAuditLog(caller, member, auditWrite, inviteExists))
    statements.push(auditLogInsert(db, { type: 'members', id: nextId }, auditWrite))
  }
  await runBatch(db, statements)
  ctx.search.deleteMember(existing.id)
  ctx.search.upsertMember(member)
  return member
}

function requestEdit(ctx: DataContext, input: { memberId: string; phone: string }): Promise<Member> {
  return updateMember(ctx, input.memberId, (existing) => {
    if (existing.status !== 'locked') {
      throw new DomainError('INVALID_STATUS', 'Member is not locked')
    }
    if (existing.editRequestedAt) return null
    return {
      member: {
        ...existing,
        editRequestedAt: ctx.now,
        editRequestedBy: input.phone,
        updatedAt: ctx.now,
      },
      audit: {
        action: 'edit_requested',
        actor: { actorType: 'filler', actorId: actorIdForPhone(input.phone) },
      },
    }
  })
}

function lock(
  ctx: DataContext,
  input: { memberId: string; lockedBy: string; audit: AuditActor },
): Promise<Member> {
  return updateMember(ctx, input.memberId, (existing) => ({
    member: {
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

function unlock(ctx: DataContext, input: { memberId: string; audit: AuditActor }): Promise<Member> {
  return updateMember(ctx, input.memberId, (existing) =>
    existing.status === 'draft'
      ? null
      : {
          member: {
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
  input: { memberId: string; photoPath: string | null; audit: AuditActor },
): Promise<Member> {
  return updateMember(ctx, input.memberId, (existing) => ({
    member: { ...existing, photoPath: input.photoPath, updatedAt: ctx.now },
    audit: {
      action: input.photoPath !== null ? 'photo_uploaded' : 'photo_deleted',
      actor: input.audit,
    },
  }))
}

function setDocumentPaths(
  ctx: DataContext,
  input: { memberId: string; documents: MemberDocuments },
): Promise<Member> {
  return updateMember(ctx, input.memberId, (existing) => ({
    member: { ...existing, documents: input.documents, updatedAt: ctx.now },
  }))
}

// Allowed on locked records too: it is an admin-maintained field outside the form.
function setTinhTrang(
  ctx: DataContext,
  input: { memberId: string; tinhTrang: Member['tinhTrang']; audit: AuditActor },
): Promise<Member> {
  return updateMember(ctx, input.memberId, (existing) =>
    (existing.tinhTrang ?? null) === input.tinhTrang
      ? null
      : {
          member: { ...existing, tinhTrang: input.tinhTrang, updatedAt: ctx.now },
          audit: { action: 'updated', actor: input.audit },
        },
  )
}

type DocumentRef = { memberId: string; typeId: DocumentTypeId; audit: AuditActor }

async function mergeDocumentSide(
  ctx: DataContext,
  input: DocumentRef & { side: DocumentSide; filePath: string },
): Promise<{ member: Member; previousPath?: string }> {
  let previousPath: string | undefined
  const member = await updateMember(ctx, input.memberId, (existing) => {
    const current = existing.documents ?? {}
    previousPath = current[input.typeId]?.[pathFieldForSide(input.side)]
    return {
      member: {
        ...existing,
        documents: mergeDocumentPath(current, input.typeId, input.side, input.filePath),
        updatedAt: ctx.now,
      },
      audit: { action: 'document_uploaded', actor: input.audit },
    }
  })
  return previousPath === undefined ? { member } : { member, previousPath }
}

async function removeDocumentPaths(
  ctx: DataContext,
  input: DocumentRef & { side?: DocumentSide },
): Promise<{ member: Member; removedPaths: string[] }> {
  let removedPaths: string[] = []
  const member = await updateMember(ctx, input.memberId, (existing) => {
    const current = existing.documents ?? {}
    const typeFiles = current[input.typeId]
    if (input.side) {
      const path = typeFiles?.[pathFieldForSide(input.side)]
      removedPaths = path ? [path] : []
    } else {
      removedPaths = typeFiles ? pathsFromTypeFiles(typeFiles) : []
    }
    return {
      member: {
        ...existing,
        documents: input.side
          ? removeDocumentSide(current, input.typeId, input.side)
          : removeDocumentType(current, input.typeId),
        updatedAt: ctx.now,
      },
      audit: { action: 'document_deleted', actor: input.audit },
    }
  })
  return { member, removedPaths }
}

async function deleteMany(ctx: DataContext, input: { ids: string[] }): Promise<{ ok: true }> {
  const { db, caller } = ctx
  const rows = await selectByIds<Versioned<MemberRow>>(db, 'members', input.ids)
  for (const row of rows) authorize(canDeleteMember(caller, memberFromRow(row)))
  await runBatch(
    db,
    deleteVersionedRowsStatements(db, 'members', rows),
  )
  for (const row of rows) ctx.search.deleteMember(row.id)
  return { ok: true }
}

// --- reads ---

async function getById(ctx: DataContext, input: { id: string }): Promise<Member | null> {
  return (await readMember(ctx.db, input.id))?.member ?? null
}

/** Public like get-by-id: the deterministic id is the bearer secret. */
async function getByCccd(
  ctx: DataContext,
  input: { orgUnitId: string; sanghaType: SanghaType; cccd: string },
): Promise<Member | null> {
  const id = memberCccdIndexId(input.orgUnitId, input.sanghaType, input.cccd)
  return (await readMember(ctx.db, id))?.member ?? null
}

/** The filler "resume by phone" lookup: needs an invite, or a directory writer. */
async function listByPhone(
  ctx: DataContext,
  input: { orgUnitId: string; sanghaType: SanghaType; phone: string; inviteToken?: string },
): Promise<Member[]> {
  await authorizePhoneLookup(ctx, input.orgUnitId, input.inviteToken)
  const rows = await selectAll<MemberRow>(
    ctx.db,
    'SELECT * FROM members WHERE org_unit_id = ? AND sangha_type = ? AND phone = ? ORDER BY id LIMIT ?',
    [input.orgUnitId, input.sanghaType, input.phone, PHONE_MATCH_LIMIT],
  )
  return rows.map(memberFromRow)
}

type ListInput = {
  orgUnitId?: string
  sanghaType: SanghaType
  status?: Member['status']
  limit: number
  cursor?: string
}

function parseListFilters(body: Body): ListInput {
  return {
    orgUnitId: optionalStringField(body, 'orgUnitId'),
    sanghaType: enumField(body, 'sanghaType', SANGHA_TYPES),
    status: optionalEnumField(body, 'status', RECORD_STATUSES),
    limit: optionalIntField(body, 'limit', { min: 1, max: MAX_PAGE_SIZE }) ?? DEFAULT_PAGE_SIZE,
    cursor: optionalStringField(body, 'cursor'),
  }
}

function authorizeList(caller: Caller, orgUnitId: string | undefined): void {
  authorize(canListDirectory(caller, { orgUnitId: orgUnitId ?? null }))
}

async function list(
  ctx: DataContext,
  input: ListInput & { sortBy: MemberAdminSortBy; sortDir: 'asc' | 'desc' },
) {
  authorizeList(ctx.caller, input.orgUnitId)
  const page = await listPage<MemberRow>(ctx.db, {
    table: 'members',
    filters: [
      eq('sangha_type', input.sanghaType),
      eq('org_unit_id', input.orgUnitId),
      eq('status', input.status),
    ],
    sortColumn: MEMBER_SORT_COLUMNS[input.sortBy],
    sortDir: input.sortDir,
    limit: input.limit,
    cursor: input.cursor,
  })
  return { items: page.items.map(memberFromRow), nextCursor: page.nextCursor }
}

async function listByHaLapTab(ctx: DataContext, input: ListInput & { haLapTabRank: string }) {
  authorizeList(ctx.caller, input.orgUnitId)
  const page = await listPage<MemberRow>(ctx.db, {
    table: 'members',
    filters: [
      eq('sangha_type', input.sanghaType),
      eq('ha_lap_tab_rank', input.haLapTabRank),
      eq('org_unit_id', input.orgUnitId),
      eq('status', input.status),
    ],
    sortColumn: 'sap_xep_ha_lap',
    sortDir: 'asc',
    limit: input.limit,
    cursor: input.cursor,
  })
  return { items: page.items.map(memberFromRow), nextCursor: page.nextCursor }
}

async function countByHaLapTab(
  ctx: DataContext,
  input: Omit<ListInput, 'limit' | 'cursor'> & { haLapTabRank: string },
): Promise<{ count: number }> {
  authorizeList(ctx.caller, input.orgUnitId)
  const filters = [
    eq('sangha_type', input.sanghaType),
    eq('ha_lap_tab_rank', input.haLapTabRank),
    eq('org_unit_id', input.orgUnitId),
    eq('status', input.status),
  ].filter((filter) => filter !== null)
  const row = await selectFirst<{ count: number }>(
    ctx.db,
    `SELECT COUNT(*) AS count FROM members WHERE ${filters.map((f) => f.sql).join(' AND ')}`,
    filters.flatMap((f) => f.params),
  )
  return { count: row?.count ?? 0 }
}

/** Members whose current temple is one of these (blocks deleting those temples). */
async function listByCurrentTempleIds(
  ctx: DataContext,
  input: { templeIds: string[] },
): Promise<Member[]> {
  const scope = directoryListScope(ctx.caller)
  const members: Member[] = []
  // One parameter is the scope's org unit.
  for (const ids of chunk([...new Set(input.templeIds)], MAX_BOUND_PARAMS - 1)) {
    const orgFilter = scope.orgUnitId === null ? '' : ' AND org_unit_id = ?'
    const rows = await selectAll<MemberRow>(
      ctx.db,
      `SELECT * FROM members WHERE current_temple_id IN (${placeholders(ids.length)})${orgFilter}`,
      scope.orgUnitId === null ? ids : [...ids, scope.orgUnitId],
    )
    members.push(...rows.map(memberFromRow))
  }
  return members
}

async function listSecretaries(
  ctx: DataContext,
  input: { role: NonNullable<Member['directoryRole']> },
): Promise<Member[]> {
  const scope = directoryListScope(ctx.caller)
  const rows = await selectAll<MemberRow>(
    ctx.db,
    `SELECT * FROM members WHERE directory_role = ?${scope.orgUnitId === null ? '' : ' AND org_unit_id = ?'} ORDER BY id LIMIT ?`,
    scope.orgUnitId === null
      ? [input.role, SECRETARIES_LIMIT]
      : [input.role, scope.orgUnitId, SECRETARIES_LIMIT],
  )
  return rows.map(memberFromRow)
}

// --- routes ---

const DOCUMENT_TYPE_IDS = MEMBER_DOCUMENT_TYPES.map((type) => type.id)

function parseDocumentRef(body: Body): DocumentRef {
  return {
    memberId: stringField(body, 'memberId'),
    typeId: enumField(body, 'typeId', DOCUMENT_TYPE_IDS),
    audit: actorField(body, 'audit'),
  }
}

function documentSideField(body: Body, typeId: DocumentTypeId): DocumentSide | undefined {
  const side = optionalStringField(body, 'side')
  if (side === undefined) return undefined
  if (!isValidDocumentSide(getDocumentType(typeId)!, side)) {
    throw new DomainError('INVALID_INPUT', `side is not valid for ${typeId}`)
  }
  return side
}

export const memberRoutes: Record<string, DataRoute> = {
  'members/get': route((body) => ({ id: stringField(body, 'id') }), getById),
  'members/get-by-cccd': route(
    (body) => ({
      orgUnitId: stringField(body, 'orgUnitId'),
      sanghaType: enumField(body, 'sanghaType', SANGHA_TYPES),
      cccd: stringField(body, 'cccd'),
    }),
    getByCccd,
  ),
  'members/list-by-phone': route(
    (body) => ({
      orgUnitId: stringField(body, 'orgUnitId'),
      sanghaType: enumField(body, 'sanghaType', SANGHA_TYPES),
      phone: stringField(body, 'phone'),
      inviteToken: optionalStringField(body, 'inviteToken'),
    }),
    listByPhone,
  ),
  'members/list': route(
    (body) => ({
      ...parseListFilters(body),
      sortBy:
        optionalEnumField(body, 'sortBy', Object.keys(MEMBER_SORT_COLUMNS) as MemberAdminSortBy[]) ??
        'updatedAt',
      sortDir: optionalEnumField(body, 'sortDir', SORT_DIRS) ?? 'desc',
    }),
    list,
  ),
  'members/list-ha-lap': route(
    (body) => ({ ...parseListFilters(body), haLapTabRank: stringField(body, 'haLapTabRank') }),
    listByHaLapTab,
  ),
  'members/count-ha-lap': route(
    (body) => ({
      orgUnitId: optionalStringField(body, 'orgUnitId'),
      sanghaType: enumField(body, 'sanghaType', SANGHA_TYPES),
      status: optionalEnumField(body, 'status', RECORD_STATUSES),
      haLapTabRank: stringField(body, 'haLapTabRank'),
    }),
    countByHaLapTab,
  ),
  'members/by-temples': route(
    (body) => ({ templeIds: stringArrayField(body, 'templeIds', MAX_IDS) }),
    listByCurrentTempleIds,
  ),
  'members/secretaries': route(
    (body) => ({ role: enumField(body, 'role', ['giao_doan_admin', 'he_phai_secretary'] as const) }),
    listSecretaries,
  ),
  'members/save-draft': route(parseSave, (ctx, input) => createOrUpdate(ctx, input, false)),
  'members/save-and-lock': route(
    (body) => ({ ...parseSave(body), audit: actorField(body, 'audit') }),
    (ctx, input) => createOrUpdate(ctx, input, true),
  ),
  'members/update': route(
    (body) => ({
      memberId: stringField(body, 'memberId'),
      patch: patchField(body, PROTECTED_PATCH_FIELDS, PATCH_FIELD_CHECKS) as MemberProfilePatch,
      allowWhenLocked: optionalBooleanField(body, 'allowWhenLocked') ?? false,
      allowOrgUnitChange: optionalBooleanField(body, 'allowOrgUnitChange') ?? false,
      orgUnitId: optionalStringField(body, 'orgUnitId'),
      audit: optionalActorField(body, 'audit'),
    }),
    updateById,
  ),
  'members/request-edit': route(
    (body) => ({ memberId: stringField(body, 'memberId'), phone: stringField(body, 'phone') }),
    requestEdit,
  ),
  'members/lock': route(
    (body) => ({
      memberId: stringField(body, 'memberId'),
      lockedBy: stringField(body, 'lockedBy'),
      audit: actorField(body, 'audit'),
    }),
    lock,
  ),
  'members/unlock': route(
    (body) => ({ memberId: stringField(body, 'memberId'), audit: actorField(body, 'audit') }),
    unlock,
  ),
  'members/set-photo': route(
    (body) => ({
      memberId: stringField(body, 'memberId'),
      photoPath: nullableStringField(body, 'photoPath'),
      audit: actorField(body, 'audit'),
    }),
    setPhotoPath,
  ),
  'members/set-documents': route(
    (body) => ({
      memberId: stringField(body, 'memberId'),
      documents: objectField(body, 'documents') as MemberDocuments,
    }),
    setDocumentPaths,
  ),
  'members/set-tinh-trang': route(
    (body) => ({
      memberId: stringField(body, 'memberId'),
      tinhTrang: optionalEnumField(body, 'tinhTrang', MEMBER_TINH_TRANG_VALUES) ?? null,
      audit: actorField(body, 'audit'),
    }),
    setTinhTrang,
  ),
  'members/merge-document': route(
    (body) => {
      const ref = parseDocumentRef(body)
      const side = documentSideField(body, ref.typeId)
      if (!side) throw new DomainError('INVALID_INPUT', 'side must be a non-empty string')
      return { ...ref, side, filePath: stringField(body, 'filePath') }
    },
    mergeDocumentSide,
  ),
  'members/remove-document': route(
    (body) => {
      const ref = parseDocumentRef(body)
      return { ...ref, side: documentSideField(body, ref.typeId) }
    },
    removeDocumentPaths,
  ),
  'members/delete-many': route(
    (body) => ({ ids: stringArrayField(body, 'ids', MAX_IDS) }),
    deleteMany,
  ),
}
