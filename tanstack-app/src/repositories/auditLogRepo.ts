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
  AuditChange,
  AuditLogEntry,
  AuditLogWrite,
} from '#/domain/auditLog'
import { buildAuditChanges } from '#/domain/buildAuditChanges'
import { getClientFirestore } from '#/firebase/firestore'

export type AuditParent = { collection: 'members' | 'temples'; id: string }

export function shouldWriteAudit(
  action: AuditAction,
  changes: AuditChange[],
): boolean {
  if (action === 'updated' && changes.length === 0) return false
  return true
}

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
  const changes = buildAuditChanges(args.before, args.after)
  if (!shouldWriteAudit(args.action, changes)) return

  appendAuditLogInTransaction(transaction, parent, {
    action: args.action,
    at: args.at,
    actorType: args.actor.actorType,
    actorId: args.actor.actorId,
    changes,
    summary: changes.length === 0 ? null : String(changes.length),
  })
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
