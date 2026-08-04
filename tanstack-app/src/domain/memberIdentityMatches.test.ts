import { describe, expect, it } from 'vitest'
import { memberIdentityMatches } from './memberIdentityMatches'

describe('memberIdentityMatches', () => {
  const member = { cccd: '012345678901', ngaySinh: '1990-01-15' }

  it('returns true when CCCD and ngày sinh match', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '012345678901',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(true)
  })

  it('normalizes CCCD digits before compare', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '0123 4567 8901',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(true)
  })

  it('returns false when CCCD differs', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '999999999999',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(false)
  })

  it('returns false when ngày sinh differs', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '012345678901',
        ngaySinh: '1990-01-16',
      }),
    ).toBe(false)
  })

  it('returns false when member has no ngày sinh', () => {
    expect(
      memberIdentityMatches(
        { cccd: '012345678901' },
        { cccd: '012345678901', ngaySinh: '1990-01-15' },
      ),
    ).toBe(false)
  })

  it('returns false when member ngày sinh is empty', () => {
    expect(
      memberIdentityMatches(
        { cccd: '012345678901', ngaySinh: '' },
        { cccd: '012345678901', ngaySinh: '1990-01-15' },
      ),
    ).toBe(false)
  })

  it('returns false when CCCD is invalid', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '123',
        ngaySinh: '1990-01-15',
      }),
    ).toBe(false)
  })

  it('returns false when input ngày sinh is empty', () => {
    expect(
      memberIdentityMatches(member, {
        cccd: '012345678901',
        ngaySinh: '',
      }),
    ).toBe(false)
  })
})
