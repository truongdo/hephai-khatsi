import { describe, expect, it } from 'vitest'
import {
  MEMBER_TINH_TRANG_VALUES,
  formatMemberTinhTrang,
  isMemberTinhTrang,
} from '#/domain/memberTinhTrang'

describe('memberTinhTrang', () => {
  it('has the eight values in the agreed order', () => {
    expect(MEMBER_TINH_TRANG_VALUES).toEqual([
      'sinh_hoat',
      'di_hoc',
      'gia_yeu',
      'dau_benh',
      'vien_tich',
      'chuyen_he_phai',
      'chuyen_giao_doan',
      'hoan_tuc',
    ])
  })

  it('recognises only known values', () => {
    expect(isMemberTinhTrang('hoan_tuc')).toBe(true)
    expect(isMemberTinhTrang('khac')).toBe(false)
    expect(isMemberTinhTrang(null)).toBe(false)
  })

  it('formats labels, empty for unset, raw text for unknown values', () => {
    expect(formatMemberTinhTrang('gia_yeu')).toBe('Già yếu')
    expect(formatMemberTinhTrang(null)).toBe('')
    expect(formatMemberTinhTrang(undefined)).toBe('')
    expect(formatMemberTinhTrang('khac')).toBe('khac')
  })
})
