import { createServerFn } from '@tanstack/react-start'
import { DomainError } from '#/domain/errors'
import { memberRepo } from '#/repositories/memberRepo'
import { getInviteByToken } from '#/use-cases/getInviteByToken'
import {
  resumeMemberByCccd,
} from '#/use-cases/resumeMemberByCccd'
import {
  resumeTemplesByPhone,
} from '#/use-cases/resumeTemplesByPhone'
import {
  saveMemberDraft,
} from '#/use-cases/saveMemberDraft'
import {
  saveTempleDraft,
} from '#/use-cases/saveTempleDraft'
import { uploadMemberPhoto } from '#/use-cases/uploadMemberPhoto'
import { assertMemberPhotoInviteScope } from './memberPhotoInviteScope'
import { toErrorPayload } from './mapDomainError'
import {
  validateGetInviteInput,
  validateResumeMemberByCccdInput,
  validateResumeTemplesByPhoneInput,
  validateSaveMemberDraftInput,
  validateSaveTempleDraftInput,
  validateUploadMemberPhotoFnInput,
} from './validators'

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const getInviteFn = createServerFn({ method: 'POST' })
  .validator(validateGetInviteInput)
  .handler(async ({ data }) => {
    try {
      return await getInviteByToken(data.token)
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const saveMemberDraftFn = createServerFn({ method: 'POST' })
  .validator(validateSaveMemberDraftInput)
  .handler(async ({ data }) => {
    try {
      return await saveMemberDraft(data)
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const resumeMemberByCccdFn = createServerFn({ method: 'POST' })
  .validator(validateResumeMemberByCccdInput)
  .handler(async ({ data }) => {
    try {
      return await resumeMemberByCccd(data)
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const saveTempleDraftFn = createServerFn({ method: 'POST' })
  .validator(validateSaveTempleDraftInput)
  .handler(async ({ data }) => {
    try {
      return await saveTempleDraft(data)
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const resumeTemplesByPhoneFn = createServerFn({ method: 'POST' })
  .validator(validateResumeTemplesByPhoneInput)
  .handler(async ({ data }) => {
    try {
      return await resumeTemplesByPhone(data)
    } catch (err) {
      return toErrorPayload(err)
    }
  })

export const uploadMemberPhotoFn = createServerFn({ method: 'POST' })
  .validator(validateUploadMemberPhotoFnInput)
  .handler(async ({ data }) => {
    try {
      const invite = await getInviteByToken(data.token)
      const member = await memberRepo.getById(data.memberId)

      if (!member) {
        throw new DomainError('NOT_FOUND', 'Member not found')
      }

      assertMemberPhotoInviteScope(invite, member)

      return await uploadMemberPhoto({
        memberId: data.memberId,
        cccd: data.cccd,
        bytes: base64ToBytes(data.base64),
        contentType: data.contentType,
      })
    } catch (err) {
      return toErrorPayload(err)
    }
  })
