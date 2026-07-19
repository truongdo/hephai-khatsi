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
import type { Temple } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import type { AdminListPage, ListTemplesAdminInput } from '#/repositories/adminListTypes'

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
  inviteId: string | null
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
  list(input: ListTemplesAdminInput): Promise<AdminListPage<Temple>>
  lock(templeId: string, lockedBy: string): Promise<Temple>
  unlock(templeId: string): Promise<Temple>
}

const PHONE_INDEX_CAP = 20

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

function phoneIndexId(orgUnitId: string, phone: string): string {
  return `${orgUnitId}_${phone}`
}

function templeFromSnap(snap: DocumentSnapshot): Temple {
  return { id: snap.id, ...(snap.data() as Omit<Temple, 'id'>) }
}

function templeData(temple: Temple): Omit<Temple, 'id'> {
  const { id: _id, ...data } = temple
  return data
}

async function createOrUpdateDraft(
  input: CreateOrUpdateTempleDraftInput,
): Promise<{ temple: Temple; mode: 'created' | 'updated' }> {
  const db = requireDb()

  return runTransaction(db, async (transaction) => {
    const now = new Date().toISOString()
    const templeRef = input.templeId
      ? doc(db, COLLECTIONS.temples, input.templeId)
      : doc(collection(db, COLLECTIONS.temples))

    let existing: Temple | null = null
    if (input.templeId) {
      const templeSnap = await transaction.get(templeRef)
      if (!templeSnap.exists()) {
        throw new DomainError('NOT_FOUND', 'Temple not found')
      }
      existing = templeFromSnap(templeSnap)
      if (existing.orgUnitId !== input.orgUnitId) {
        throw new DomainError('FORBIDDEN', 'Temple does not belong to this invite org unit')
      }
      if (existing.status === 'locked') {
        throw new DomainError('RECORD_LOCKED', 'Temple is locked')
      }
    }

    // Firestore transactions require all reads before any writes, so the
    // manager-phone index docs are read up front too.
    const phoneIndexRefs = input.managerPhones.map((phone) =>
      doc(db, COLLECTIONS.templeManagerPhoneIndex, phoneIndexId(input.orgUnitId, phone)),
    )
    const phoneIndexSnaps = await Promise.all(phoneIndexRefs.map((ref) => transaction.get(ref)))

    const temple: Temple = existing
      ? {
          ...existing,
          ...input.patch,
          id: existing.id,
          orgUnitId: existing.orgUnitId,
          status: 'draft',
          managerPhones: input.managerPhones,
          // Re-validated (not frozen) per the current invite token on
          // non-admin (public flow) writes, matching the security rule's
          // re-check. Admin writes pass inviteId: null and preserve
          // whichever invite the record was originally created under.
          inviteId: input.inviteId ?? existing.inviteId,
          createdAt: existing.createdAt,
          updatedAt: now,
          lockedAt: existing.lockedAt,
          lockedBy: existing.lockedBy,
        }
      : {
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

    phoneIndexRefs.forEach((ref, i) => {
      const snap = phoneIndexSnaps[i]!
      const existingIds = (snap.exists() ? (snap.data().templeIds as string[] | undefined) : undefined) ?? []
      if (existingIds.includes(temple.id) || existingIds.length >= PHONE_INDEX_CAP) return
      transaction.set(ref, { templeIds: [...existingIds, temple.id] })
    })

    return existing ? { temple, mode: 'updated' as const } : { temple, mode: 'created' as const }
  })
}

async function getById(templeId: string): Promise<Temple | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.temples, templeId))
  if (!snap.exists()) return null
  return templeFromSnap(snap)
}

async function listByOrgAndPhone(input: TemplePhoneLookupInput): Promise<Temple[]> {
  const db = requireDb()
  const indexSnap = await getDoc(
    doc(db, COLLECTIONS.templeManagerPhoneIndex, phoneIndexId(input.orgUnitId, input.phone)),
  )
  if (!indexSnap.exists()) return []
  const templeIds = (indexSnap.data().templeIds as string[] | undefined) ?? []

  const temples = await Promise.all(
    templeIds.map(async (id) => {
      const snap = await getDoc(doc(db, COLLECTIONS.temples, id))
      return snap.exists() ? templeFromSnap(snap) : null
    }),
  )
  return temples.filter((t): t is Temple => t !== null && t.managerPhones.includes(input.phone))
}

async function list(input: ListTemplesAdminInput): Promise<AdminListPage<Temple>> {
  const db = requireDb()
  const limitValue = input.limit ?? 25
  const constraints: QueryConstraint[] = []
  if (input.orgUnitId) constraints.push(where('orgUnitId', '==', input.orgUnitId))
  if (input.status) constraints.push(where('status', '==', input.status))
  constraints.push(orderBy('updatedAt', 'desc'))
  if (input.cursor) {
    const cursorSnap = await getDoc(doc(db, COLLECTIONS.temples, input.cursor))
    if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap))
  }
  constraints.push(fbLimit(limitValue))

  const snap = await getDocs(query(collection(db, COLLECTIONS.temples), ...constraints))
  const items = snap.docs.map(templeFromSnap)
  const nextCursor = snap.docs.length === limitValue ? snap.docs[snap.docs.length - 1]!.id : null
  return { items, nextCursor }
}

async function lock(templeId: string, lockedBy: string): Promise<Temple> {
  const db = requireDb()
  const templeRef = doc(db, COLLECTIONS.temples, templeId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(templeRef)
    if (!snap.exists()) {
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

async function unlock(templeId: string): Promise<Temple> {
  const db = requireDb()
  const templeRef = doc(db, COLLECTIONS.temples, templeId)

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(templeRef)
    if (!snap.exists()) {
      throw new DomainError('NOT_FOUND', 'Temple not found')
    }
    const existing = templeFromSnap(snap)
    if (existing.status === 'draft') {
      return existing
    }
    const now = new Date().toISOString()
    const temple: Temple = {
      ...existing,
      status: 'draft',
      lockedAt: null,
      lockedBy: null,
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
  list,
  lock,
  unlock,
}
