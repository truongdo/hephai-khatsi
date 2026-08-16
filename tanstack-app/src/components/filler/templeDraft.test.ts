import { describe, expect, it } from 'vitest'
import {
  buildTemplePatch,
  emptyTempleDraft,
  hydrateDiaChiCu,
} from '#/components/filler/templeDraft'

describe('emptyTempleDraft counts', () => {
  it('defaults tang so and phat tu counts to 0', () => {
    const draft = emptyTempleDraft({})
    expect(draft.tangSoHienTru).toEqual({
      tyKheo: 0,
      thucXoaMaNa: 0,
      saDi: 0,
      tapSu: 0,
    })
    expect(draft.soPhatTuQuyY).toBe(0)
    expect(draft.soPhatTuThuongXuyen).toBe(0)
  })
})

describe('hydrateDiaChiCu', () => {
  it('keeps legacy strings and blanks structured values', () => {
    expect(hydrateDiaChiCu('123 Đường Láng')).toBe('123 Đường Láng')
    expect(hydrateDiaChiCu(undefined)).toBe('')
    expect(
      hydrateDiaChiCu({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '15 Ngõ 4',
      }),
    ).toBe('')
  })
})

describe('templeDraft diaChiCu', () => {
  it('hydrates and patches diaChiCu as free text', () => {
    const draft = emptyTempleDraft({
      diaChiCu: '  123 Đường Láng  ',
    })
    expect(draft.diaChiCu).toBe('  123 Đường Láng  ')
    expect(buildTemplePatch(draft).diaChiCu).toBe('123 Đường Láng')

    const fromStructured = emptyTempleDraft({
      diaChiCu: {
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
      },
    })
    expect(fromStructured.diaChiCu).toBe('')
    expect(buildTemplePatch(fromStructured).diaChiCu).toBeUndefined()
  })
})

describe('templeDraft land areas', () => {
  it('patches decimal square-meter values', () => {
    const draft = emptyTempleDraft({
      quyenSuDungDat: {
        dienTichKhuonVienM2: 12.5,
        dienTichXayDungM2: 3.25,
        dienTichDatCanhTacM2: 100.75,
      },
    })
    expect(buildTemplePatch(draft).quyenSuDungDat).toMatchObject({
      dienTichKhuonVienM2: 12.5,
      dienTichXayDungM2: 3.25,
      dienTichDatCanhTacM2: 100.75,
    })
  })

  it('parses in-progress decimal strings when building the patch', () => {
    const draft = emptyTempleDraft({})
    draft.quyenSuDungDat.dienTichKhuonVienM2 = '12.5'
    draft.quyenSuDungDat.dienTichXayDungM2 = '12,'
    draft.quyenSuDungDat.dienTichDatCanhTacM2 = '8,25'
    expect(buildTemplePatch(draft).quyenSuDungDat).toMatchObject({
      dienTichKhuonVienM2: 12.5,
      dienTichXayDungM2: 12,
      dienTichDatCanhTacM2: 8.25,
    })
  })
})

describe('templeDraft qdCongNhan.trangThai', () => {
  it('hydrates known trangThai and patches it', () => {
    const draft = emptyTempleDraft({
      qdCongNhan: { trangThai: 'chinh_thuc', so: '01', ngay: '01/01/2020' },
    })
    expect(draft.qdCongNhan.trangThai).toBe('chinh_thuc')
    expect(buildTemplePatch(draft).qdCongNhan).toEqual({
      trangThai: 'chinh_thuc',
      so: '01',
      ngay: '01/01/2020',
    })
  })

  it('defaults missing trangThai to empty and omits it from patch', () => {
    const draft = emptyTempleDraft({
      qdCongNhan: { so: '01', ngay: '' },
    })
    expect(draft.qdCongNhan.trangThai).toBe('')
    expect(buildTemplePatch(draft).qdCongNhan).toEqual({
      trangThai: undefined,
      so: '01',
      ngay: undefined,
    })
  })

  it('ignores unknown trangThai values on hydrate', () => {
    const draft = emptyTempleDraft({
      qdCongNhan: {
        // @ts-expect-error intentional invalid legacy value
        trangThai: 'other',
      },
    })
    expect(draft.qdCongNhan.trangThai).toBe('')
  })
})
