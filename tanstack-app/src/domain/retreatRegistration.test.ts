import { describe, expect, it } from 'vitest'
import { DomainError } from './errors'
import {
  assertMemberOrgMatches,
  assertQuyenAllows,
  assertRegistrationOpen,
  retreatRegistrationId,
  validateExtraAnswers,
} from './retreatRegistration'

const base = {
  status: 'open' as const,
  dangKyMoTu: '2026-07-01T00:00:00.000+07:00',
  dangKyDongLuc: '2026-07-31T23:59:59.999+07:00',
}

describe('assertRegistrationOpen', () => {
  it('allows open retreat inside window', () => {
    expect(() =>
      assertRegistrationOpen(base, '2026-07-15T12:00:00.000+07:00'),
    ).not.toThrow()
  })

  it('rejects when status is not open', () => {
    expect(() =>
      assertRegistrationOpen({ ...base, status: 'closed' }, '2026-07-15T12:00:00.000+07:00'),
    ).toThrow(DomainError)
  })

  it('rejects outside window', () => {
    expect(() =>
      assertRegistrationOpen(base, '2026-08-01T00:00:00.000+07:00'),
    ).toThrow(DomainError)
  })
})

describe('assertQuyenAllows', () => {
  it('allows self when both', () => {
    expect(() => assertQuyenAllows('both', 'self')).not.toThrow()
  })
  it('rejects self when proxy_only', () => {
    expect(() => assertQuyenAllows('proxy_only', 'self')).toThrow(DomainError)
  })
  it('rejects proxy when tu_dang_ky', () => {
    expect(() => assertQuyenAllows('tu_dang_ky', 'proxy')).toThrow(DomainError)
  })
})

describe('validateExtraAnswers', () => {
  it('requires required keys', () => {
    expect(() =>
      validateExtraAnswers([{ key: 'room', label: 'Phòng', required: true }], {}),
    ).toThrow(DomainError)
  })
})

describe('retreatRegistrationId', () => {
  it('joins retreat and member ids', () => {
    expect(retreatRegistrationId('r1', 'gd-i_tang_001')).toBe('r1_gd-i_tang_001')
  })
})
