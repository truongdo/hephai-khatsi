import type { AuditAction, AuditActor, AuditLogEntry, AuditLogWrite } from '#/domain/auditLog'
import { buildAuditChanges } from '#/domain/buildAuditChanges'
import { DomainError } from '#/domain/errors'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import { memberPhoneIndexId } from '#/domain/memberPhoneIndex'
import { normalizeVnPhone } from '#/domain/normalize'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import {
  mergeDocumentPath,
  pathFieldForSide,
  pathsFromTypeFiles,
  removeDocumentSide,
  removeDocumentType,
  type DocumentSide,
  type DocumentTypeId,
} from '#/domain/memberDocumentTypes'
import { MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER } from '#/domain/giaoPhamHePhaiRankOrder'
import { buildMemberListSortKeys, buildTempleListSortKeys } from '#/domain/listSortKeys'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import type { Member, SanghaType, Temple } from '#/domain/types'
import type {
  AdminListPage,
  ListMembersAdminInput,
  ListMembersExportInput,
  ListTemplesAdminInput,
  ListTemplesExportInput,
} from '#/repositories/adminListTypes'
import type {
  CreateOrUpdateMemberAndLockInput,
  CreateOrUpdateMemberDraftInput,
  MemberProfilePatch,
  MemberStore,
} from '#/repositories/memberRepo'
import { auditParentKey, shouldWriteAudit } from '#/repositories/auditLogRepo'
import type {
  CreateOrUpdateTempleAndLockInput,
  CreateOrUpdateTempleDraftInput,
  TempleStore,
} from '#/repositories/templeRepo'

const PHONE_INDEX_CAP = 20

function resolveMemoryOrgUnitName(orgUnitId: string): string {
  const seeded = ORG_UNIT_SEED.find((u) => u.id === orgUnitId)
  return seeded?.name ?? orgUnitId
}

function applyTempleListSortKeys(temple: Temple): Temple {
  return {
    ...temple,
    ...buildTempleListSortKeys({
      diaChiMoi: temple.diaChiMoi,
      orgUnitName: resolveMemoryOrgUnitName(temple.orgUnitId),
    }),
  }
}

function applyMemberListSortKeys(member: Member): Member {
  return {
    ...member,
    ...buildMemberListSortKeys({
      sanghaType: member.sanghaType,
      orgUnitName: resolveMemoryOrgUnitName(member.orgUnitId),
      giaoPhamHePhaiRank: member.giaoPhamHePhai?.rank,
    }),
  }
}

export function memoryAppendAudit(
  auditLogs: Map<string, AuditLogEntry[]>,
  parentKey: string,
  write: AuditLogWrite,
): AuditLogEntry {
  const id = `audit-${auditLogs.size + 1}`
  const entry: AuditLogEntry = { id, ...write }
  const existing = auditLogs.get(parentKey) ?? []
  auditLogs.set(parentKey, [...existing, entry])
  return entry
}

export function memoryListAudit(
  auditLogs: Map<string, AuditLogEntry[]>,
  parentKey: string,
  limit: number,
  startAfterAt?: string,
): { entries: AuditLogEntry[]; nextStartAfterAt: string | null } {
  let entries = [...(auditLogs.get(parentKey) ?? [])]
  entries.sort((a, b) => b.at.localeCompare(a.at))

  if (startAfterAt) {
    entries = entries.filter((entry) => entry.at < startAfterAt)
  }

  const page = entries.slice(0, limit)
  const nextStartAfterAt =
    entries.length > limit ? page[page.length - 1]!.at : null
  return { entries: page, nextStartAfterAt }
}

export function createMemoryAuditStore() {
  const auditLogs = new Map<string, AuditLogEntry[]>()

  return {
    auditLogs,
    memoryAppendAudit: (parentKey: string, write: AuditLogWrite) =>
      memoryAppendAudit(auditLogs, parentKey, write),
    memoryListAudit: (
      parentKey: string,
      limit: number,
      startAfterAt?: string,
    ) => memoryListAudit(auditLogs, parentKey, limit, startAfterAt),
  }
}

function maybeMemoryAppendAuditFromDiff(
  auditLogs: Map<string, AuditLogEntry[]>,
  parent: { collection: 'members' | 'temples'; id: string },
  args: {
    action: AuditAction
    actor: AuditActor
    at: string
    before: unknown
    after: unknown
  },
): void {
  const changes = buildAuditChanges(args.before, args.after)
  if (!shouldWriteAudit(args.action, changes)) return

  memoryAppendAudit(auditLogs, auditParentKey(parent), {
    action: args.action,
    at: args.at,
    actorType: args.actor.actorType,
    actorId: args.actor.actorId,
    changes,
    summary: changes.length === 0 ? null : String(changes.length),
  })
}

function appendPhoneIndex(
  phoneIndex: Map<string, string[]>,
  member: Member,
) {
  if (!member.dienThoai) return
  let phone: string
  try {
    phone = normalizeVnPhone(member.dienThoai)
  } catch {
    return
  }
  const key = memberPhoneIndexId(member.orgUnitId, member.sanghaType, phone)
  const existingIds = phoneIndex.get(key) ?? []
  if (existingIds.includes(member.id) || existingIds.length >= PHONE_INDEX_CAP) {
    return
  }
  phoneIndex.set(key, [...existingIds, member.id])
}

function templePhoneIndexId(orgUnitId: string, phone: string): string {
  return `${orgUnitId}_${phone}`
}

function appendTemplePhoneIndex(
  phoneIndex: Map<string, string[]>,
  temple: Temple,
) {
  for (const phone of temple.managerPhones) {
    const key = templePhoneIndexId(temple.orgUnitId, phone)
    const existingIds = phoneIndex.get(key) ?? []
    if (existingIds.includes(temple.id) || existingIds.length >= PHONE_INDEX_CAP) {
      continue
    }
    phoneIndex.set(key, [...existingIds, temple.id])
  }
}

function removeTempleFromPhoneIndex(
  phoneIndex: Map<string, string[]>,
  temple: Temple,
) {
  for (const phone of temple.managerPhones) {
    const key = templePhoneIndexId(temple.orgUnitId, phone)
    const existingIds = phoneIndex.get(key)
    if (!existingIds) continue
    const nextIds = existingIds.filter((id) => id !== temple.id)
    if (nextIds.length === 0) {
      phoneIndex.delete(key)
    } else if (nextIds.length !== existingIds.length) {
      phoneIndex.set(key, nextIds)
    }
  }
}

function removeFromPhoneIndex(
  phoneIndex: Map<string, string[]>,
  member: Member,
) {
  if (!member.dienThoai) return
  let phone: string
  try {
    phone = normalizeVnPhone(member.dienThoai)
  } catch {
    return
  }
  const key = memberPhoneIndexId(member.orgUnitId, member.sanghaType, phone)
  const existingIds = phoneIndex.get(key)
  if (!existingIds) return
  const nextIds = existingIds.filter((id) => id !== member.id)
  if (nextIds.length === 0) {
    phoneIndex.delete(key)
  } else if (nextIds.length !== existingIds.length) {
    phoneIndex.set(key, nextIds)
  }
}

function listInMemory<T extends { id: string }>(
  all: Iterable<T>,
  input: { limit?: number; cursor?: string },
  options: {
    filter: (item: T) => boolean
    /** Comparable value; numbers and strings supported. */
    sortValue: (item: T) => string | number
    sortDir: 'asc' | 'desc'
  },
): AdminListPage<T> {
  const limit = input.limit ?? 25
  let items = [...all].filter(options.filter)
  const dir = options.sortDir === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const av = options.sortValue(a)
    const bv = options.sortValue(b)
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * dir
    }
    return String(av).localeCompare(String(bv)) * dir
  })

  if (input.cursor) {
    const cursorIdx = items.findIndex((item) => item.id === input.cursor)
    if (cursorIdx >= 0) {
      items = items.slice(cursorIdx + 1)
    }
  }

  const page = items.slice(0, limit)
  const nextCursor =
    items.length > limit ? page[page.length - 1]!.id : null
  return { items: page, nextCursor }
}

function templeSortValue(
  temple: Temple,
  sortBy: 'listCityName' | 'orgUnitName' | 'updatedAt',
): string | number {
  switch (sortBy) {
    case 'listCityName':
      return temple.listCityName ?? ''
    case 'orgUnitName':
      return temple.orgUnitName ?? ''
    case 'updatedAt':
      return temple.updatedAt
  }
}

function memberSortValue(
  member: Member,
  sortBy: 'giaoPhamHePhaiRankOrder' | 'orgUnitName' | 'status' | 'updatedAt',
): string | number {
  switch (sortBy) {
    case 'giaoPhamHePhaiRankOrder':
      return member.giaoPhamHePhaiRankOrder ?? MISSING_GIAO_PHAM_HE_PHAI_RANK_ORDER
    case 'orgUnitName':
      return member.orgUnitName ?? ''
    case 'status':
      return member.status
    case 'updatedAt':
      return member.updatedAt
  }
}

export function createMemoryMemberStore(
  seed: Member[] = [],
): MemberStore & {
  members: Map<string, Member>
  index: Map<string, string>
  phoneIndex: Map<string, string[]>
  auditLogs: Map<string, AuditLogEntry[]>
  memoryAppendAudit: (parentKey: string, write: AuditLogWrite) => AuditLogEntry
  memoryListAudit: (
    parentKey: string,
    limit: number,
    startAfterAt?: string,
  ) => { entries: AuditLogEntry[]; nextStartAfterAt: string | null }
} {
  const members = new Map(seed.map((member) => [member.id, member]))
  const index = new Map<string, string>()
  const phoneIndex = new Map<string, string[]>()
  const audit = createMemoryAuditStore()
  const auditLogs = audit.auditLogs
  for (const member of seed) {
    index.set(
      memberCccdIndexId(member.orgUnitId, member.sanghaType, member.cccd),
      member.id,
    )
    appendPhoneIndex(phoneIndex, member)
  }

  const store: MemberStore & {
    members: Map<string, Member>
    index: Map<string, string>
    phoneIndex: Map<string, string[]>
    auditLogs: Map<string, AuditLogEntry[]>
    memoryAppendAudit: (parentKey: string, write: AuditLogWrite) => AuditLogEntry
    memoryListAudit: (
      parentKey: string,
      limit: number,
      startAfterAt?: string,
    ) => { entries: AuditLogEntry[]; nextStartAfterAt: string | null }
  } = {
    members,
    index,
    phoneIndex,
    auditLogs,
    memoryAppendAudit: audit.memoryAppendAudit,
    memoryListAudit: audit.memoryListAudit,
    async createOrUpdateDraft(input: CreateOrUpdateMemberDraftInput) {
      const indexId = memberCccdIndexId(
        input.orgUnitId,
        input.sanghaType,
        input.cccd,
      )
      const now = '2026-07-19T00:00:00.000Z'
      const existingMemberId = index.get(indexId)

      if (existingMemberId) {
        const existing = members.get(existingMemberId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Member is locked')
        }
        const member = applyMemberListSortKeys({
          ...existing,
          ...input.patch,
          // Re-validated per the current invite token on every non-admin
          // write, matching memberRepo.ts / firebase/firestore.rules.
          inviteId: input.inviteId,
          updatedAt: now,
        })
        members.set(existing.id, member)
        appendPhoneIndex(phoneIndex, member)
        if (input.audit) {
          maybeMemoryAppendAuditFromDiff(
            auditLogs,
            { collection: 'members', id: member.id },
            {
              action: 'updated',
              actor: input.audit,
              at: now,
              before: existing,
              after: member,
            },
          )
        }
        return { member, mode: 'updated' as const }
      }

      const id = `member-${members.size + 1}`
      const member = applyMemberListSortKeys({
        id,
        orgUnitId: input.orgUnitId,
        sanghaType: input.sanghaType,
        status: 'draft',
        cccd: input.cccd,
        inviteId: input.inviteId,
        currentTempleId: null,
        photoPath: null,
        createdAt: now,
        updatedAt: now,
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
        ...input.patch,
      })
      members.set(id, member)
      index.set(indexId, id)
      appendPhoneIndex(phoneIndex, member)
      if (input.audit) {
        maybeMemoryAppendAuditFromDiff(
          auditLogs,
          { collection: 'members', id: member.id },
          {
            action: 'created',
            actor: input.audit,
            at: now,
            before: null,
            after: member,
          },
        )
      }
      return { member, mode: 'created' as const }
    },
    async createOrUpdateAndLock(input: CreateOrUpdateMemberAndLockInput) {
      const indexId = memberCccdIndexId(
        input.orgUnitId,
        input.sanghaType,
        input.cccd,
      )
      const now = '2026-07-19T00:00:00.000Z'
      const existingMemberId = index.get(indexId)

      if (existingMemberId) {
        const existing = members.get(existingMemberId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Member is locked')
        }
        const member = applyMemberListSortKeys({
          ...existing,
          ...input.patch,
          inviteId: input.inviteId,
          status: 'locked',
          lockedAt: now,
          lockedBy: 'filler',
          editRequestedAt: null,
          editRequestedBy: null,
          updatedAt: now,
        })
        members.set(existing.id, member)
        appendPhoneIndex(phoneIndex, member)
        maybeMemoryAppendAuditFromDiff(
          auditLogs,
          { collection: 'members', id: member.id },
          {
            action: 'updated',
            actor: input.audit,
            at: now,
            before: existing,
            after: member,
          },
        )
        return { member, mode: 'updated' as const }
      }

      const id = `member-${members.size + 1}`
      const member = applyMemberListSortKeys({
        id,
        orgUnitId: input.orgUnitId,
        sanghaType: input.sanghaType,
        status: 'locked',
        cccd: input.cccd,
        inviteId: input.inviteId,
        currentTempleId: null,
        photoPath: null,
        createdAt: now,
        updatedAt: now,
        lockedAt: now,
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
        ...input.patch,
      })
      members.set(id, member)
      index.set(indexId, id)
      appendPhoneIndex(phoneIndex, member)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: member.id },
        {
          action: 'created',
          actor: input.audit,
          at: now,
          before: null,
          after: member,
        },
      )
      return { member, mode: 'created' as const }
    },
    async requestEdit(memberId: string, phone: string) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status !== 'locked') {
        throw new DomainError('INVALID_STATUS', 'Member is not locked')
      }
      if (existing.editRequestedAt) {
        return existing
      }
      const now = '2026-07-19T00:00:00.000Z'
      const member: Member = {
        ...existing,
        editRequestedAt: now,
        editRequestedBy: phone,
        updatedAt: now,
      }
      members.set(memberId, member)
      let actorId = phone
      try {
        actorId = normalizeVnPhone(phone)
      } catch {
        // keep raw phone
      }
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: memberId },
        {
          action: 'edit_requested',
          actor: { actorType: 'filler', actorId },
          at: now,
          before: existing,
          after: member,
        },
      )
      return member
    },
    async updateDraftById(
      memberId: string,
      patch: MemberProfilePatch,
      options?: {
        allowWhenLocked?: boolean
        allowOrgUnitChange?: boolean
        orgUnitId?: string
        audit?: AuditActor
      },
    ) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'locked' && !options?.allowWhenLocked) {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }
      const nextOrgUnitId = options?.orgUnitId ?? existing.orgUnitId
      const orgChanged = nextOrgUnitId !== existing.orgUnitId
      if (orgChanged && !options?.allowOrgUnitChange) {
        throw new DomainError('FORBIDDEN', 'Cannot change member org unit')
      }
      const nextId = orgChanged
        ? memberCccdIndexId(nextOrgUnitId, existing.sanghaType, existing.cccd)
        : existing.id
      if (orgChanged && members.has(nextId)) {
        throw new DomainError(
          'ALREADY_EXISTS',
          'A member with this CCCD already exists in the target org unit',
        )
      }
      const now = '2026-07-19T00:00:00.000Z'
      const member = applyMemberListSortKeys({
        ...existing,
        ...patch,
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
        updatedAt: now,
      })
      if (orgChanged) {
        members.delete(memberId)
        index.delete(
          memberCccdIndexId(existing.orgUnitId, existing.sanghaType, existing.cccd),
        )
        removeFromPhoneIndex(phoneIndex, existing)
        const previousLogs =
          auditLogs.get(auditParentKey({ collection: 'members', id: memberId })) ??
          []
        auditLogs.set(
          auditParentKey({ collection: 'members', id: nextId }),
          previousLogs.map((entry) => ({ ...entry })),
        )
      }
      members.set(nextId, member)
      index.set(
        memberCccdIndexId(member.orgUnitId, member.sanghaType, member.cccd),
        member.id,
      )
      appendPhoneIndex(phoneIndex, member)
      if (options?.audit) {
        maybeMemoryAppendAuditFromDiff(
          auditLogs,
          { collection: 'members', id: nextId },
          {
            action: 'updated',
            actor: options.audit,
            at: now,
            before: existing,
            after: member,
          },
        )
      }
      return member
    },
    async getByCccd(input: {
      orgUnitId: string
      sanghaType: SanghaType
      cccd: string
    }) {
      const id = index.get(
        memberCccdIndexId(input.orgUnitId, input.sanghaType, input.cccd),
      )
      return id ? members.get(id) ?? null : null
    },
    async getById(memberId: string) {
      return members.get(memberId) ?? null
    },
    async listByOrgSanghaAndPhone(input: {
      orgUnitId: string
      sanghaType: SanghaType
      phone: string
    }) {
      const phone = input.phone
      const ids =
        phoneIndex.get(
          memberPhoneIndexId(input.orgUnitId, input.sanghaType, phone),
        ) ?? []
      return ids
        .map((id) => members.get(id) ?? null)
        .filter((m): m is Member => {
          if (!m) return false
          if (
            m.orgUnitId !== input.orgUnitId ||
            m.sanghaType !== input.sanghaType
          ) {
            return false
          }
          try {
            return normalizeVnPhone(m.dienThoai ?? '') === phone
          } catch {
            return false
          }
        })
    },
    async setPhotoPath(
      memberId: string,
      photoPath: string | null,
      audit: AuditActor,
    ) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const now = '2026-07-19T00:00:00.000Z'
      const member = {
        ...existing,
        photoPath,
        updatedAt: now,
      }
      members.set(memberId, member)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: memberId },
        {
          action: photoPath !== null ? 'photo_uploaded' : 'photo_deleted',
          actor: audit,
          at: now,
          before: existing,
          after: member,
        },
      )
      return member
    },
    async setDocumentPaths(memberId: string, documents: MemberDocuments) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const member = {
        ...existing,
        documents,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      return member
    },
    async mergeDocumentSide(
      memberId: string,
      typeId: DocumentTypeId,
      side: DocumentSide,
      filePath: string,
      audit: AuditActor,
    ) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const current = existing.documents ?? {}
      const pathField = pathFieldForSide(side)
      const previousPath = current[typeId]?.[pathField]
      const documents = mergeDocumentPath(current, typeId, side, filePath)
      const now = '2026-07-19T00:00:00.000Z'
      const member = {
        ...existing,
        documents,
        updatedAt: now,
      }
      members.set(memberId, member)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: memberId },
        {
          action: 'document_uploaded',
          actor: audit,
          at: now,
          before: existing,
          after: member,
        },
      )
      return { member, previousPath }
    },
    async removeDocumentPaths(
      memberId: string,
      typeId: DocumentTypeId,
      side: DocumentSide | undefined,
      audit: AuditActor,
    ) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const current = existing.documents ?? {}
      const typeFiles = current[typeId]
      const removedPaths = side
        ? (() => {
            const pathField = pathFieldForSide(side)
            const path = typeFiles?.[pathField]
            return path ? [path] : []
          })()
        : typeFiles
          ? pathsFromTypeFiles(typeFiles)
          : []
      const documents = side
        ? removeDocumentSide(current, typeId, side)
        : removeDocumentType(current, typeId)
      const now = '2026-07-19T00:00:00.000Z'
      const member = {
        ...existing,
        documents,
        updatedAt: now,
      }
      members.set(memberId, member)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: memberId },
        {
          action: 'document_deleted',
          actor: audit,
          at: now,
          before: existing,
          after: member,
        },
      )
      return { member, removedPaths }
    },
    async lock(memberId: string, lockedBy: string, audit: AuditActor) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      const now = '2026-07-19T00:00:00.000Z'
      const member: Member = {
        ...existing,
        status: 'locked',
        lockedAt: now,
        lockedBy,
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: now,
      }
      members.set(memberId, member)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: memberId },
        {
          action: 'locked',
          actor: audit,
          at: now,
          before: existing,
          after: member,
        },
      )
      return member
    },
    async unlock(memberId: string, audit: AuditActor) {
      const existing = members.get(memberId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Member not found')
      if (existing.status === 'draft') {
        return existing
      }
      const member: Member = {
        ...existing,
        status: 'draft',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: '2026-07-19T00:00:00.000Z',
      }
      members.set(memberId, member)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'members', id: memberId },
        {
          action: 'unlocked',
          actor: audit,
          at: '2026-07-19T00:00:00.000Z',
          before: existing,
          after: member,
        },
      )
      return member
    },
    async list(input: ListMembersAdminInput) {
      const sortBy = input.sortBy ?? 'updatedAt'
      const sortDir = input.sortDir ?? 'desc'
      return listInMemory(members.values(), input, {
        filter: (member) =>
          member.sanghaType === input.sanghaType &&
          (!input.orgUnitId || member.orgUnitId === input.orgUnitId) &&
          (!input.status || member.status === input.status),
        sortValue: (member) => memberSortValue(member, sortBy),
        sortDir,
      })
    },
    async listAllForExport(input: ListMembersExportInput) {
      const page = await store.list({ ...input, limit: Number.MAX_SAFE_INTEGER })
      return page.items
    },
    async listByCurrentTempleIds(templeIds: string[]) {
      if (templeIds.length === 0) return []
      const templeIdSet = new Set(templeIds)
      return [...members.values()].filter(
        (member) =>
          member.currentTempleId !== null &&
          templeIdSet.has(member.currentTempleId),
      )
    },
    async listDirectorySecretaries() {
      return [...members.values()].filter(
        (member) => member.directoryRole === 'giao_doan_admin',
      )
    },
    async listHePhaiSecretaries() {
      return [...members.values()].filter(
        (member) => member.directoryRole === 'he_phai_secretary',
      )
    },
    async deleteMany(ids: string[]) {
      for (const memberId of ids) {
        const member = members.get(memberId)
        if (!member) continue
        removeFromPhoneIndex(phoneIndex, member)
        index.delete(
          memberCccdIndexId(member.orgUnitId, member.sanghaType, member.cccd),
        )
        members.delete(memberId)
      }
    },
  }

  return store
}

export function createMemoryTempleStore(
  seed: Temple[] = [],
): TempleStore & {
  temples: Map<string, Temple>
  phoneIndex: Map<string, string[]>
  auditLogs: Map<string, AuditLogEntry[]>
  memoryAppendAudit: (parentKey: string, write: AuditLogWrite) => AuditLogEntry
  memoryListAudit: (
    parentKey: string,
    limit: number,
    startAfterAt?: string,
  ) => { entries: AuditLogEntry[]; nextStartAfterAt: string | null }
} {
  const temples = new Map(seed.map((temple) => [temple.id, temple]))
  const phoneIndex = new Map<string, string[]>()
  const audit = createMemoryAuditStore()
  const auditLogs = audit.auditLogs
  for (const temple of seed) {
    appendTemplePhoneIndex(phoneIndex, temple)
  }

  const store: TempleStore & {
    temples: Map<string, Temple>
    phoneIndex: Map<string, string[]>
    auditLogs: Map<string, AuditLogEntry[]>
    memoryAppendAudit: (parentKey: string, write: AuditLogWrite) => AuditLogEntry
    memoryListAudit: (
      parentKey: string,
      limit: number,
      startAfterAt?: string,
    ) => { entries: AuditLogEntry[]; nextStartAfterAt: string | null }
  } = {
    temples,
    phoneIndex,
    auditLogs,
    memoryAppendAudit: audit.memoryAppendAudit,
    memoryListAudit: audit.memoryListAudit,
    async createOrUpdateDraft(input: CreateOrUpdateTempleDraftInput) {
      const now = '2026-07-19T00:00:00.000Z'

      if (input.templeId) {
        const existing = temples.get(input.templeId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
        const orgChanged = existing.orgUnitId !== input.orgUnitId
        if (orgChanged && !input.allowOrgUnitChange) {
          throw new DomainError(
            'FORBIDDEN',
            'Temple does not belong to this invite org unit',
          )
        }
        if (existing.status === 'locked' && !input.allowWhenLocked) {
          throw new DomainError('RECORD_LOCKED', 'Temple is locked')
        }
        if (orgChanged) {
          removeTempleFromPhoneIndex(phoneIndex, existing)
        }
        const temple = applyTempleListSortKeys({
          ...existing,
          ...input.patch,
          id: existing.id,
          orgUnitId: input.orgUnitId,
          status: existing.status === 'locked' ? 'locked' : 'draft',
          managerPhones: input.managerPhones,
          // Re-validated per the current invite token on non-admin writes;
          // admin writes pass inviteId: null and preserve the original,
          // matching templeRepo.ts / firebase/firestore.rules.
          inviteId: input.inviteId ?? existing.inviteId,
          photoPath:
            'photoPath' in input.patch
              ? (input.patch.photoPath ?? null)
              : (existing.photoPath ?? null),
          createdAt: existing.createdAt,
          updatedAt: now,
          lockedAt: existing.lockedAt,
          lockedBy: existing.lockedBy,
          editRequestedAt: existing.editRequestedAt,
          editRequestedBy: existing.editRequestedBy,
        })
        temples.set(temple.id, temple)
        appendTemplePhoneIndex(phoneIndex, temple)
        if (input.audit) {
          maybeMemoryAppendAuditFromDiff(
            auditLogs,
            { collection: 'temples', id: temple.id },
            {
              action: 'updated',
              actor: input.audit,
              at: now,
              before: existing,
              after: temple,
            },
          )
        }
        return { temple, mode: 'updated' as const }
      }

      const id = `temple-${temples.size + 1}`
      const temple = applyTempleListSortKeys({
        ...input.patch,
        id,
        orgUnitId: input.orgUnitId,
        status: 'draft',
        managerPhones: input.managerPhones,
        inviteId: input.inviteId,
        photoPath: input.patch.photoPath ?? null,
        createdAt: now,
        updatedAt: now,
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      })
      temples.set(id, temple)
      appendTemplePhoneIndex(phoneIndex, temple)
      if (input.audit) {
        maybeMemoryAppendAuditFromDiff(
          auditLogs,
          { collection: 'temples', id: temple.id },
          {
            action: 'created',
            actor: input.audit,
            at: now,
            before: null,
            after: temple,
          },
        )
      }
      return { temple, mode: 'created' as const }
    },
    async createOrUpdateAndLock(input: CreateOrUpdateTempleAndLockInput) {
      const now = '2026-07-19T00:00:00.000Z'

      if (input.templeId) {
        const existing = temples.get(input.templeId)
        if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
        if (existing.orgUnitId !== input.orgUnitId) {
          throw new DomainError(
            'FORBIDDEN',
            'Temple does not belong to this invite org unit',
          )
        }
        if (existing.status === 'locked') {
          throw new DomainError('RECORD_LOCKED', 'Temple is locked')
        }
        const temple = applyTempleListSortKeys({
          ...existing,
          ...input.patch,
          id: existing.id,
          orgUnitId: existing.orgUnitId,
          status: 'locked',
          managerPhones: input.managerPhones,
          inviteId: input.inviteId ?? existing.inviteId,
          photoPath:
            'photoPath' in input.patch
              ? (input.patch.photoPath ?? null)
              : (existing.photoPath ?? null),
          createdAt: existing.createdAt,
          updatedAt: now,
          lockedAt: now,
          lockedBy: 'filler',
          editRequestedAt: null,
          editRequestedBy: null,
        })
        temples.set(temple.id, temple)
        appendTemplePhoneIndex(phoneIndex, temple)
        maybeMemoryAppendAuditFromDiff(
          auditLogs,
          { collection: 'temples', id: temple.id },
          {
            action: 'updated',
            actor: input.audit,
            at: now,
            before: existing,
            after: temple,
          },
        )
        return { temple, mode: 'updated' as const }
      }

      const id = `temple-${temples.size + 1}`
      const temple = applyTempleListSortKeys({
        ...input.patch,
        id,
        orgUnitId: input.orgUnitId,
        status: 'locked',
        managerPhones: input.managerPhones,
        inviteId: input.inviteId,
        photoPath: input.patch.photoPath ?? null,
        createdAt: now,
        updatedAt: now,
        lockedAt: now,
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
      })
      temples.set(id, temple)
      appendTemplePhoneIndex(phoneIndex, temple)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'temples', id: temple.id },
        {
          action: 'created',
          actor: input.audit,
          at: now,
          before: null,
          after: temple,
        },
      )
      return { temple, mode: 'created' as const }
    },
    async requestEdit(templeId: string, phone: string) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      if (existing.status !== 'locked') {
        throw new DomainError('INVALID_STATUS', 'Temple is not locked')
      }
      if (existing.editRequestedAt) {
        return existing
      }
      const now = '2026-07-19T00:00:00.000Z'
      const temple: Temple = {
        ...existing,
        editRequestedAt: now,
        editRequestedBy: phone,
        updatedAt: now,
      }
      temples.set(templeId, temple)
      let actorId = phone
      try {
        actorId = normalizeVnPhone(phone)
      } catch {
        // keep raw phone
      }
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'temples', id: templeId },
        {
          action: 'edit_requested',
          actor: { actorType: 'filler', actorId },
          at: now,
          before: existing,
          after: temple,
        },
      )
      return temple
    },
    async getById(templeId: string) {
      const temple = temples.get(templeId)
      if (!temple) return null
      return { ...temple, photoPath: temple.photoPath ?? null }
    },
    async listByOrgAndPhone(input: { orgUnitId: string; phone: string }) {
      return [...temples.values()].filter(
        (temple) =>
          temple.orgUnitId === input.orgUnitId &&
          temple.managerPhones.includes(input.phone),
      )
    },
    async lock(templeId: string, lockedBy: string, audit: AuditActor) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      const now = '2026-07-19T00:00:00.000Z'
      const temple: Temple = {
        ...existing,
        status: 'locked',
        lockedAt: now,
        lockedBy,
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: now,
      }
      temples.set(templeId, temple)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'temples', id: templeId },
        {
          action: 'locked',
          actor: audit,
          at: now,
          before: existing,
          after: temple,
        },
      )
      return temple
    },
    async unlock(templeId: string, audit: AuditActor) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      if (existing.status === 'draft') {
        return existing
      }
      const now = '2026-07-19T00:00:00.000Z'
      const temple: Temple = {
        ...existing,
        status: 'draft',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
        updatedAt: now,
      }
      temples.set(templeId, temple)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'temples', id: templeId },
        {
          action: 'unlocked',
          actor: audit,
          at: now,
          before: existing,
          after: temple,
        },
      )
      return temple
    },
    async setPhotoPath(
      templeId: string,
      photoPath: string | null,
      audit: AuditActor,
    ) {
      const existing = temples.get(templeId)
      if (!existing) throw new DomainError('NOT_FOUND', 'Temple not found')
      const now = '2026-07-19T00:00:00.000Z'
      const temple: Temple = {
        ...existing,
        photoPath,
        updatedAt: now,
      }
      temples.set(templeId, temple)
      maybeMemoryAppendAuditFromDiff(
        auditLogs,
        { collection: 'temples', id: templeId },
        {
          action: photoPath !== null ? 'photo_uploaded' : 'photo_deleted',
          actor: audit,
          at: now,
          before: existing,
          after: temple,
        },
      )
      return temple
    },
    async list(input: ListTemplesAdminInput) {
      const sortBy = input.sortBy ?? 'updatedAt'
      const sortDir = input.sortDir ?? 'desc'
      return listInMemory(temples.values(), input, {
        filter: (temple) =>
          (!input.orgUnitId || temple.orgUnitId === input.orgUnitId) &&
          (!input.status || temple.status === input.status),
        sortValue: (temple) => templeSortValue(temple, sortBy),
        sortDir,
      })
    },
    async listAllForExport(input: ListTemplesExportInput) {
      const page = await store.list({ ...input, limit: Number.MAX_SAFE_INTEGER })
      return page.items
    },
    async deleteMany(ids: string[]) {
      for (const templeId of ids) {
        const temple = temples.get(templeId)
        if (!temple) continue
        removeTempleFromPhoneIndex(phoneIndex, temple)
        temples.delete(templeId)
      }
    },
  }

  return store
}
