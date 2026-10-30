import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore'
import { DomainError } from '#/domain/errors'
import type { Retreat, RetreatStatus, RetreatWritableFields } from '#/domain/retreat'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import type { AdminListPage, ListRetreatsAdminInput } from '#/repositories/adminListTypes'

export type CreateRetreatInput = {
  orgUnitId: string
  createdBy: string
  fields: RetreatWritableFields
}

export type RetreatStore = {
  create(input: CreateRetreatInput): Promise<Retreat>
  update(id: string, fields: RetreatWritableFields): Promise<Retreat>
  setStatus(id: string, status: RetreatStatus): Promise<Retreat>
  getById(id: string): Promise<Retreat | null>
  list(input: ListRetreatsAdminInput): Promise<AdminListPage<Retreat>>
  delete(id: string): Promise<void>
}

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

function retreatFromSnap(snap: DocumentSnapshot): Retreat {
  return { id: snap.id, ...(snap.data() as Omit<Retreat, 'id'>) }
}

function retreatData(retreat: Retreat): Omit<Retreat, 'id'> {
  const { id: _id, ...data } = retreat
  return data
}

async function create(input: CreateRetreatInput): Promise<Retreat> {
  const db = requireDb()
  const ref = doc(collection(db, COLLECTIONS.retreats))
  const now = new Date().toISOString()
  const retreat: Retreat = {
    id: ref.id,
    type: 'giao_doan',
    orgUnitId: input.orgUnitId,
    status: 'draft',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    ...input.fields,
  }
  await setDoc(ref, retreatData(retreat))
  return retreat
}

async function getById(id: string): Promise<Retreat | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.retreats, id))
  if (!snap.exists()) return null
  return retreatFromSnap(snap)
}

async function update(id: string, fields: RetreatWritableFields): Promise<Retreat> {
  const db = requireDb()
  const ref = doc(db, COLLECTIONS.retreats, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }
  const now = new Date().toISOString()
  const existing = retreatFromSnap(snap)
  const retreat: Retreat = {
    ...existing,
    ...fields,
    id: existing.id,
    type: existing.type,
    orgUnitId: existing.orgUnitId,
    status: existing.status,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: now,
  }
  await setDoc(ref, retreatData(retreat))
  return retreat
}

async function setStatus(id: string, status: RetreatStatus): Promise<Retreat> {
  const db = requireDb()
  const ref = doc(db, COLLECTIONS.retreats, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new DomainError('NOT_FOUND', 'Retreat not found')
  }
  const now = new Date().toISOString()
  const existing = retreatFromSnap(snap)
  const retreat: Retreat = {
    ...existing,
    status,
    updatedAt: now,
  }
  await setDoc(ref, retreatData(retreat))
  return retreat
}

async function list(input: ListRetreatsAdminInput): Promise<AdminListPage<Retreat>> {
  const db = requireDb()
  const limitValue = input.limit ?? 25
  const constraints: QueryConstraint[] = []
  if (input.orgUnitId) constraints.push(where('orgUnitId', '==', input.orgUnitId))
  if (input.status) constraints.push(where('status', '==', input.status))
  constraints.push(orderBy('updatedAt', 'desc'))
  if (input.cursor) {
    const cursorSnap = await getDoc(doc(db, COLLECTIONS.retreats, input.cursor))
    if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap))
  }
  constraints.push(fbLimit(limitValue))

  const snap = await getDocs(query(collection(db, COLLECTIONS.retreats), ...constraints))
  const items = snap.docs.map(retreatFromSnap)
  const nextCursor = snap.docs.length === limitValue ? snap.docs[snap.docs.length - 1]!.id : null
  return { items, nextCursor }
}

async function deleteRetreat(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), COLLECTIONS.retreats, id))
}

export const retreatRepo: RetreatStore = {
  create,
  update,
  setStatus,
  getById,
  list,
  delete: deleteRetreat,
}
