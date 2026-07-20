import { describe, expect, it } from 'vitest'
import { normalizeCccd, normalizeVnPhone } from './normalize'
import { memberCccdIndexId } from './memberCccdIndex'
import { memberPhoneIndexId } from './memberPhoneIndex'
import { buildManagerPhones, mergeManagerPhones } from './templePhones'

describe('normalizeCccd', () => {
  it('strips non-digits', () => {
    expect(normalizeCccd('0123 456 78901')).toBe('012345678901')
  })
  it('rejects empty', () => {
    expect(() => normalizeCccd('  ')).toThrow()
  })
})

describe('normalizeVnPhone', () => {
  it('keeps leading 0 digits-only', () => {
    expect(normalizeVnPhone('090-123-4567')).toBe('0901234567')
  })
  it('converts +84 to 0', () => {
    expect(normalizeVnPhone('+84901234567')).toBe('0901234567')
  })
})

describe('memberCccdIndexId', () => {
  it('joins org, type, cccd', () => {
    expect(memberCccdIndexId('gd-i', 'tang', '012345678901')).toBe(
      'gd-i_tang_012345678901',
    )
  })
})

describe('memberPhoneIndexId', () => {
  it('joins org, sangha type, and phone', () => {
    expect(memberPhoneIndexId('gd-i', 'tang', '0901234567')).toBe(
      'gd-i_tang_0901234567',
    )
  })
})

describe('buildManagerPhones', () => {
  it('merges explicit phones and tru tri phone, deduped', () => {
    expect(
      buildManagerPhones({
        explicitPhones: ['0901234567', '0901234567'],
        truTriPhone: '091-111-2222',
      }),
    ).toEqual(['0901234567', '0911112222'])
  })
  it('throws when empty after merge', () => {
    expect(() =>
      buildManagerPhones({ explicitPhones: [], truTriPhone: undefined }),
    ).toThrow()
  })
})

describe('mergeManagerPhones', () => {
  it('unions existing phones with incoming explicit and tru tri phones', () => {
    expect(
      mergeManagerPhones(['0912345678'], {
        explicitPhones: [],
        truTriPhone: '0988.777.666',
      }),
    ).toEqual(['0912345678', '0988777666'])
  })

  it('keeps existing phones when incoming is empty', () => {
    expect(
      mergeManagerPhones(['0912345678'], {
        explicitPhones: [],
        truTriPhone: undefined,
      }),
    ).toEqual(['0912345678'])
  })
})
