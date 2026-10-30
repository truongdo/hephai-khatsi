import type { AuditActor } from '#/domain/auditLog'
import { canListDirectory, type Caller } from '#/domain/authz/caller'
import { normalizeVnPhone } from '#/domain/normalize'
import type { RecordStatus } from '#/domain/types'
import type { AdminSortDir } from '#/repositories/adminListTypes'
import { DomainError } from '#/domain/errors'
import {
  enumField,
  isPlainObject,
  objectField,
  optionalObjectField,
  stringField,
  type Body,
} from '../input'
import type { DataContext } from '../context'
import { authorize, loadInviteExists } from '../records'

export const RECORD_STATUSES: readonly RecordStatus[] = ['draft', 'locked']
export const SORT_DIRS: readonly AdminSortDir[] = ['asc', 'desc']

function parseActor(actor: Body): AuditActor {
  return {
    actorType: enumField(actor, 'actorType', ['admin', 'filler'] as const),
    actorId: stringField(actor, 'actorId'),
  }
}

/** The audit actor the client names; authz (`canCreateAuditLog`) decides if it may. */
export function actorField(body: Body, key: string): AuditActor {
  return parseActor(objectField(body, key))
}

export function optionalActorField(body: Body, key: string): AuditActor | undefined {
  const actor = optionalObjectField(body, key)
  return actor && parseActor(actor)
}

/** The audit actor of a filler's edit request: the normalized phone, else as typed. */
export function actorIdForPhone(phone: string): string {
  try {
    return normalizeVnPhone(phone)
  } catch {
    return phone
  }
}

/**
 * A profile patch without the fields the server sets (they would be
 * overwritten anyway; dropping them keeps them out of the `data` JSON).
 */
export function patchField(
  body: Body,
  protectedFields: readonly string[],
  fieldChecks: PatchFieldChecks,
): Body {
  const patch = { ...objectField(body, 'patch') }
  for (const field of [...protectedFields, 'version']) delete patch[field]
  for (const [field, isValid] of Object.entries(fieldChecks)) {
    if (patch[field] !== undefined && !isValid(patch[field])) {
      throw new DomainError('INVALID_INPUT', `patch.${field} has the wrong type`)
    }
  }
  return patch
}

/** Shape checks for the patch fields that feed columns and sort keys (the rest is stored as given). */
export type PatchFieldChecks = Record<string, (value: unknown) => boolean>

export const isString = (value: unknown): boolean => typeof value === 'string'
export const isNullableString = (value: unknown): boolean => value === null || typeof value === 'string'
export const isObject = (value: unknown): boolean => isPlainObject(value)
export const isStringOrObject = (value: unknown): boolean => isString(value) || isPlainObject(value)

/** `{ rank?: string, ... }` (giáo phẩm records). */
export function isRankRecord(value: unknown): boolean {
  return isPlainObject(value) && (value.rank === undefined || typeof value.rank === 'string')
}

/**
 * Lists not filtered by org unit in the request: hệ phái scope sees every org
 * unit (null), a giáo đoàn admin only their own; anyone else is refused.
 */
export function directoryListScope(caller: Caller): { orgUnitId: string | null } {
  if (canListDirectory(caller, { orgUnitId: null })) return { orgUnitId: null }
  const own = caller?.claims?.orgUnitId ?? null
  authorize(own !== null && canListDirectory(caller, { orgUnitId: own }))
  return { orgUnitId: own }
}

/** Filler "resume by phone" lookups: a directory writer of the org unit, or an existing invite. */
export async function authorizePhoneLookup(
  ctx: DataContext,
  orgUnitId: string,
  inviteToken: string | undefined,
): Promise<void> {
  if (canListDirectory(ctx.caller, { orgUnitId })) return
  const inviteExists = await loadInviteExists(ctx.db, [inviteToken])
  authorize(inviteToken !== undefined && inviteExists(inviteToken))
}
