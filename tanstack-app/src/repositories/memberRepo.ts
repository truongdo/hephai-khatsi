import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
  type Transaction,
} from 'firebase/firestore'
import { DomainError } from '#/domain/errors'
import type { AuditActor } from '#/domain/auditLog'
import { buildMemberDerivedSortFields } from '#/domain/listSortKeys'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
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
import type { Member, SanghaType } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import type {
  AdminListPage,
  ListMembersAdminInput,
  ListMembersExportInput,
} from '#/repositories/adminListTypes'
import {
  maybeAppendAuditFromDiff,
  copyAuditLogDocsInTransaction,
  listAuditLogDocsForCopy,
} from '#/repositories/auditLogRepo'
import { getOrgUnitById } from '#/repositories/orgUnitRepo'

export type MemberProfilePatch = Partial<
  Omit<
    Member,
    | 'id'
    | 'orgUnitId'
    | 'sanghaType'
    | 'status'
    | 'cccd'
    | 'inviteId'
    | 'createdAt'
    | 'updatedAt'
    | 'lockedAt'
    | 'lockedBy'
    | 'orgUnitName'
    | 'giaoPhamHePhaiRankOrder'
    | 'sapXepHaLap'
  >
>

export type CreateOrUpdateMemberDraftInput = {
  orgUnitId: string
  sanghaType: SanghaType
  inviteId: string | null
  cccd: string
  patch: MemberProfilePatch
  audit?: AuditActor
}

export type CreateOrUpdateMemberAndLockInput = CreateOrUpdateMemberDraftInput & {
  audit: AuditActor
}

export type MemberLookupInput = {
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
}

export type MemberPhoneLookupInput = {
  orgUnitId: string
  sanghaType: SanghaType
  phone: string
}

export type MemberStore = {
  createOrUpdateDraft(
    input: CreateOrUpdateMemberDraftInput,
  ): Promise<{ member: Member; mode: 'created' | 'updated' }>
  createOrUpdateAndLock(
    input: CreateOrUpdateMemberAndLockInput,
  ): Promise<{ member: Member; mode: 'created' | 'updated' }>
  requestEdit(memberId: string, phone: string): Promise<Member>
  updateDraftById(
    memberId: string,
    patch: MemberProfilePatch,
    options?: {
      allowWhenLocked?: boolean
      allowOrgUnitChange?: boolean
      orgUnitId?: string
      audit?: AuditActor
    },
  ): Promise<Member>
  getByCccd(input: MemberLookupInput): Promise<Member | null>
  getById(memberId: string): Promise<Member | null>
  listByOrgSanghaAndPhone(input: MemberPhoneLookupInput): Promise<Member[]>
  list(input: ListMembersAdminInput): Promise<AdminListPage<Member>>
  listAllForExport(input: ListMembersExportInput): Promise<Member[]>
  listByCurrentTempleIds(templeIds: string[]): Promise<Member[]>
  deleteMany(ids: string[]): Promise<void>
  setPhotoPath(
    memberId: string,
    photoPath: string | null,
    audit: AuditActor,
  ): Promise<Member>
  setDocumentPaths(memberId: string, documents: MemberDocuments): Promise<Member>
  mergeDocumentSide(
    memberId: string,
    typeId: DocumentTypeId,
    side: DocumentSide,
    filePath: string,
    audit: AuditActor,
  ): Promise<{ member: Member; previousPath?: string }>
  removeDocumentPaths(
    memberId: string,
    typeId: DocumentTypeId,
    side: DocumentSide | undefined,
    audit: AuditActor,
  ): Promise<{ member: Member; removedPaths: string[] }>
  lock(memberId: string, lockedBy: string, audit: AuditActor): Promise<Member>
  unlock(memberId: string, audit: AuditActor): Promise<Member>
  listDirectorySecretaries(): Promise<Member[]>
  listHePhaiSecretaries(): Promise<Member[]>
}

const PHONE_INDEX_CAP = 20
const IN_QUERY_LIMIT = 30

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

async function readPhoneIndexForTransaction(
  transaction: Transaction,
  orgUnitId: string,
  sanghaType: SanghaType,
  rawPhone: string | undefined,
) {
  if (!rawPhone) return null
  let phone: string
  try {
    phone = normalizeVnPhone(rawPhone)
  } catch {
    return null
  }
  const ref = doc(
    requireDb(),
    COLLECTIONS.memberPhoneIndex,
    memberPhoneIndexId(orgUnitId, sanghaType, phone),
  )
  const snap = await transaction.get(ref)
  return { ref, snap, phone }
}

function writePhoneIndex(
  transaction: Transaction,
  index: { ref: DocumentReference; snap: DocumentSnapshot } | null,
  memberId: string,
) {
  if (!index) return
  const existingIds =
    (index.snap.exists()
      ? (index.snap.data()?.memberIds as string[] | undefined)
      : undefined) ?? []
  if (existingIds.includes(memberId) || existingIds.length >= PHONE_INDEX_CAP) {
    return
  }
  transaction.set(index.ref, { memberIds: [...existingIds, memberId] })
}

function shrinkPhoneIndex(
  transaction: Transaction,
  index: { ref: DocumentReference; snap: DocumentSnapshot } | null,
  memberId: string,
) {
  if (!index?.snap.exists()) return
  const existingIds = (index.snap.data()?.memberIds as string[] | undefined) ?? []
  const nextIds = existingIds.filter((id) => id !== memberId)
  if (nextIds.length === existingIds.length) return
  if (nextIds.length === 0) {
    transaction.delete(index.ref)
  } else {
    transaction.set(index.ref, { memberIds: nextIds })
  }
}

// Member doc ids are deterministic ({orgUnitId}_{sanghaType}_{cccd}), which
// is what lets the "resume by CCCD" flow be authorized with a security rule
// (a single get() by a constructed path) instead of a separate index
// collection. See firebase/firestore.rules.
function memberDocId(orgUnitId: string, sanghaType: SanghaType, cccd: string): string {
  return memberCccdIndexId(orgUnitId, sanghaType, cccd)
}

function memberFromSnap(snap: DocumentSnapshot): Member {
  return { id: snap.id, ...(snap.data() as Omit<Member, 'id'>) }
}

function memberData(member: Member): Omit<Member, 'id'> {
  const { id: _id, ...data } = member
  return data
}

async function resolveOrgUnitName(orgUnitId: string): Promise<string> {
  const unit = await getOrgUnitById(orgUnitId)
  if (unit) return unit.name
  const seeded = ORG_UNIT_SEED.find((u) => u.id === orgUnitId)
  return seeded?.name ?? orgUnitId
}

function applyMemberListSortKeys(
  member: Member,
  orgUnitName: string,
): Member {
  return {
    ...member,
    ...buildMemberDerivedSortFields(member, orgUnitName),
  }
}

async function createOrUpdateMember(
  input: CreateOrUpdateMemberDraftInput,
  options: { lock: boolean },
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  const db = requireDb()
  const memberId = memberDocId(input.orgUnitId, input.sanghaType, input.cccd)
  const memberRef = doc(db, COLLECTIONS.members, memberId)
  const orgUnitName = await resolveOrgUnitName(input.orgUnitId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    const now = new Date().toISOString()

    let member: Member
    let mode: 'created' | 'updated'
    const existing = snap.exists() ? memberFromSnap(snap) : null

    if (snap.exists()) {
      const existingMember = existing!
      if (existingMember.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }

      member = {
        ...existingMember,
        ...input.patch,
        id: existingMember.id,
        orgUnitId: existingMember.orgUnitId,
        sanghaType: existingMember.sanghaType,
        status: options.lock ? 'locked' : existingMember.status,
        cccd: existingMember.cccd,
        // Re-validated (not frozen) per the current invite token, matching
        // the security rule's re-check on every non-admin write.
        inviteId: input.inviteId,
        createdAt: existingMember.createdAt,
        lockedAt: options.lock ? now : existingMember.lockedAt,
        lockedBy: options.lock ? 'filler' : existingMember.lockedBy,
        editRequestedAt: options.lock ? null : existingMember.editRequestedAt,
        editRequestedBy: options.lock ? null : existingMember.editRequestedBy,
        updatedAt: now,
      }
      mode = 'updated'
    } else {
      member = {
        currentTempleId: null,
        photoPath: null,
        ...input.patch,
        id: memberId,
        orgUnitId: input.orgUnitId,
        sanghaType: input.sanghaType,
        status: options.lock ? 'locked' : 'draft',
        cccd: input.cccd,
        inviteId: input.inviteId,
        createdAt: now,
        updatedAt: now,
        lockedAt: options.lock ? now : null,
        lockedBy: options.lock ? 'filler' : null,
        editRequestedAt: null,
        editRequestedBy: null,
      }
      mode = 'created'
    }

    member = applyMemberListSortKeys(member, orgUnitName)

    // Firestore transactions require all reads before any writes.
    const phoneIndex = await readPhoneIndexForTransaction(
      transaction,
      member.orgUnitId,
      member.sanghaType,
      member.dienThoai,
    )

    transaction.set(memberRef, memberData(member))
    writePhoneIndex(transaction, phoneIndex, member.id)

    if (input.audit) {
      maybeAppendAuditFromDiff(
        transaction,
        { collection: 'members', id: memberId },
        {
          action: mode,
          actor: input.audit,
          at: now,
          before: existing,
          after: member,
        },
      )
    }

    return { member, mode }
  })
}

async function createOrUpdateDraft(
  input: CreateOrUpdateMemberDraftInput,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  return createOrUpdateMember(input, { lock: false })
}

async function createOrUpdateAndLock(
  input: CreateOrUpdateMemberAndLockInput,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  return createOrUpdateMember(input, { lock: true })
}

async function requestEdit(memberId: string, phone: string): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    if (existing.status !== 'locked') {
      throw new DomainError('INVALID_STATUS', 'Member is not locked')
    }
    if (existing.editRequestedAt) {
      return existing
    }

    const now = new Date().toISOString()
    const member: Member = {
      ...existing,
      editRequestedAt: now,
      editRequestedBy: phone,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))

    let actorId = phone
    try {
      actorId = normalizeVnPhone(phone)
    } catch {
      // keep raw phone
    }
    maybeAppendAuditFromDiff(
      transaction,
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
  })
}

async function updateDraftById(
  memberId: string,
  patch: MemberProfilePatch,
  options?: {
    allowWhenLocked?: boolean
    allowOrgUnitChange?: boolean
    orgUnitId?: string
    audit?: AuditActor
  },
): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  const peekSnap = await getDoc(memberRef)
  let logsToCopy: Array<{ id: string; data: Record<string, unknown> }> = []
  if (
    options?.allowOrgUnitChange &&
    options.orgUnitId &&
    peekSnap.exists() &&
    peekSnap.data()?.orgUnitId !== options.orgUnitId
  ) {
    logsToCopy = await listAuditLogDocsForCopy({
      collection: 'members',
      id: memberId,
    })
  }

  const nextOrgUnitIdForSort =
    options?.orgUnitId ??
    (peekSnap.exists() ? memberFromSnap(peekSnap).orgUnitId : undefined)
  const orgUnitName = nextOrgUnitIdForSort
    ? await resolveOrgUnitName(nextOrgUnitIdForSort)
    : ''

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    if (existing.status === 'locked' && !options?.allowWhenLocked) {
      throw new DomainError('RECORD_LOCKED', 'Member is locked')
    }

    const nextOrgUnitId = options?.orgUnitId ?? existing.orgUnitId
    const orgChanged = nextOrgUnitId !== existing.orgUnitId
    if (orgChanged && !options?.allowOrgUnitChange) {
      throw new DomainError('FORBIDDEN', 'Cannot change member org unit')
    }

    const nextId = orgChanged
      ? memberDocId(nextOrgUnitId, existing.sanghaType, existing.cccd)
      : existing.id
    const nextRef = orgChanged
      ? doc(db, COLLECTIONS.members, nextId)
      : memberRef

    if (orgChanged) {
      const nextSnap = await transaction.get(nextRef)
      if (nextSnap.exists()) {
        throw new DomainError(
          'ALREADY_EXISTS',
          'A member with this CCCD already exists in the target org unit',
        )
      }
    }

    const now = new Date().toISOString()
    let member: Member = {
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
    }
    member = applyMemberListSortKeys(member, orgUnitName)

    // Firestore transactions require all reads before any writes.
    const newPhoneIndex = await readPhoneIndexForTransaction(
      transaction,
      member.orgUnitId,
      member.sanghaType,
      member.dienThoai,
    )
    const oldPhoneIndex =
      orgChanged
        ? await readPhoneIndexForTransaction(
            transaction,
            existing.orgUnitId,
            existing.sanghaType,
            existing.dienThoai,
          )
        : null

    if (orgChanged) {
      transaction.delete(memberRef)
      copyAuditLogDocsInTransaction(
        transaction,
        { collection: 'members', id: nextId },
        logsToCopy,
      )
    }
    transaction.set(nextRef, memberData(member))
    if (oldPhoneIndex) {
      shrinkPhoneIndex(transaction, oldPhoneIndex, existing.id)
    }
    writePhoneIndex(transaction, newPhoneIndex, member.id)

    if (options?.audit) {
      maybeAppendAuditFromDiff(
        transaction,
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
  })
}

async function getByCccd(input: MemberLookupInput): Promise<Member | null> {
  const db = requireDb()
  const snap = await getDoc(
    doc(db, COLLECTIONS.members, memberDocId(input.orgUnitId, input.sanghaType, input.cccd)),
  )
  if (!snap.exists()) return null
  return memberFromSnap(snap)
}

async function getById(memberId: string): Promise<Member | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.members, memberId))
  if (!snap.exists()) return null
  return memberFromSnap(snap)
}

async function listByOrgSanghaAndPhone(input: MemberPhoneLookupInput): Promise<Member[]> {
  const db = requireDb()
  const phone = input.phone // already normalized by use-case
  const indexSnap = await getDoc(
    doc(
      db,
      COLLECTIONS.memberPhoneIndex,
      memberPhoneIndexId(input.orgUnitId, input.sanghaType, phone),
    ),
  )
  if (!indexSnap.exists()) return []
  const memberIds = (indexSnap.data().memberIds as string[] | undefined) ?? []
  const members = await Promise.all(
    memberIds.map(async (id) => {
      const snap = await getDoc(doc(db, COLLECTIONS.members, id))
      return snap.exists() ? memberFromSnap(snap) : null
    }),
  )
  return members.filter((m): m is Member => {
    if (!m) return false
    if (m.orgUnitId !== input.orgUnitId || m.sanghaType !== input.sanghaType) {
      return false
    }
    try {
      return normalizeVnPhone(m.dienThoai ?? '') === phone
    } catch {
      return false
    }
  })
}

async function list(input: ListMembersAdminInput): Promise<AdminListPage<Member>> {
  const db = requireDb()
  const limitValue = input.limit ?? 25
  const constraints: QueryConstraint[] = [where('sanghaType', '==', input.sanghaType)]
  if (input.orgUnitId) constraints.push(where('orgUnitId', '==', input.orgUnitId))
  if (input.status) constraints.push(where('status', '==', input.status))
  const sortBy = input.sortBy ?? 'updatedAt'
  const sortDir = input.sortDir ?? 'desc'
  constraints.push(orderBy(sortBy, sortDir))
  if (input.cursor) {
    const cursorSnap = await getDoc(doc(db, COLLECTIONS.members, input.cursor))
    if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap))
  }
  constraints.push(fbLimit(limitValue))

  const snap = await getDocs(query(collection(db, COLLECTIONS.members), ...constraints))
  const items = snap.docs.map(memberFromSnap)
  const nextCursor = snap.docs.length === limitValue ? snap.docs[snap.docs.length - 1]!.id : null
  return { items, nextCursor }
}

const EXPORT_PAGE_SIZE = 100

async function listAllForExport(input: ListMembersExportInput): Promise<Member[]> {
  const all: Member[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await list({
      sanghaType: input.sanghaType,
      orgUnitId: input.orgUnitId,
      status: input.status,
      limit: EXPORT_PAGE_SIZE,
      cursor,
    })
    all.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return all
}

async function listByCurrentTempleIds(templeIds: string[]): Promise<Member[]> {
  if (templeIds.length === 0) return []
  const db = requireDb()
  const seen = new Set<string>()
  const results: Member[] = []

  for (const idChunk of chunk(templeIds, IN_QUERY_LIMIT)) {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.members),
        where('currentTempleId', 'in', idChunk),
      ),
    )
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue
      seen.add(docSnap.id)
      results.push(memberFromSnap(docSnap))
    }
  }

  return results
}

async function deleteMany(ids: string[]): Promise<void> {
  const db = requireDb()

  for (const memberId of ids) {
    await runTransaction(db, async (transaction) => {
      const memberRef = doc(db, COLLECTIONS.members, memberId)
      const snap = await transaction.get(memberRef)
      if (!snap.exists()) return

      const member = memberFromSnap(snap)

      const phoneIndex = await readPhoneIndexForTransaction(
        transaction,
        member.orgUnitId,
        member.sanghaType,
        member.dienThoai,
      )
      shrinkPhoneIndex(transaction, phoneIndex, memberId)
      transaction.delete(memberRef)
    })
  }
}

async function setPhotoPath(
  memberId: string,
  photoPath: string | null,
  audit: AuditActor,
): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)

    const now = new Date().toISOString()
    const member: Member = { ...existing, photoPath, updatedAt: now }
    transaction.set(memberRef, memberData(member))

    maybeAppendAuditFromDiff(
      transaction,
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
  })
}

async function setDocumentPaths(
  memberId: string,
  documents: MemberDocuments,
): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)

    const now = new Date().toISOString()
    const member: Member = { ...existing, documents, updatedAt: now }
    transaction.set(memberRef, memberData(member))
    return member
  })
}

async function mergeDocumentSide(
  memberId: string,
  typeId: DocumentTypeId,
  side: DocumentSide,
  filePath: string,
  audit: AuditActor,
): Promise<{ member: Member; previousPath?: string }> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)
  const pathField = pathFieldForSide(side)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    const current = existing.documents ?? {}
    const previousPath = current[typeId]?.[pathField]
    const documents = mergeDocumentPath(current, typeId, side, filePath)

    const now = new Date().toISOString()
    const member: Member = { ...existing, documents, updatedAt: now }
    transaction.set(memberRef, memberData(member))

    maybeAppendAuditFromDiff(
      transaction,
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
  })
}

async function removeDocumentPaths(
  memberId: string,
  typeId: DocumentTypeId,
  side: DocumentSide | undefined,
  audit: AuditActor,
): Promise<{ member: Member; removedPaths: string[] }> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
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

    const now = new Date().toISOString()
    const member: Member = { ...existing, documents, updatedAt: now }
    transaction.set(memberRef, memberData(member))

    maybeAppendAuditFromDiff(
      transaction,
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
  })
}

async function lock(
  memberId: string,
  lockedBy: string,
  audit: AuditActor,
): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    const now = new Date().toISOString()
    const member: Member = {
      ...existing,
      status: 'locked',
      lockedAt: now,
      lockedBy,
      editRequestedAt: null,
      editRequestedBy: null,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))

    maybeAppendAuditFromDiff(
      transaction,
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
  })
}

async function listDirectorySecretaries(): Promise<Member[]> {
  const db = requireDb()
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.members),
      where('directoryRole', '==', 'giao_doan_admin'),
      fbLimit(200),
    ),
  )
  return snap.docs.map(memberFromSnap)
}

async function listHePhaiSecretaries(): Promise<Member[]> {
  const db = requireDb()
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.members),
      where('directoryRole', '==', 'he_phai_secretary'),
      fbLimit(200),
    ),
  )
  return snap.docs.map(memberFromSnap)
}

async function unlock(memberId: string, audit: AuditActor): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }
    const existing = memberFromSnap(snap)
    if (existing.status === 'draft') {
      return existing
    }
    const now = new Date().toISOString()
    const member: Member = {
      ...existing,
      status: 'draft',
      lockedAt: null,
      lockedBy: null,
      editRequestedAt: null,
      editRequestedBy: null,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))

    maybeAppendAuditFromDiff(
      transaction,
      { collection: 'members', id: memberId },
      {
        action: 'unlocked',
        actor: audit,
        at: now,
        before: existing,
        after: member,
      },
    )

    return member
  })
}

export const memberRepo: MemberStore = {
  createOrUpdateDraft,
  createOrUpdateAndLock,
  requestEdit,
  updateDraftById,
  getByCccd,
  getById,
  listByOrgSanghaAndPhone,
  list,
  listAllForExport,
  listByCurrentTempleIds,
  deleteMany,
  setPhotoPath,
  setDocumentPaths,
  mergeDocumentSide,
  removeDocumentPaths,
  lock,
  unlock,
  listDirectorySecretaries,
  listHePhaiSecretaries,
}
