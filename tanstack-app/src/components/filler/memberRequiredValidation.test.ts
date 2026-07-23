import { describe, expect, it } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import {
  isBasicEmail,
  validateMemberRequiredFields,
  type MemberRequiredDraft,
} from './memberRequiredValidation'

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '',
}

function filledDraft(
  overrides: Partial<MemberRequiredDraft> = {},
): MemberRequiredDraft {
  return {
    theDanh: 'Nguyễn Văn A',
    phapDanh: 'Minh Tâm',
    ngaySinh: '1990-01-01',
    noiSinh: completeAddress,
    dienThoai: '0901234567',
    email: 'a@b.co',
    diaChiThuongTru: completeAddress,
    ngayXuatGia: '2010-01-01',
    noiXuatGia: completeAddress,
    hienTuHoc: 'Tịnh xá X',
    bonSu: 'TT. Minh',
    ...overrides,
  }
}

describe('isBasicEmail', () => {
  it('accepts simple emails', () => {
    expect(isBasicEmail('a@b.co')).toBe(true)
  })

  it('rejects missing at or domain', () => {
    expect(isBasicEmail('not-an-email')).toBe(false)
    expect(isBasicEmail('a@b')).toBe(false)
    expect(isBasicEmail('')).toBe(false)
  })
})

describe('validateMemberRequiredFields', () => {
  it('fails all text/date/address when blank', () => {
    const result = validateMemberRequiredFields({
      theDanh: '',
      phapDanh: '  ',
      ngaySinh: '',
      noiSinh: { ...EMPTY_ADDRESS_DRAFT },
      dienThoai: '',
      email: '',
      diaChiThuongTru: { ...EMPTY_ADDRESS_DRAFT },
      ngayXuatGia: '',
      noiXuatGia: { ...EMPTY_ADDRESS_DRAFT },
      hienTuHoc: '',
      bonSu: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.theDanh).toBe('REQUIRED')
    expect(result.errors.phapDanh).toBe('REQUIRED')
    expect(result.errors.email).toBe('REQUIRED')
    expect(result.errors.noiSinh).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.diaChiThuongTru).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
  })

  it('marks invalid email format', () => {
    const result = validateMemberRequiredFields(
      filledDraft({ email: 'not-an-email' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.email).toBe('INVALID')
  })

  it('accepts a fully filled draft', () => {
    expect(validateMemberRequiredFields(filledDraft())).toEqual({
      valid: true,
      errors: {},
    })
  })
})
