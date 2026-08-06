import { describe, expect, it } from 'vitest'
import {
  DAC_DIEM_OPTIONS,
  HANG_MUC_XAY_DUNG_OPTIONS,
  namTienPhongAfterRankChange,
  NI_RANKS,
  QD_CONG_NHAN_TRANG_THAI_OPTIONS,
  rankShowsNamTienPhong,
  TANG_RANKS,
} from './fillerFormOptions'

describe('fillerFormOptions', () => {
  it('exposes tang and ni rank values from the DB design', () => {
    expect(TANG_RANKS.map((r) => r.value)).toEqual([
      'hoa_thuong',
      'thuong_toa',
      'dai_duc',
      'ty_kheo',
      'sa_di',
      'tap_su',
    ])
    expect(NI_RANKS.map((r) => r.value)).toEqual([
      'ni_truong',
      'ni_su',
      'ty_kheo_ni',
      'thuc_xoa_ma_na',
      'sa_di_ni',
      'tap_su',
    ])
  })

  it('shows namTienPhong only for senior ranks', () => {
    expect(rankShowsNamTienPhong('hoa_thuong')).toBe(true)
    expect(rankShowsNamTienPhong('thuong_toa')).toBe(true)
    expect(rankShowsNamTienPhong('ni_truong')).toBe(true)
    expect(rankShowsNamTienPhong('ni_su')).toBe(true)
    expect(rankShowsNamTienPhong('dai_duc')).toBe(false)
    expect(rankShowsNamTienPhong('ty_kheo')).toBe(false)
    expect(rankShowsNamTienPhong('sa_di')).toBe(false)
    expect(rankShowsNamTienPhong('tap_su')).toBe(false)
    expect(rankShowsNamTienPhong('ty_kheo_ni')).toBe(false)
    expect(rankShowsNamTienPhong('thuc_xoa_ma_na')).toBe(false)
    expect(rankShowsNamTienPhong('sa_di_ni')).toBe(false)
    expect(rankShowsNamTienPhong('')).toBe(false)
  })

  it('clears namTienPhong when rank no longer shows the field', () => {
    expect(namTienPhongAfterRankChange('hoa_thuong', 1990)).toBe(1990)
    expect(namTienPhongAfterRankChange('dai_duc', 1990)).toBe('')
    expect(namTienPhongAfterRankChange('', 1990)).toBe('')
  })

  it('exposes fixed dacDiem and hangMuc option values', () => {
    expect(DAC_DIEM_OPTIONS.length).toBeGreaterThanOrEqual(5)
    expect(HANG_MUC_XAY_DUNG_OPTIONS.length).toBeGreaterThanOrEqual(5)
  })

  it('exposes qd cong nhan trang thai options', () => {
    expect(QD_CONG_NHAN_TRANG_THAI_OPTIONS.map((o) => o.value)).toEqual([
      'chinh_thuc',
      'chua_cong_nhan',
    ])
  })
})
