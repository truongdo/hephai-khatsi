export type AuditAction =
  | 'created'
  | 'updated'
  | 'locked'
  | 'unlocked'
  | 'edit_requested'
  | 'photo_uploaded'
  | 'photo_deleted'
  | 'document_uploaded'
  | 'document_deleted'

export type AuditActor = {
  actorType: 'admin' | 'filler'
  actorId: string
}

export type AuditChange = {
  path: string
  before: unknown
  after: unknown
}

export type AuditLogEntry = {
  id: string
  action: AuditAction
  at: string
  actorType: AuditActor['actorType']
  actorId: string
  changes: AuditChange[]
  summary: string | null
}

export type AuditLogWrite = Omit<AuditLogEntry, 'id'>
