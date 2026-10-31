import {
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
  type Transaction,
} from 'firebase/firestore'
import type {
  AuditAction,
  AuditActor,
  AuditLogEntry,
  AuditLogWrite,
} from '#/domain/auditLog'
import { buildAuditLogWrite } from '#/domain/auditLogWrite'
import { getClientFirestore } from '#/firebase/firestore'

export { shouldWriteAudit } from '#/domain/auditLogWrite'

export type AuditParent = { collection: 'members' | 'temples'; id: string }

export function auditParentKey(parent: AuditParent): string {
  return `${parent.collection}:${parent.id}`
}

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

function auditLogWriteData(write: AuditLogWrite): AuditLogWrite {
  return write
}

function auditLogFromSnap(snap: DocumentSnapshot): AuditLogEntry {
  return { id: snap.id, ...(snap.data() as Omit<AuditLogEntry, 'id'>) }
}

export function appendAuditLogInTransaction(
  transaction: Transaction,
  parent: AuditParent,
  write: AuditLogWrite,
): void {
  const db = requireDb()
  const ref = doc(collection(db, parent.collection, parent.id, 'auditLogs'))
  transaction.set(ref, auditLogWriteData(write))
}

export function maybeAppendAuditFromDiff(
  transaction: Transaction,
  parent: AuditParent,
  args: {
    action: AuditAction
    actor: AuditActor
    at: string
    before: unknown
    after: unknown
  },
): void {
  const write = buildAuditLogWrite(args)
  if (write) appendAuditLogInTransaction(transaction, parent, write)
}

export async function listAuditLogDocsForCopy(
  parent: AuditParent,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const db = requireDb()
  const snap = await getDocs(
    collection(db, parent.collection, parent.id, 'auditLogs'),
  )
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as Record<string, unknown>,
  }))
}

export function copyAuditLogDocsInTransaction(
  transaction: Transaction,
  to: AuditParent,
  logs: Array<{ id: string; data: Record<string, unknown> }>,
): void {
  const db = requireDb()
  for (const log of logs) {
    transaction.set(
      doc(db, to.collection, to.id, 'auditLogs', log.id),
      log.data,
    )
  }
}

export async function listAuditLogs(
  parent: AuditParent,
  opts: { limit: number; startAfterAt?: string },
): Promise<{ entries: AuditLogEntry[]; nextStartAfterAt: string | null }> {
  const db = requireDb()
  const constraints: QueryConstraint[] = [orderBy('at', 'desc')]
  if (opts.startAfterAt) {
    constraints.push(where('at', '<', opts.startAfterAt))
  }
  constraints.push(fbLimit(opts.limit))

  const snap = await getDocs(
    query(collection(db, parent.collection, parent.id, 'auditLogs'), ...constraints),
  )
  const entries = snap.docs.map(auditLogFromSnap)
  const nextStartAfterAt =
    snap.docs.length === opts.limit ? entries[entries.length - 1]!.at : null
  return { entries, nextStartAfterAt }
}
