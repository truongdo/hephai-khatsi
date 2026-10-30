import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import type { OrgUnit } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

export async function upsertAllOrgUnits(
  units: OrgUnit[] = ORG_UNIT_SEED,
  // Overridable so scripts/seed-org-units.ts can pass an authenticated
  // Firestore instance of its own (getClientFirestore() is browser-only).
  db: Firestore = requireDb(),
): Promise<void> {
  const batch = writeBatch(db)
  for (const unit of units) {
    const { id, ...data } = unit
    batch.set(doc(db, COLLECTIONS.orgUnits, id), data, { merge: true })
  }
  await batch.commit()
}

export async function getOrgUnitById(id: string): Promise<OrgUnit | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.orgUnits, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<OrgUnit, 'id'>) }
}

export async function listOrgUnits(): Promise<OrgUnit[]> {
  const snap = await getDocs(
    query(collection(requireDb(), COLLECTIONS.orgUnits), orderBy('order', 'asc')),
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrgUnit, 'id'>) }))
}
