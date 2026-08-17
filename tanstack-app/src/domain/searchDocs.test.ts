import { describe, expect, it } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import {
  toMemberSearchDoc,
  toTempleSearchDoc,
  searchPhoneDigits,
} from '#/domain/searchDocs'

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function temple(overrides: Partial<Temple> = {}): Temple {
  return {
    id: 't1',
    orgUnitId: 'gd-i',
    status: 'locked',
    managerPhones: ['0901234567'],
    inviteId: null,
    photoPath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('toMemberSearchDoc', () => {
  it('maps searchable fields and normalizes phone', () => {
    const doc = toMemberSearchDoc(
      member({
        phapDanh: 'Thích A',
        theDanh: 'Nguyễn A',
        dienThoai: '090-123-4567',
      }),
    )
    expect(doc).toMatchObject({
      id: 'm1',
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      status: 'draft',
      phapDanh: 'Thích A',
      theDanh: 'Nguyễn A',
      cccd: '012345678901',
      dienThoai: '0901234567',
    })
    expect(doc.updatedAt).toBe(Date.parse('2026-08-02T00:00:00.000Z'))
  })

  it('uses empty strings for missing optionals', () => {
    const doc = toMemberSearchDoc(member())
    expect(doc.phapDanh).toBe('')
    expect(doc.dienThoai).toBe('')
  })
})

describe('toTempleSearchDoc', () => {
  it('merges managerPhones and tru tri phone uniquely', () => {
    const doc = toTempleSearchDoc(
      temple({
        danhHieu: 'TX A',
        managerPhones: ['0901234567'],
        truTriHienNay: { phapDanh: 'HT B', dienThoai: '0912345678' },
      }),
    )
    expect(doc.danhHieu).toBe('TX A')
    expect(doc.truTriPhapDanh).toBe('HT B')
    expect(doc.phones.sort()).toEqual(['0901234567', '0912345678'].sort())
  })
})

describe('searchPhoneDigits', () => {
  it('returns empty for blank; digits for garbage that is not a valid VN phone', () => {
    expect(searchPhoneDigits(undefined)).toBe('')
    expect(searchPhoneDigits('abc')).toBe('')
  })
})
