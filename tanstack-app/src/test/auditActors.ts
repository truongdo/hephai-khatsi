import type { AuditActor } from '#/domain/auditLog'

export const ADMIN_AUDIT: AuditActor = {
  actorType: 'admin',
  actorId: 'admin-1',
}

export const FILLER_AUDIT: AuditActor = {
  actorType: 'filler',
  actorId: 'filler',
}
