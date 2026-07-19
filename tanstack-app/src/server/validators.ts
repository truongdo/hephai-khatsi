import { DomainError } from '#/domain/errors'
import type { FormType } from '#/domain/types'
import type { MemberProfilePatch } from '#/repositories/memberRepo'
import type { TempleProfilePatch } from '#/repositories/templeRepo'
import type { ResumeMemberByCccdInput } from '#/use-cases/resumeMemberByCccd'
import type { ResumeTemplesByPhoneInput } from '#/use-cases/resumeTemplesByPhone'
import type { SaveMemberDraftInput } from '#/use-cases/saveMemberDraft'
import type { SaveTempleDraftInput } from '#/use-cases/saveTempleDraft'

const FORM_TYPES = ['temple', 'member_tang', 'member_ni'] as const satisfies readonly FormType[]

function invalidInput(message: string): never {
  throw new DomainError('INVALID_INPUT', message)
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    invalidInput(`${field} must be a string`)
  }
  return value
}

function requireNonEmptyString(value: unknown, field: string): string {
  const str = requireString(value, field)
  if (str.trim().length === 0) {
    invalidInput(`${field} is required`)
  }
  return str
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalidInput(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireFormType(value: unknown, field: string): FormType {
  const formType = requireString(value, field)
  if (!FORM_TYPES.includes(formType as FormType)) {
    invalidInput(`${field} must be a valid form type`)
  }
  return formType as FormType
}

function optionalStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    invalidInput(`${field} must be an array of strings`)
  }
  for (const item of value) {
    if (typeof item !== 'string') {
      invalidInput(`${field} must be an array of strings`)
    }
  }
  return value
}

export type AdminTokenInput = {
  idToken: string
}

export type CreateInviteFnInput = AdminTokenInput & {
  orgUnitId: string
  formType: FormType
}

export type LockMemberFnInput = AdminTokenInput & {
  memberId: string
}

export type LockTempleFnInput = AdminTokenInput & {
  templeId: string
}

export type GetInviteInput = {
  token: string
}

export type UploadMemberPhotoFnInput = {
  token: string
  memberId: string
  cccd: string
  base64: string
  contentType: string
}

export function validateAdminTokenInput(data: unknown): AdminTokenInput {
  const input = requireObject(data, 'input')
  return {
    idToken: requireNonEmptyString(input.idToken, 'idToken'),
  }
}

export function validateCreateInviteFnInput(data: unknown): CreateInviteFnInput {
  const input = requireObject(data, 'input')
  return {
    ...validateAdminTokenInput(input),
    orgUnitId: requireNonEmptyString(input.orgUnitId, 'orgUnitId'),
    formType: requireFormType(input.formType, 'formType'),
  }
}

export function validateLockMemberFnInput(data: unknown): LockMemberFnInput {
  const input = requireObject(data, 'input')
  return {
    ...validateAdminTokenInput(input),
    memberId: requireNonEmptyString(input.memberId, 'memberId'),
  }
}

export function validateLockTempleFnInput(data: unknown): LockTempleFnInput {
  const input = requireObject(data, 'input')
  return {
    ...validateAdminTokenInput(input),
    templeId: requireNonEmptyString(input.templeId, 'templeId'),
  }
}

export function validateGetInviteInput(data: unknown): GetInviteInput {
  const input = requireObject(data, 'input')
  return {
    token: requireNonEmptyString(input.token, 'token'),
  }
}

export function validateSaveMemberDraftInput(data: unknown): SaveMemberDraftInput {
  const input = requireObject(data, 'input')
  return {
    token: requireNonEmptyString(input.token, 'token'),
    cccd: requireNonEmptyString(input.cccd, 'cccd'),
    patch: requireObject(input.patch, 'patch') as MemberProfilePatch,
  }
}

export function validateResumeMemberByCccdInput(
  data: unknown,
): ResumeMemberByCccdInput {
  const input = requireObject(data, 'input')
  return {
    token: requireNonEmptyString(input.token, 'token'),
    cccd: requireNonEmptyString(input.cccd, 'cccd'),
  }
}

export function validateSaveTempleDraftInput(data: unknown): SaveTempleDraftInput {
  const input = requireObject(data, 'input')
  const templeId =
    input.templeId === undefined
      ? undefined
      : requireNonEmptyString(input.templeId, 'templeId')

  return {
    token: requireNonEmptyString(input.token, 'token'),
    templeId,
    patch: requireObject(input.patch, 'patch') as TempleProfilePatch,
    explicitPhones: optionalStringArray(input.explicitPhones, 'explicitPhones'),
  }
}

export function validateResumeTemplesByPhoneInput(
  data: unknown,
): ResumeTemplesByPhoneInput {
  const input = requireObject(data, 'input')
  return {
    token: requireNonEmptyString(input.token, 'token'),
    phone: requireNonEmptyString(input.phone, 'phone'),
  }
}

export function validateUploadMemberPhotoFnInput(
  data: unknown,
): UploadMemberPhotoFnInput {
  const input = requireObject(data, 'input')
  return {
    token: requireNonEmptyString(input.token, 'token'),
    memberId: requireNonEmptyString(input.memberId, 'memberId'),
    cccd: requireNonEmptyString(input.cccd, 'cccd'),
    base64: requireNonEmptyString(input.base64, 'base64'),
    contentType: requireNonEmptyString(input.contentType, 'contentType'),
  }
}
