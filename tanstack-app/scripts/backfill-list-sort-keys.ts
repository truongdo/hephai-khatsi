import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit as fbLimit,
  orderBy,
  query,
  startAfter,
  where,
  writeBatch,
  type Firestore,
  type QueryConstraint,
  type WriteBatch,
} from 'firebase/firestore'
import {
  buildMemberListSortKeys,
  buildTempleListSortKeys,
} from '../src/domain/listSortKeys'
import { ORG_UNIT_SEED } from '../src/domain/orgUnitSeed'
import type { Member, OrgUnit, SanghaType, Temple } from '../src/domain/types'
import { COLLECTIONS } from '../src/firebase/collections'

const BATCH_LIMIT = 400
const EXPORT_PAGE_SIZE = 100

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

function initFirestore(app: ReturnType<typeof initializeApp>): Firestore {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true })
  } catch {
    return getFirestore(app)
  }
}

function templeFromSnap(snap: { id: string; data: () => unknown }): Temple {
  const data = snap.data() as Omit<Temple, 'id' | 'photoPath'> & {
    photoPath?: string | null
  }
  return {
    id: snap.id,
    ...data,
    photoPath: data.photoPath ?? null,
  }
}

function memberFromSnap(snap: { id: string; data: () => unknown }): Member {
  const data = snap.data() as Omit<Member, 'id' | 'photoPath'> & {
    photoPath?: string | null
  }
  return {
    id: snap.id,
    ...data,
    photoPath: data.photoPath ?? null,
  }
}

async function listOrgUnitNameMap(db: Firestore): Promise<Map<string, string>> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.orgUnits), orderBy('order', 'asc')),
  )
  return new Map(
    snap.docs.map((d) => {
      const unit = { id: d.id, ...(d.data() as Omit<OrgUnit, 'id'>) }
      return [unit.id, unit.name] as const
    }),
  )
}

function resolveOrgUnitName(orgUnitId: string, orgUnitNames: Map<string, string>): string {
  return (
    orgUnitNames.get(orgUnitId) ??
    ORG_UNIT_SEED.find((unit) => unit.id === orgUnitId)?.name ??
    orgUnitId
  )
}

async function listAllTemplesForExport(db: Firestore): Promise<Temple[]> {
  const all: Temple[] = []
  let cursor: string | undefined
  for (;;) {
    const constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc')]
    if (cursor) {
      const cursorSnap = await getDoc(doc(db, COLLECTIONS.temples, cursor))
      if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap))
    }
    constraints.push(fbLimit(EXPORT_PAGE_SIZE))

    const snap = await getDocs(query(collection(db, COLLECTIONS.temples), ...constraints))
    const items = snap.docs.map(templeFromSnap)
    all.push(...items)
    if (snap.docs.length < EXPORT_PAGE_SIZE) break
    cursor = snap.docs[snap.docs.length - 1]!.id
  }
  return all
}

async function listAllMembersForExport(
  db: Firestore,
  sanghaType: SanghaType,
): Promise<Member[]> {
  const all: Member[] = []
  let cursor: string | undefined
  for (;;) {
    const constraints: QueryConstraint[] = [
      where('sanghaType', '==', sanghaType),
      orderBy('updatedAt', 'desc'),
    ]
    if (cursor) {
      const cursorSnap = await getDoc(doc(db, COLLECTIONS.members, cursor))
      if (cursorSnap.exists()) constraints.push(startAfter(cursorSnap))
    }
    constraints.push(fbLimit(EXPORT_PAGE_SIZE))

    const snap = await getDocs(query(collection(db, COLLECTIONS.members), ...constraints))
    const items = snap.docs.map(memberFromSnap)
    all.push(...items)
    if (snap.docs.length < EXPORT_PAGE_SIZE) break
    cursor = snap.docs[snap.docs.length - 1]!.id
  }
  return all
}

type BackfillCounts = { updated: number; skipped: number }

class BatchWriter {
  private batch: WriteBatch
  private pending = 0

  constructor(private readonly db: Firestore) {
    this.batch = writeBatch(db)
  }

  async update(ref: ReturnType<typeof doc>, data: Record<string, unknown>): Promise<void> {
    this.batch.update(ref, data)
    this.pending++
    if (this.pending >= BATCH_LIMIT) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.pending === 0) return
    await this.batch.commit()
    this.batch = writeBatch(this.db)
    this.pending = 0
  }
}

function templeSortKeysMatch(temple: Temple, expected: ReturnType<typeof buildTempleListSortKeys>): boolean {
  return (
    (temple.listCityName ?? '') === expected.listCityName &&
    (temple.orgUnitName ?? '') === expected.orgUnitName
  )
}

function memberSortKeysMatch(
  member: Member,
  expected: ReturnType<typeof buildMemberListSortKeys>,
): boolean {
  return (
    (member.orgUnitName ?? '') === expected.orgUnitName &&
    (member.giaoPhamHePhaiRankOrder ?? null) === expected.giaoPhamHePhaiRankOrder
  )
}

async function backfillTempleSortKeys(
  db: Firestore,
  orgUnitNames: Map<string, string>,
): Promise<BackfillCounts> {
  const writer = new BatchWriter(db)
  const counts: BackfillCounts = { updated: 0, skipped: 0 }

  for (const temple of await listAllTemplesForExport(db)) {
    const sortKeys = buildTempleListSortKeys({
      diaChiMoi: temple.diaChiMoi,
      orgUnitName: resolveOrgUnitName(temple.orgUnitId, orgUnitNames),
    })

    if (templeSortKeysMatch(temple, sortKeys)) {
      counts.skipped++
      continue
    }

    await writer.update(doc(db, COLLECTIONS.temples, temple.id), sortKeys)
    counts.updated++
  }

  await writer.flush()
  return counts
}

async function backfillMemberSortKeys(
  db: Firestore,
  orgUnitNames: Map<string, string>,
  sanghaType: SanghaType,
): Promise<BackfillCounts> {
  const writer = new BatchWriter(db)
  const counts: BackfillCounts = { updated: 0, skipped: 0 }

  for (const member of await listAllMembersForExport(db, sanghaType)) {
    const sortKeys = buildMemberListSortKeys({
      sanghaType: member.sanghaType,
      orgUnitName: resolveOrgUnitName(member.orgUnitId, orgUnitNames),
      giaoPhamHePhaiRank: member.giaoPhamHePhai?.rank,
    })

    if (memberSortKeysMatch(member, sortKeys)) {
      counts.skipped++
      continue
    }

    await writer.update(doc(db, COLLECTIONS.members, member.id), sortKeys)
    counts.updated++
  }

  await writer.flush()
  return counts
}

const app = initializeApp({
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
})

await signInWithEmailAndPassword(
  getAuth(app),
  requireEnv('SEED_ADMIN_EMAIL'),
  requireEnv('SEED_ADMIN_PASSWORD'),
)

const db = initFirestore(app)
const orgUnitNames = await listOrgUnitNameMap(db)

const templeCounts = await backfillTempleSortKeys(db, orgUnitNames)
const tangCounts = await backfillMemberSortKeys(db, orgUnitNames, 'tang')
const niCounts = await backfillMemberSortKeys(db, orgUnitNames, 'ni')

console.log('Backfill list-sort keys complete')
console.log(
  `Temples: updated ${templeCounts.updated}, skipped ${templeCounts.skipped}`,
)
console.log(
  `Members (tang): updated ${tangCounts.updated}, skipped ${tangCounts.skipped}`,
)
console.log(`Members (ni): updated ${niCounts.updated}, skipped ${niCounts.skipped}`)
console.log(
  `Total updated: ${templeCounts.updated + tangCounts.updated + niCounts.updated}`,
)
console.log(
  `Total skipped: ${templeCounts.skipped + tangCounts.skipped + niCounts.skipped}`,
)
