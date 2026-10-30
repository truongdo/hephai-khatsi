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
import { normalizeMemberDanhForStorage } from '../src/domain/normalize'
import type { Member, SanghaType } from '../src/domain/types'
import { COLLECTIONS } from '../src/firebase/collections'

const BATCH_LIMIT = 400
const EXPORT_PAGE_SIZE = 100

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

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

function memberDanhPatch(member: Member): Record<string, string> | null {
  const patch: Record<string, string> = {}

  const theDanh = normalizeMemberDanhForStorage(member.theDanh ?? '')
  if (theDanh !== undefined && theDanh !== member.theDanh) {
    patch.theDanh = theDanh
  }

  const phapDanh = normalizeMemberDanhForStorage(member.phapDanh ?? '')
  if (phapDanh !== undefined && phapDanh !== member.phapDanh) {
    patch.phapDanh = phapDanh
  }

  return Object.keys(patch).length > 0 ? patch : null
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

async function backfillMemberDanhUppercase(
  db: Firestore,
  sanghaType: SanghaType,
): Promise<BackfillCounts> {
  const writer = new BatchWriter(db)
  const counts: BackfillCounts = { updated: 0, skipped: 0 }

  for (const member of await listAllMembersForExport(db, sanghaType)) {
    const patch = memberDanhPatch(member)
    if (!patch) {
      counts.skipped++
      continue
    }

    if (dryRun) {
      console.log(`[dry-run] ${member.id}:`, patch)
    } else {
      await writer.update(doc(db, COLLECTIONS.members, member.id), patch)
    }
    counts.updated++
  }

  if (!dryRun) {
    await writer.flush()
  }
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

const tangCounts = await backfillMemberDanhUppercase(db, 'tang')
const niCounts = await backfillMemberDanhUppercase(db, 'ni')

console.log(`Backfill member danh uppercase complete${dryRun ? ' (dry-run)' : ''}`)
console.log(`Members (tang): updated ${tangCounts.updated}, skipped ${tangCounts.skipped}`)
console.log(`Members (ni): updated ${niCounts.updated}, skipped ${niCounts.skipped}`)
console.log(
  `Total updated: ${tangCounts.updated + niCounts.updated}, skipped: ${tangCounts.skipped + niCounts.skipped}`,
)
