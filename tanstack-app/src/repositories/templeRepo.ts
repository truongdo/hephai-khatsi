import { DomainError } from '#/domain/errors'
import type { Temple } from '#/domain/types'
import { getAdminDb } from '#/firebase/admin'
import { COLLECTIONS } from '#/firebase/collections'

export type TempleProfilePatch = Partial<
  Omit<
    Temple,
    | 'id'
    | 'orgUnitId'
    | 'status'
    | 'managerPhones'
    | 'inviteId'
    | 'createdAt'
    | 'updatedAt'
    | 'lockedAt'
    | 'lockedBy'
  >
>

export type CreateOrUpdateTempleDraftInput = {
  orgUnitId: string
  inviteId: string
  managerPhones: string[]
  templeId?: string
  patch: TempleProfilePatch
}

export type TemplePhoneLookupInput = {
  orgUnitId: string
  phone: string
}

export type TempleStore = {
  createOrUpdateDraft(
    input: CreateOrUpdateTempleDraftInput,
  ): Promise<{ temple: Temple; mode: 'created' | 'updated' }>
  getById(templeId: string): Promise<Temple | null>
  listByOrgAndPhone(input: TemplePhoneLookupInput): Promise<Temple[]>
  lock(templeId: string, lockedBy: string): Promise<Temple>
}

function templeFromSnap(snap: FirebaseFirestore.DocumentSnapshot): Temple {
  return { id: snap.id, ...(snap.data() as Omit<Temple, 'id'>) }
}

function templeData(temple: Temple): Omit<Temple, 'id'> {
  const { id: _id, ...data } = temple
  return data
}

async function createOrUpdateDraft(
  input: CreateOrUpdateTempleDraftInput,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
  const db = getAdminDb()
  const temples = db.collection(COLLECTIONS.temples)

  return db.runTransaction(async (transaction) => {
    const now = new Date().toISOString()

    if (input.templeId) {
      const templeRef = temples.doc(input.templeId)
      const templeSnap = await transaction.get(templeRef)
      if (!templeSnap.exists) {
        throw new DomainError('NOT_FOUND', 'Temple not found')
      }

      const existing = templeFromSnap(templeSnap)
      if (existing.orgUnitId !== input.orgUnitId) {
        throw new DomainError(
          'FORBIDDEN',
          'Temple does not belong to this invite org unit',
        )
      }
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Temple is locked')
      }

      const temple: Temple = {
        ...existing,
        ...input.patch,
        id: existing.id,
        orgUnitId: existing.orgUnitId,
        status: 'draft',
        managerPhones: input.managerPhones,
        inviteId: existing.inviteId,
        createdAt: existing.createdAt,
        updatedAt: now,
        lockedAt: existing.lockedAt,
        lockedBy: existing.lockedBy,
      }
      transaction.set(templeRef, templeData(temple))
      return { temple, mode: 'updated' as const }
    }

    const templeRef = temples.doc()
    const temple: Temple = {
      ...input.patch,
      id: templeRef.id,
      orgUnitId: input.orgUnitId,
      status: 'draft',
      managerPhones: input.managerPhones,
      inviteId: input.inviteId,
      createdAt: now,
      updatedAt: now,
      lockedAt: null,
      lockedBy: null,
    }
    transaction.set(templeRef, templeData(temple))
    return { temple, mode: 'created' as const }
  })
}

async function getById(templeId: string): Promise<Temple | null> {
  const db = getAdminDb()
  const snap = await db.collection(COLLECTIONS.temples).doc(templeId).get()
  if (!snap.exists) return null
  return templeFromSnap(snap)
}

async function listByOrgAndPhone(
  input: TemplePhoneLookupInput,
): Promise<Temple[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(COLLECTIONS.temples)
    .where('orgUnitId', '==', input.orgUnitId)
    .where('managerPhones', 'array-contains', input.phone)
    .get()

  return snap.docs.map(templeFromSnap)
}

async function lock(templeId: string, lockedBy: string): Promise<Temple> {
  const db = getAdminDb()
  const templeRef = db.collection(COLLECTIONS.temples).doc(templeId)

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(templeRef)
    if (!snap.exists) {
      throw new DomainError('NOT_FOUND', 'Temple not found')
    }

    const now = new Date().toISOString()
    const temple: Temple = {
      ...templeFromSnap(snap),
      status: 'locked',
      lockedAt: now,
      lockedBy,
      updatedAt: now,
    }
    transaction.set(templeRef, templeData(temple))
    return temple
  })
}

export const templeRepo: TempleStore = {
  createOrUpdateDraft,
  getById,
  listByOrgAndPhone,
  lock,
}
