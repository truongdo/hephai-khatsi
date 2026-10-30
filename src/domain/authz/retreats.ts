import type { Retreat, RetreatStatus } from '#/domain/retreat'
import { canWriteDirectory, directoryOrgOk, type Caller } from './caller'
import { changedOnly, isString, unchanged } from './docDiff'

// match /retreats/{id}: get by id is public; list goes through
// `canListDirectory`.

const IMMUTABLE_FIELDS = ['type', 'orgUnitId', 'createdBy', 'createdAt']

const STATUS_TRANSITIONS: ReadonlyArray<[RetreatStatus, RetreatStatus]> = [
  ['draft', 'open'],
  ['closed', 'open'],
  ['open', 'closed'],
]

function isValidStatusTransition(from: RetreatStatus, to: RetreatStatus): boolean {
  return STATUS_TRANSITIONS.some(([a, b]) => a === from && b === to)
}

export function canCreateRetreat(caller: Caller, retreat: Retreat): boolean {
  return (
    caller !== null &&
    canWriteDirectory(caller) &&
    retreat.type === 'giao_doan' &&
    retreat.status === 'draft' &&
    isString(retreat.orgUnitId) &&
    directoryOrgOk(caller, retreat.orgUnitId) &&
    retreat.createdBy === caller.uid
  )
}

/** Edits keep the status; a status change touches nothing but `updatedAt`. */
export function canUpdateRetreat(caller: Caller, before: Retreat, after: Retreat): boolean {
  if (!canWriteDirectory(caller) || !directoryOrgOk(caller, before.orgUnitId)) return false
  if (!unchanged(before, after, IMMUTABLE_FIELDS)) return false
  if (before.status === after.status) return true
  return (
    changedOnly(before, after, ['status', 'updatedAt']) &&
    isValidStatusTransition(before.status, after.status)
  )
}

export function canDeleteRetreat(caller: Caller, before: Retreat): boolean {
  return (
    canWriteDirectory(caller) &&
    directoryOrgOk(caller, before.orgUnitId) &&
    before.status === 'draft'
  )
}
