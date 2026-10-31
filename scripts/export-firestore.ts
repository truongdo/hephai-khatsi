import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { applicationDefault, cert, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import {
  FieldPath,
  getFirestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import type { SanghaType } from '../src/domain/types'
import {
  AUDIT_LOGS_FILE,
  auditLogParentFromPath,
  EXPORTED_COLLECTIONS,
  exportValue,
  type ExportedAuditLog,
  type ExportedDoc,
  type ExportManifest,
} from '../src/worker/dataApi/import/exportFormat'
import { EXPORT_ROOT, MANIFEST_FILE, ndjsonPath } from './lib/d1Migration'

// Phase 5 of the D1 migration: every collection the app reads, plus both
// `auditLogs` subcollections, as NDJSON in a git-ignored folder, with
// Firestore's own counts in manifest.json for verify-d1-import. The counts are
// taken after the reads: run it while Firestore is read-only (or expect verify
// to report the records written in between).
//
//   pnpm export:firestore [--out <dir>]
//
// Credentials from .env: FIREBASE_SERVICE_ACCOUNT_JSON (the raw JSON string,
// as for the Worker), else GOOGLE_APPLICATION_CREDENTIALS (a file path).

const PAGE_SIZE = 500
const SANGHA_TYPES: SanghaType[] = ['tang', 'ni']

const { values } = parseArgs({ options: { out: { type: 'string' } } })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) throw new Error('Missing env VITE_FIREBASE_PROJECT_ID')
const exportedAt = new Date().toISOString()
const outDir = values.out ?? join(EXPORT_ROOT, `export-${exportedAt.replaceAll(':', '-')}`)

/** The fields of a service account key file used here (snake_case, as downloaded). */
type ServiceAccountKey = ServiceAccount & { project_id?: string; client_email?: string }

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
const serviceAccount = serviceAccountJson
  ? (JSON.parse(serviceAccountJson) as ServiceAccountKey)
  : null
const account = serviceAccount?.client_email ?? 'GOOGLE_APPLICATION_CREDENTIALS'
if (serviceAccount?.project_id && serviceAccount.project_id !== projectId) {
  throw new Error(
    `Service account ${account} is from project ${serviceAccount.project_id}, not ${projectId}`,
  )
}

function credential() {
  if (serviceAccount) return cert(serviceAccount)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault()
  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env')
}

initializeApp({ credential: credential(), projectId })
const db = getFirestore()

// Fail early with what to fix: the Admin SDK skips the security rules but
// needs an IAM role that can read Firestore.
try {
  await db.collection('orgUnits').limit(1).get()
} catch (error) {
  if ((error as { code?: number }).code !== 7) throw error
  throw new Error(
    `${account} may not read Firestore of ${projectId}: grant it "Cloud Datastore Viewer" ` +
      '(roles/datastore.viewer) in Google Cloud IAM, then run again.',
  )
}

function exportedDoc(snap: QueryDocumentSnapshot): ExportedDoc {
  return { id: snap.id, data: exportValue(snap.data(), snap.ref.path) as Record<string, unknown> }
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
  const parent = auditLogParentFromPath(snap.ref.path)
  return { ...exportedDoc(snap), parentType: parent.type, parentId: parent.id }
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
