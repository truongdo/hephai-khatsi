import { createServerFn } from '@tanstack/react-start'
import { getAuth } from 'firebase-admin/auth'
import { DomainError } from '#/domain/errors'
import { getAdminApp } from '#/firebase/admin'
import { upsertAllOrgUnits } from '#/repositories/orgUnitRepo'
import { createInvite } from '#/use-cases/createInvite'
import { lockMember } from '#/use-cases/lockMember'
import { lockTemple } from '#/use-cases/lockTemple'
import { toErrorPayload } from './mapDomainError'
import {
  validateAdminTokenInput,
  validateCreateInviteFnInput,
  validateLockMemberFnInput,
  validateLockTempleFnInput,
} from './validators'

export async function assertAdmin(idToken: string): Promise<{ uid: string }> {
  let decoded: { uid: string; admin?: unknown }
  try {
    decoded = await getAuth(getAdminApp()).verifyIdToken(idToken)
  } catch {
    throw new DomainError('UNAUTHORIZED', 'Invalid admin token')
  }

  if (decoded.admin !== true) {
    throw new DomainError('FORBIDDEN', 'Admin claim required')
  }

  return { uid: decoded.uid }
}

export const createInviteFn = createServerFn({ method: 'POST' })
  .validator(validateCreateInviteFnInput)
  .handler(async ({ data }) => {
    try {
      const admin = await assertAdmin(data.idToken)
      return await createInvite({
        orgUnitId: data.orgUnitId,
        formType: data.formType,
        createdBy: admin.uid,
      })
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const lockMemberFn = createServerFn({ method: 'POST' })
  .validator(validateLockMemberFnInput)
  .handler(async ({ data }) => {
    try {
      const admin = await assertAdmin(data.idToken)
      return await lockMember({ memberId: data.memberId, lockedBy: admin.uid })
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const lockTempleFn = createServerFn({ method: 'POST' })
  .validator(validateLockTempleFnInput)
  .handler(async ({ data }) => {
    try {
      const admin = await assertAdmin(data.idToken)
      return await lockTemple({ templeId: data.templeId, lockedBy: admin.uid })
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const seedOrgUnitsFn = createServerFn({ method: 'POST' })
  .validator(validateAdminTokenInput)
  .handler(async ({ data }) => {
    try {
      await assertAdmin(data.idToken)
      await upsertAllOrgUnits()
      return { seeded: true }
    } catch (err) {
      return toErrorPayload(err)
    }
  })
