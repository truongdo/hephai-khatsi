import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import {
  FieldPath,
  getFirestore,
  Timestamp,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import type { SanghaType } from '../src/domain/types'
import {
  AUDIT_LOGS_FILE,
  EXPORTED_COLLECTIONS,
  type ExportedAuditLog,
  type ExportedDoc,
  type ExportManifest,
} from '../src/worker/dataApi/import/exportFormat'
import { EXPORT_ROOT, MANIFEST_FILE, ndjsonPath } from './lib/d1Migration'

// Phase 5 of the D1 migration: every collection the app reads, plus both
// `auditLogs` subcollections, as NDJSON in a git-ignored folder, with
// Firestore's own counts in manifest.json for verify-d1-import.
//
//   GOOGLE_APPLICATION_CREDENTIALS=<service account json> \
//     pnpm export:firestore [--out <dir>]

const PAGE_SIZE = 500
const SANGHA_TYPES: SanghaType[] = ['tang', 'ni']

const { values } = parseArgs({ options: { out: { type: 'string' } } })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) throw new Error('Missing env VITE_FIREBASE_PROJECT_ID')
const exportedAt = new Date().toISOString()
const outDir = values.out ?? join(EXPORT_ROOT, `export-${exportedAt.replaceAll(':', '-')}`)

initializeApp({ credential: applicationDefault(), projectId })
const db = getFirestore()

/** Firestore values as the JSON the web SDK repositories see; nothing is dropped silently. */
function toJson(value: unknown, path: string): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map((item, i) => toJson(item, `${path}.${i}`))
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`Non-finite number at ${path}`)
  }
  if (value === null || typeof value !== 'object') return value
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`Unsupported Firestore value (${value.constructor.name}) at ${path}`)
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toJson(item, `${path}.${key}`)]),
  )
}

function exportedDoc(snap: QueryDocumentSnapshot): ExportedDoc {
  return { id: snap.id, data: toJson(snap.data(), snap.ref.path) as Record<string, unknown> }
}

async function readAll(query: Query): Promise<QueryDocumentSnapshot[]> {
  const docs: QueryDocumentSnapshot[] = []
  let page = query.orderBy(FieldPath.documentId()).limit(PAGE_SIZE)
  for (;;) {
    const snap = await page.get()
    docs.push(...snap.docs)
    if (snap.size < PAGE_SIZE) return docs
    page = query.orderBy(FieldPath.documentId()).startAfter(snap.docs.at(-1)!).limit(PAGE_SIZE)
  }
}

function auditLogDoc(snap: QueryDocumentSnapshot): ExportedAuditLog {
  const parent = snap.ref.parent.parent
  const parentType = parent?.parent.id
  if (!parent || (parentType !== 'members' && parentType !== 'temples')) {
    throw new Error(`Audit log outside members / temples: ${snap.ref.path}`)
  }
  return { ...exportedDoc(snap), parentType, parentId: parent.id }
}

async function count(query: Query): Promise<number> {
  return (await query.count().get()).data().count
}

function writeNdjson(file: Parameters<typeof ndjsonPath>[1], docs: object[]): void {
  writeFileSync(ndjsonPath(outDir, file), docs.map((doc) => `${JSON.stringify(doc)}\n`).join(''))
  console.log(`${file}: ${docs.length}`)
}

mkdirSync(outDir, { recursive: true })

const counts = {} as ExportManifest['counts']
const orgUnitIds: string[] = []
for (const collection of EXPORTED_COLLECTIONS) {
  const docs = (await readAll(db.collection(collection))).map(exportedDoc)
  if (collection === 'orgUnits') orgUnitIds.push(...docs.map((doc) => doc.id))
  writeNdjson(collection, docs)
  counts[collection] = await count(db.collection(collection))
}
const auditLogs = db.collectionGroup('auditLogs')
writeNdjson(AUDIT_LOGS_FILE, (await readAll(auditLogs)).map(auditLogDoc))
counts[AUDIT_LOGS_FILE] = await count(auditLogs)

const memberCounts: ExportManifest['memberCounts'] = []
const templeCounts: ExportManifest['templeCounts'] = []
for (const orgUnitId of orgUnitIds) {
  for (const sanghaType of SANGHA_TYPES) {
    const members = db
      .collection('members')
      .where('orgUnitId', '==', orgUnitId)
      .where('sanghaType', '==', sanghaType)
    memberCounts.push({ orgUnitId, sanghaType, count: await count(members) })
  }
  const temples = db.collection('temples').where('orgUnitId', '==', orgUnitId)
  templeCounts.push({ orgUnitId, count: await count(temples) })
}

const manifest: ExportManifest = { exportedAt, projectId, counts, memberCounts, templeCounts }
writeFileSync(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${outDir}`)
