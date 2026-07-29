import { describe, expect, it } from 'vitest'
import {
  buildTemplePatch,
  emptyTempleDraft,
  hydrateDiaChiCu,
} from '#/components/filler/templeDraft'

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
