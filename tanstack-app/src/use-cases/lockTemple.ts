import type { AuditActor } from '#/domain/auditLog'
import type { Temple } from '#/domain/types'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type LockTempleInput = {
  templeId: string
  lockedBy: string
  audit: AuditActor
}

export async function lockTemple(
  input: LockTempleInput,
  templeStore: TempleStore = templeRepo,
): Promise<Temple> {
  return templeStore.lock(input.templeId, input.lockedBy, input.audit)
}
