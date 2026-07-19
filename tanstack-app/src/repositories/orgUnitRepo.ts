import { getAdminDb } from '#/firebase/admin'
import { COLLECTIONS } from '#/firebase/collections'
import type { OrgUnit } from '#/domain/types'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'

export async function upsertAllOrgUnits(
  units: OrgUnit[] = ORG_UNIT_SEED,
): Promise<void> {
  const db = getAdminDb()
  const batch = db.batch()
  for (const unit of units) {
    const { id, ...data } = unit
    batch.set(db.collection(COLLECTIONS.orgUnits).doc(id), data, {
      merge: true,
    })
  }
  await batch.commit()
}

export async function getOrgUnitById(id: string): Promise<OrgUnit | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.orgUnits).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<OrgUnit, 'id'>) }
}
