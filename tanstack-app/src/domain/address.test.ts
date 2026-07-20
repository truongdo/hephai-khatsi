import { describe, expect, it } from 'vitest'
import {
  EMPTY_ADDRESS_DRAFT,
  addressDraftToValue,
  formatAddressDisplay,
  hydrateAddress,
  isAddressBlank,
  validateAddressDraft,
} from './address'

describe('hydrateAddress', () => {
  it('returns empty draft for undefined', () => {
    expect(hydrateAddress(undefined)).toEqual(EMPTY_ADDRESS_DRAFT)
  })

  it('maps legacy string to line only', () => {
    expect(hydrateAddress('123 Đường Láng')).toEqual({
      ...EMPTY_ADDRESS_DRAFT,
      line: '123 Đường Láng',
    })
  })

  it('maps structured value', () => {
    expect(
      hydrateAddress({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '15 Ngõ 4',
      }),
    ).toEqual({
      cityCode: '01',
      cityName: 'Hà Nội',
      wardCode: '00013',
      wardName: 'Hà Đông',
      line: '15 Ngõ 4',
    })
  })
})

describe('addressDraftToValue', () => {
  it('returns undefined for blank draft', () => {
    expect(addressDraftToValue(EMPTY_ADDRESS_DRAFT)).toBeUndefined()
  })

  it('returns undefined for invalid partial drafts', () => {
    expect(
      addressDraftToValue({ ...EMPTY_ADDRESS_DRAFT, line: '15 Ngõ 4' }),
    ).toBeUndefined()
    expect(
      addressDraftToValue({
        ...EMPTY_ADDRESS_DRAFT,
        cityCode: '01',
        cityName: 'Hà Nội',
      }),
    ).toBeUndefined()
  })

  it('omits empty line', () => {
    expect(
      addressDraftToValue({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '   ',
      }),
    ).toEqual({
      cityCode: '01',
      cityName: 'Hà Nội',
      wardCode: '00013',
      wardName: 'Hà Đông',
    })
  })
})

describe('validateAddressDraft', () => {
  it('allows fully blank', () => {
    expect(validateAddressDraft(EMPTY_ADDRESS_DRAFT)).toEqual({
      valid: true,
      errors: {},
    })
  })

  it('requires city and ward when line is set', () => {
    expect(
      validateAddressDraft({ ...EMPTY_ADDRESS_DRAFT, line: '15 Ngõ 4' }),
    ).toEqual({
      valid: false,
      errors: { city: 'REQUIRED', ward: 'REQUIRED' },
    })
  })

  it('requires ward when only city is set', () => {
    expect(
      validateAddressDraft({
        ...EMPTY_ADDRESS_DRAFT,
        cityCode: '01',
        cityName: 'Hà Nội',
      }),
    ).toEqual({
      valid: false,
      errors: { ward: 'REQUIRED' },
    })
  })

  it('accepts complete address', () => {
    expect(
      validateAddressDraft({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '',
      }),
    ).toEqual({ valid: true, errors: {} })
  })
})

describe('formatAddressDisplay', () => {
  it('formats structured value', () => {
    expect(
      formatAddressDisplay({
        cityCode: '01',
        cityName: 'Hà Nội',
        wardCode: '00013',
        wardName: 'Hà Đông',
        line: '15 Ngõ 4',
      }),
    ).toBe('15 Ngõ 4, Hà Đông, Hà Nội')
  })

  it('passes through legacy string', () => {
    expect(formatAddressDisplay('123 Đường A')).toBe('123 Đường A')
  })
})

describe('isAddressBlank', () => {
  it('detects blank', () => {
    expect(isAddressBlank(EMPTY_ADDRESS_DRAFT)).toBe(true)
    expect(isAddressBlank({ ...EMPTY_ADDRESS_DRAFT, line: '  ' })).toBe(true)
    expect(isAddressBlank({ ...EMPTY_ADDRESS_DRAFT, line: '15' })).toBe(false)
  })
})
