import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import type { AdminListPage } from '#/repositories/adminListTypes'

export type RegistrationReviewPatch = {
  status: 'approved' | 'rejected'
  approvedBy: string
  approvedAt: string
  rejectionReason: string | null
  updatedAt: string
}

export type RetreatRegistrationStore = {
  create(reg: RetreatRegistration): Promise<void>
  getById(id: string): Promise<RetreatRegistration | null>
  listByRetreat(input: {
    retreatId: string
    limit?: number
    cursor?: string
  }): Promise<AdminListPage<RetreatRegistration>>
  updateReview(ids: string[], patch: RegistrationReviewPatch): Promise<void>
}

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

function registrationFromSnap(snap: DocumentSnapshot): RetreatRegistration {
  return { id: snap.id, ...(snap.data() as Omit<RetreatRegistration, 'id'>) }
}

function registrationData(reg: RetreatRegistration): Omit<RetreatRegistration, 'id'> {
  const { id: _id, ...data } = reg
  return data
}

async function create(reg: RetreatRegistration): Promise<void> {
  const db = requireDb()
  await setDoc(doc(db, COLLECTIONS.retreatRegistrations, reg.id), registrationData(reg))
}

async function getById(id: string): Promise<RetreatRegistration | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.retreatRegistrations, id))
  if (!snap.exists()) return null
  return registrationFromSnap(snap)
}

async function listByRetreat(input: {
  retreatId: string
  limit?: number
  cursor?: string
}): Promise<AdminListPage<RetreatRegistration>> {
  const db = requireDb()
  const limitValue = input.limit ?? 25
  const constraints: QueryConstraint[] = [
    where('retreatId', '==', input.retreatId),
    orderBy('createdAt', 'desc'),
  ]
  if (input.cursor) {
    const cursorSnap = await getDoc(doc(db, COLLECTIONS.retreatRegistrations, input.cursor))
    if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap))
  }
  constraints.push(fbLimit(limitValue))

  const snap = await getDocs(query(collection(db, COLLECTIONS.retreatRegistrations), ...constraints))
  const items = snap.docs.map(registrationFromSnap)
  const nextCursor = snap.docs.length === limitValue ? snap.docs[snap.docs.length - 1]!.id : null
  return { items, nextCursor }
}

async function updateReview(
  ids: string[],
  patch: RegistrationReviewPatch,
): Promise<void> {
  const db = requireDb()
  const chunkSize = 450
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const batch = writeBatch(db)
    for (const id of chunk) {
      batch.update(doc(db, COLLECTIONS.retreatRegistrations, id), { ...patch })
    }
    await batch.commit()
  }
}

export const retreatRegistrationRepo: RetreatRegistrationStore = {
  create,
  getById,
  listByRetreat,
  updateReview,
}
