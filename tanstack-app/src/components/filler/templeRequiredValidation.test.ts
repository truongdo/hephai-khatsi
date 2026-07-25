import { describe, expect, it } from 'vitest'
import { EMPTY_ADDRESS_DRAFT } from '#/domain/address'
import {
  validateTempleRequiredFields,
  type TempleRequiredDraft,
} from './templeRequiredValidation'

const completeAddress = {
  cityCode: '01',
  cityName: 'Hà Nội',
  wardCode: '00013',
  wardName: 'Hà Đông',
  line: '',
}

function filledDraft(
  overrides: Partial<TempleRequiredDraft> = {},
): TempleRequiredDraft {
  return {
    danhHieu: 'Tịnh xá Ngọc Viên',
    nguoiKhaiSon: 'HT. Minh',
    namThanhLap: '1954',
    diaChiCu: completeAddress,
    diaChiMoi: completeAddress,
    truTriHienNay: {
      phapDanh: 'Thích A',
      dienThoai: '0901234567',
      email: 'a@b.co',
    },
    truTriTienNhiem: [{ phapDanh: 'Thích B', thoiGian: '', ghiChu: '' }],
    tangSoHienTru: { tyKheo: 0, thucXoaMaNa: 0, saDi: 0, tapSu: 0 },
    soPhatTuQuyY: 0,
    soPhatTuThuongXuyen: 0,
    ...overrides,
  }
}

describe('validateTempleRequiredFields', () => {
  it('fails blank identity, addresses, tru tri, and empty counts', () => {
    const result = validateTempleRequiredFields({
      danhHieu: '',
      nguoiKhaiSon: '  ',
      namThanhLap: '',
      diaChiCu: { ...EMPTY_ADDRESS_DRAFT },
      diaChiMoi: { ...EMPTY_ADDRESS_DRAFT },
      truTriHienNay: { phapDanh: '', dienThoai: '', email: '' },
      truTriTienNhiem: [],
      tangSoHienTru: { tyKheo: '', thucXoaMaNa: '', saDi: '', tapSu: '' },
      soPhatTuQuyY: '',
      soPhatTuThuongXuyen: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.danhHieu).toBe('REQUIRED')
    expect(result.errors.nguoiKhaiSon).toBe('REQUIRED')
    expect(result.errors.namThanhLap).toBe('REQUIRED')
    expect(result.errors.diaChiCu).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.diaChiMoi).toEqual({
      city: 'REQUIRED',
      ward: 'REQUIRED',
    })
    expect(result.errors.truTriHienNay).toEqual({
      phapDanh: 'REQUIRED',
      dienThoai: 'REQUIRED',
      email: 'REQUIRED',
    })
    expect(result.errors.truTriTienNhiem).toBe('REQUIRED')
    expect(result.errors.tangSoHienTru).toEqual({
      tyKheo: 'REQUIRED',
      thucXoaMaNa: 'REQUIRED',
      saDi: 'REQUIRED',
      tapSu: 'REQUIRED',
    })
    expect(result.errors.soPhatTuQuyY).toBe('REQUIRED')
    expect(result.errors.soPhatTuThuongXuyen).toBe('REQUIRED')
  })

  it('marks invalid tru tri email format', () => {
    const result = validateTempleRequiredFields(
      filledDraft({
        truTriHienNay: {
          phapDanh: 'Thích A',
          dienThoai: '0901234567',
          email: 'not-an-email',
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.truTriHienNay?.email).toBe('INVALID')
  })

  it('fails empty phap danh on tien nhiem row', () => {
    const result = validateTempleRequiredFields(
      filledDraft({
        truTriTienNhiem: [{ phapDanh: '  ', thoiGian: '', ghiChu: '' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.truTriTienNhiem).toEqual([{ phapDanh: 'REQUIRED' }])
  })

  it('accepts zero counts and a filled draft', () => {
    expect(validateTempleRequiredFields(filledDraft())).toEqual({
      valid: true,
      errors: {},
    })
  })
})
