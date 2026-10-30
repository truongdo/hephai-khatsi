import { describe, expect, it } from 'vitest'
import {
  isTinhTrangValue,
  TINH_TRANG_VALUES,
  tinhTrangSelectData,
} from './tinhTrang'

describe('TINH_TRANG_VALUES', () => {
  it('has the eight member status labels', () => {
    expect([...TINH_TRANG_VALUES]).toEqual([
      'SINH HOẠT',
      'ĐI HỌC',
      'GIÀ YẾU',
      'ĐAU BỆNH',
      'VIÊN TỊCH',
      'CHUYỂN HỆ PHÁI',
      'CHUYỂN GIÁO ĐOÀN',
      'HOÀN TỤC',
    ])
  })

  it('guards allowed values only', () => {
    expect(isTinhTrangValue('SINH HOẠT')).toBe(true)
    expect(isTinhTrangValue('sinh hoạt')).toBe(false)
    expect(isTinhTrangValue('')).toBe(false)
  })

  it('select data uses label as value', () => {
    expect(tinhTrangSelectData()).toEqual(
      TINH_TRANG_VALUES.map((value) => ({ value, label: value })),
    )
  })
})
