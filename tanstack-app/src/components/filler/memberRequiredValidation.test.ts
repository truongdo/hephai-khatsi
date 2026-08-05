import { describe, expect, it } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import {
  isBasicEmail,
  validateMemberRequiredFields,
  type MemberRequiredDraft,
} from './memberRequiredValidation'

const completeCccdDocuments = {
  cccd: {
    frontPath: 'members/m1/docs/cccd/front.jpg',
    backPath: 'members/m1/docs/cccd/back.jpg',
  },
}

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '',
}

const emptyFamilyPerson = {
  hoTen: '',
  namSinh: '',
  ngheNghiep: '',
  noiO: '',
}

const filledFamilyPerson = {
  hoTen: 'Nguyễn Văn B',
  namSinh: '1960',
  ngheNghiep: 'Nông',
  noiO: 'Hà Nội',
}

function filledDraft(
  overrides: Partial<MemberRequiredDraft> = {},
): MemberRequiredDraft {
  return {
    cccd: '012345678901',
    theDanh: 'Nguyễn Văn A',
    phapDanh: 'Minh Tâm',
    ngaySinh: '1990-01-01',
    noiSinh: completeAddress,
    dienThoai: '0901234567',
    email: 'a@b.co',
    diaChiThuongTru: completeAddress,
    ngayXuatGia: '2010-01-01',
    noiXuatGia: { ...completeAddress, line: 'Tịnh xá A' },
    hienTuHoc: 'Tịnh xá X',
    bonSu: 'TT. Minh',
    photoPath: 'members/m1/photo.jpg',
    pendingPhoto: null,
    giaDinh: { cha: filledFamilyPerson, me: filledFamilyPerson },
    documents: completeCccdDocuments,
    pendingDocuments: {},
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
      cccd: '',
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
      photoPath: null,
      pendingPhoto: null,
      giaDinh: { cha: emptyFamilyPerson, me: emptyFamilyPerson },
      documents: {},
      pendingDocuments: {},
    })
    expect(result.valid).toBe(false)
    expect(result.errors.cccd).toBe('REQUIRED')
    expect(result.errors.theDanh).toBe('REQUIRED')
    expect(result.errors.phapDanh).toBe('REQUIRED')
    expect(result.errors.email).toBe('REQUIRED')
    expect(result.errors.photo).toBe('REQUIRED')
    expect(result.errors.noiSinh).toEqual({
      city: 'REQUIRED',
    })
    expect(result.errors.diaChiThuongTru).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.giaDinh?.cha).toEqual({
      hoTen: 'REQUIRED',
      namSinh: 'REQUIRED',
      ngheNghiep: 'REQUIRED',
      noiO: 'REQUIRED',
    })
    expect(result.errors.giaDinh?.me).toEqual({
      hoTen: 'REQUIRED',
      namSinh: 'REQUIRED',
      ngheNghiep: 'REQUIRED',
      noiO: 'REQUIRED',
    })
  })

  it('requires CCCD number', () => {
    const result = validateMemberRequiredFields(filledDraft({ cccd: '  ' }))
    expect(result.valid).toBe(false)
    expect(result.errors.cccd).toBe('REQUIRED')
  })

  it('rejects CCCD with wrong digit length', () => {
    const result = validateMemberRequiredFields(filledDraft({ cccd: '12345' }))
    expect(result.valid).toBe(false)
    expect(result.errors.cccd).toBe('INVALID')
  })

  it('accepts spaced CCCD with 9–12 digits', () => {
    expect(
      validateMemberRequiredFields(filledDraft({ cccd: '0123 456 78901' })),
    ).toEqual({ valid: true, errors: {} })
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

  it('accepts noiSinh with city only', () => {
    expect(
      validateMemberRequiredFields(
        filledDraft({
          noiSinh: {
            ...EMPTY_ADDRESS_DRAFT,
            cityCode: '01',
            cityName: 'Hà Nội',
          },
        }),
      ),
    ).toEqual({ valid: true, errors: {} })
  })

  it('requires portrait when no photoPath or pendingPhoto', () => {
    const result = validateMemberRequiredFields(
      filledDraft({ photoPath: null, pendingPhoto: null }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.photo).toBe('REQUIRED')
  })

  it('accepts pending portrait file without photoPath', () => {
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })
    expect(
      validateMemberRequiredFields(
        filledDraft({ photoPath: null, pendingPhoto: file }),
      ),
    ).toEqual({ valid: true, errors: {} })
  })

  it('requires all cha and me fields', () => {
    const result = validateMemberRequiredFields(
      filledDraft({
        giaDinh: { cha: emptyFamilyPerson, me: emptyFamilyPerson },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.giaDinh?.cha).toEqual({
      hoTen: 'REQUIRED',
      namSinh: 'REQUIRED',
      ngheNghiep: 'REQUIRED',
      noiO: 'REQUIRED',
    })
    expect(result.errors.giaDinh?.me).toEqual({
      hoTen: 'REQUIRED',
      namSinh: 'REQUIRED',
      ngheNghiep: 'REQUIRED',
      noiO: 'REQUIRED',
    })
  })

  it('requires noiXuatGia line', () => {
    const result = validateMemberRequiredFields(
      filledDraft({
        noiXuatGia: { ...completeAddress, line: '' },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.noiXuatGia?.line).toBe('REQUIRED')
  })

  it('requires both CCCD document sides', () => {
    const result = validateMemberRequiredFields(
      filledDraft({ documents: {}, pendingDocuments: {} }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.cccdDocument).toBe('REQUIRED')
  })

  it('requires CCCD back when only front path exists', () => {
    const result = validateMemberRequiredFields(
      filledDraft({
        documents: {
          cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.cccdDocument).toBe('REQUIRED')
  })

  it('accepts pending CCCD front and back without paths', () => {
    const front = new File(['a'], 'front.jpg', { type: 'image/jpeg' })
    const back = new File(['b'], 'back.jpg', { type: 'image/jpeg' })
    expect(
      validateMemberRequiredFields(
        filledDraft({
          documents: {},
          pendingDocuments: { cccd: { front, back } },
        }),
      ),
    ).toEqual({ valid: true, errors: {} })
  })
})
