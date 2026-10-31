import type { AuditLogEntry } from '#/domain/auditLog'
import { parseInvite } from '#/domain/invite'
import type { Retreat } from '#/domain/retreat'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import type { Invite, Member, OrgUnit, SanghaType, Temple } from '#/domain/types'
import type { AuditLogParent } from '../rows/auditLog'

// The Firestore export of phase 5 of the D1 migration: one NDJSON file per
// collection (scripts/export-firestore.ts), read back by the import and verify
// scripts. The phone index collections are not exported: the import rebuilds
// `members.phone` and `temple_manager_phones` from the records.

export const EXPORTED_COLLECTIONS = [
  'orgUnits',
  'invites',
  'members',
  'temples',
  'retreats',
  'retreatRegistrations',
] as const

export type ExportedCollection = (typeof EXPORTED_COLLECTIONS)[number]

/** Both `auditLogs` subcollections (of members and temples) go to one file. */
export const AUDIT_LOGS_FILE = 'auditLogs'

export type ExportFile = ExportedCollection | typeof AUDIT_LOGS_FILE

/** One NDJSON line: the document id and its fields as Firestore stores them. */
export type ExportedDoc = { id: string; data: Record<string, unknown> }

export type ExportedAuditLog = ExportedDoc & {
  parentType: AuditLogParent['type']
  parentId: string
}

export type FirestoreExport = Record<ExportedCollection, ExportedDoc[]> & {
  auditLogs: ExportedAuditLog[]
}

/** `manifest.json` of an export: Firestore's own counts, for the verify script. */
export type ExportManifest = {
  exportedAt: string
  projectId: string
  counts: Record<ExportFile, number>
  memberCounts: Array<{ orgUnitId: string; sanghaType: SanghaType; count: number }>
  templeCounts: Array<{ orgUnitId: string; count: number }>
}

/** The exported documents as the Firestore repositories read them. */
export type ImportRecords = {
  orgUnits: OrgUnit[]
  invites: Invite[]
  members: Member[]
  temples: Temple[]
  auditLogs: Array<{ parent: AuditLogParent; entry: AuditLogEntry }>
  retreats: Retreat[]
  registrations: RetreatRegistration[]
}

type FirestoreTimestamp = { toDate(): Date; seconds: number; nanoseconds: number }

function isTimestamp(value: object): value is FirestoreTimestamp {
  return 'toDate' in value && 'seconds' in value && 'nanoseconds' in value
}

/**
 * A Firestore field value as export JSON: `Timestamp`s become ISO strings (the
 * app stores ISO strings); anything the app cannot have written (references,
 * geo points, bytes, non-finite numbers) fails rather than being dropped.
 */
export function exportValue(value: unknown, path: string): unknown {
  if (Array.isArray(value)) return value.map((item, i) => exportValue(item, `${path}.${i}`))
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`Non-finite number at ${path}`)
  }
  if (value === null || typeof value !== 'object') return value
  if (isTimestamp(value)) return value.toDate().toISOString()
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`Unsupported Firestore value (${value.constructor.name}) at ${path}`)
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, exportValue(item, `${path}.${key}`)]),
  )
}

/** The parent of an audit log from its path `{members|temples}/{id}/auditLogs/{logId}`. */
export function auditLogParentFromPath(path: string): AuditLogParent {
  const [type, id, subcollection, logId, ...rest] = path.split('/')
  if ((type !== 'members' && type !== 'temples') || !id || subcollection !== 'auditLogs' || !logId || rest.length) {
    throw new Error(`Audit log outside members / temples: ${path}`)
  }
  return { type, id }
}

function withId<T>(doc: ExportedDoc): T {
  return { id: doc.id, ...doc.data } as T
}

/** Same mapping as the `*FromSnap` helpers of `src/repositories/*Repo.ts`. */
export function exportToRecords(exported: FirestoreExport): ImportRecords {
  return {
    orgUnits: exported.orgUnits.map((doc) => withId<OrgUnit>(doc)),
    invites: exported.invites.map((doc) => parseInvite(doc.id, doc.data)),
    members: exported.members.map((doc) => withId<Member>(doc)),
    temples: exported.temples.map((doc) => {
      const temple = withId<Temple>(doc)
      return { ...temple, photoPath: temple.photoPath ?? null }
    }),
    auditLogs: exported.auditLogs.map((doc) => ({
      parent: { type: doc.parentType, id: doc.parentId },
      entry: withId<AuditLogEntry>(doc),
    })),
    retreats: exported.retreats.map((doc) => withId<Retreat>(doc)),
    registrations: exported.retreatRegistrations.map((doc) =>
      withId<RetreatRegistration>(doc),
    ),
  }
}
