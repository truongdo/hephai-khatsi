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
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore'
import { DomainError } from '#/domain/errors'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Member, SanghaType } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import type { AdminListPage, ListMembersAdminInput } from '#/repositories/adminListTypes'

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
  >
>

export type CreateOrUpdateMemberDraftInput = {
  orgUnitId: string
  sanghaType: SanghaType
  inviteId: string | null
  cccd: string
  patch: MemberProfilePatch
}

export type MemberLookupInput = {
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
}

export type MemberStore = {
  createOrUpdateDraft(
    input: CreateOrUpdateMemberDraftInput,
  ): Promise<{ member: Member; mode: 'created' | 'updated' }>
  updateDraftById(memberId: string, patch: MemberProfilePatch): Promise<Member>
  getByCccd(input: MemberLookupInput): Promise<Member | null>
  getById(memberId: string): Promise<Member | null>
  list(input: ListMembersAdminInput): Promise<AdminListPage<Member>>
  setPhotoPath(memberId: string, photoPath: string): Promise<Member>
  lock(memberId: string, lockedBy: string): Promise<Member>
  unlock(memberId: string): Promise<Member>
}

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
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

async function createOrUpdateDraft(
  input: CreateOrUpdateMemberDraftInput,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  const db = requireDb()
  const memberId = memberDocId(input.orgUnitId, input.sanghaType, input.cccd)
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    const now = new Date().toISOString()

    if (snap.exists()) {
      const existing = memberFromSnap(snap)
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Member is locked')
      }

      const member: Member = {
        ...existing,
        ...input.patch,
        id: existing.id,
        orgUnitId: existing.orgUnitId,
        sanghaType: existing.sanghaType,
        status: existing.status,
        cccd: existing.cccd,
        // Re-validated (not frozen) per the current invite token, matching
        // the security rule's re-check on every non-admin write.
        inviteId: input.inviteId,
        createdAt: existing.createdAt,
        lockedAt: existing.lockedAt,
        lockedBy: existing.lockedBy,
        updatedAt: now,
      }
      transaction.set(memberRef, memberData(member))
      return { member, mode: 'updated' as const }
    }

    const member: Member = {
      currentTempleId: null,
      photoPath: null,
      ...input.patch,
      id: memberId,
      orgUnitId: input.orgUnitId,
      sanghaType: input.sanghaType,
      status: 'draft',
      cccd: input.cccd,
      inviteId: input.inviteId,
      createdAt: now,
      updatedAt: now,
      lockedAt: null,
      lockedBy: null,
    }
    transaction.set(memberRef, memberData(member))
    return { member, mode: 'created' as const }
  })
}

async function updateDraftById(memberId: string, patch: MemberProfilePatch): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    if (existing.status === 'locked') {
      throw new DomainError('RECORD_LOCKED', 'Member is locked')
    }

    const now = new Date().toISOString()
    const member: Member = {
      ...existing,
      ...patch,
      id: existing.id,
      orgUnitId: existing.orgUnitId,
      sanghaType: existing.sanghaType,
      status: existing.status,
      cccd: existing.cccd,
      inviteId: existing.inviteId,
      createdAt: existing.createdAt,
      lockedAt: existing.lockedAt,
      lockedBy: existing.lockedBy,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))
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

async function list(input: ListMembersAdminInput): Promise<AdminListPage<Member>> {
  const db = requireDb()
  const limitValue = input.limit ?? 25
  const constraints: QueryConstraint[] = [where('sanghaType', '==', input.sanghaType)]
  if (input.orgUnitId) constraints.push(where('orgUnitId', '==', input.orgUnitId))
  if (input.status) constraints.push(where('status', '==', input.status))
  constraints.push(orderBy('updatedAt', 'desc'))
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

async function setPhotoPath(memberId: string, photoPath: string): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    if (existing.status === 'locked') {
      throw new DomainError('RECORD_LOCKED', 'Member is locked')
    }

    const now = new Date().toISOString()
    const member: Member = { ...existing, photoPath, updatedAt: now }
    transaction.set(memberRef, memberData(member))
    return member
  })
}

async function lock(memberId: string, lockedBy: string): Promise<Member> {
  const db = requireDb()
  const memberRef = doc(db, COLLECTIONS.members, memberId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const now = new Date().toISOString()
    const member: Member = {
      ...memberFromSnap(snap),
      status: 'locked',
      lockedAt: now,
      lockedBy,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))
    return member
  })
}

async function unlock(memberId: string): Promise<Member> {
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
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))
    return member
  })
}

export const memberRepo: MemberStore = {
  createOrUpdateDraft,
  updateDraftById,
  getByCccd,
  getById,
  list,
  setPhotoPath,
  lock,
  unlock,
}
