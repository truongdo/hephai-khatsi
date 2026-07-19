import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import {
  validateCreateInviteFnInput,
  validateGetInviteInput,
  validateSaveMemberDraftInput,
  validateUploadMemberPhotoFnInput,
} from './validators'

describe('server validators', () => {
  it('validateGetInviteInput accepts valid token', () => {
    expect(validateGetInviteInput({ token: 'abc' })).toEqual({ token: 'abc' })
  })

  it('validateGetInviteInput rejects missing token', () => {
    expect(() => validateGetInviteInput({})).toThrow(
      new DomainError('INVALID_INPUT', 'token must be a string'),
    )
  })

  it('validateGetInviteInput rejects non-object input', () => {
    expect(() => validateGetInviteInput(null)).toThrow(
      new DomainError('INVALID_INPUT', 'input must be an object'),
    )
  })

  it('validateCreateInviteFnInput rejects invalid formType', () => {
    expect(() =>
      validateCreateInviteFnInput({
        idToken: 'token',
        orgUnitId: 'gd-i',
        formType: 'invalid',
      }),
    ).toThrow(new DomainError('INVALID_INPUT', 'formType must be a valid form type'))
  })

  it('validateSaveMemberDraftInput requires patch object', () => {
    expect(() =>
      validateSaveMemberDraftInput({
        token: 't',
        cccd: '012345678901',
        patch: null,
      }),
    ).toThrow(new DomainError('INVALID_INPUT', 'patch must be an object'))
  })

  it('validateUploadMemberPhotoFnInput requires all fields', () => {
    expect(
      validateUploadMemberPhotoFnInput({
        token: 't',
        memberId: 'm',
        cccd: '012345678901',
        base64: 'aGVsbG8=',
        contentType: 'image/jpeg',
      }),
    ).toEqual({
      token: 't',
      memberId: 'm',
      cccd: '012345678901',
      base64: 'aGVsbG8=',
      contentType: 'image/jpeg',
    })
  })
})
