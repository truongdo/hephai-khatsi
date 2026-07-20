import { describe, expect, it } from 'vitest'
import {
  DAC_DIEM_OPTIONS,
  HANG_MUC_XAY_DUNG_OPTIONS,
  NI_RANKS,
  TANG_RANKS,
} from './fillerFormOptions'

describe('fillerFormOptions', () => {
  it('exposes tang and ni rank values from the DB design', () => {
    expect(TANG_RANKS.map((r) => r.value)).toEqual([
      'hoa_thuong',
      'thuong_toa',
      'dai_duc',
      'ty_kheo',
    ])
    expect(NI_RANKS.map((r) => r.value)).toEqual([
      'ni_truong',
      'ni_su',
      'su_co',
      'ty_kheo_ni',
      'ni_co',
    ])
  })

  it('exposes fixed dacDiem and hangMuc option values', () => {
    expect(DAC_DIEM_OPTIONS.length).toBeGreaterThanOrEqual(5)
    expect(HANG_MUC_XAY_DUNG_OPTIONS.length).toBeGreaterThanOrEqual(5)
  })
})
