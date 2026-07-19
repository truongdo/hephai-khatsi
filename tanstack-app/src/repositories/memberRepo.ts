import { DomainError } from '#/domain/errors'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import type { Member, SanghaType } from '#/domain/types'
import { getAdminDb } from '#/firebase/admin'
import { COLLECTIONS } from '#/firebase/collections'

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
  inviteId: string
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
  getByCccd(input: MemberLookupInput): Promise<Member | null>
  getById(memberId: string): Promise<Member | null>
  setPhotoPath(memberId: string, photoPath: string): Promise<Member>
  lock(memberId: string, lockedBy: string): Promise<Member>
}

type MemberIndex = {
  memberId: string
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
  createdAt: string
}

function memberFromSnap(snap: FirebaseFirestore.DocumentSnapshot): Member {
  return { id: snap.id, ...(snap.data() as Omit<Member, 'id'>) }
}

function memberData(member: Member): Omit<Member, 'id'> {
  const { id: _id, ...data } = member
  return data
}

async function createOrUpdateDraft(
  input: CreateOrUpdateMemberDraftInput,
): Promise<{ member: Member; mode: 'created' | 'updated' }> {
  const db = getAdminDb()
  const members = db.collection(COLLECTIONS.members)
  const indexes = db.collection(COLLECTIONS.memberCccdIndex)
  const indexId = memberCccdIndexId(
    input.orgUnitId,
    input.sanghaType,
    input.cccd,
  )

  return db.runTransaction(async (transaction) => {
    const indexRef = indexes.doc(indexId)
    const indexSnap = await transaction.get(indexRef)
    const now = new Date().toISOString()

    if (indexSnap.exists) {
      const index = indexSnap.data() as MemberIndex
      const memberRef = members.doc(index.memberId)
      const memberSnap = await transaction.get(memberRef)
      if (!memberSnap.exists) {
        throw new DomainError('NOT_FOUND', 'Member not found')
      }

      const existing = memberFromSnap(memberSnap)
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
        inviteId: existing.inviteId,
        createdAt: existing.createdAt,
        lockedAt: existing.lockedAt,
        lockedBy: existing.lockedBy,
        updatedAt: now,
      }
      transaction.set(memberRef, memberData(member))
      return { member, mode: 'updated' as const }
    }

    const memberRef = members.doc()
    const member: Member = {
      currentTempleId: null,
      photoPath: null,
      ...input.patch,
      id: memberRef.id,
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
    transaction.set(indexRef, {
      memberId: member.id,
      orgUnitId: input.orgUnitId,
      sanghaType: input.sanghaType,
      cccd: input.cccd,
      createdAt: now,
    } satisfies MemberIndex)

    return { member, mode: 'created' as const }
  })
}

async function getByCccd(input: MemberLookupInput): Promise<Member | null> {
  const db = getAdminDb()
  const indexSnap = await db
    .collection(COLLECTIONS.memberCccdIndex)
    .doc(memberCccdIndexId(input.orgUnitId, input.sanghaType, input.cccd))
    .get()

  if (!indexSnap.exists) return null
  const index = indexSnap.data() as MemberIndex
  const memberSnap = await db
    .collection(COLLECTIONS.members)
    .doc(index.memberId)
    .get()

  if (!memberSnap.exists) return null
  return memberFromSnap(memberSnap)
}

async function getById(memberId: string): Promise<Member | null> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.members)
    .doc(memberId)
    .get()

  if (!snap.exists) return null
  return memberFromSnap(snap)
}

async function setPhotoPath(
  memberId: string,
  photoPath: string,
): Promise<Member> {
  const db = getAdminDb()
  const memberRef = db.collection(COLLECTIONS.members).doc(memberId)

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists) {
      throw new DomainError('NOT_FOUND', 'Member not found')
    }

    const existing = memberFromSnap(snap)
    if (existing.status === 'locked') {
      throw new DomainError('RECORD_LOCKED', 'Member is locked')
    }

    const now = new Date().toISOString()
    const member: Member = {
      ...existing,
      photoPath,
      updatedAt: now,
    }
    transaction.set(memberRef, memberData(member))
    return member
  })
}

async function lock(memberId: string, lockedBy: string): Promise<Member> {
  const db = getAdminDb()
  const memberRef = db.collection(COLLECTIONS.members).doc(memberId)

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(memberRef)
    if (!snap.exists) {
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

export const memberRepo: MemberStore = {
  createOrUpdateDraft,
  getByCccd,
  getById,
  setPhotoPath,
  lock,
}
