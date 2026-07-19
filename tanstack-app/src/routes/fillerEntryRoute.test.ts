import { describe, expect, it } from 'vitest'
import type { Temple } from '#/domain/types'
import {
  formTypeToSanghaType,
  templeMatchesFromResume,
} from './f.$token.index'

function temple(overrides: Partial<Temple>): Temple {
  return {
    id: 'temple-1',
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: ['0901234567'],
    inviteId: 'public',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

describe('filler entry route helpers', () => {
  it('maps member form types to sangha types', () => {
    expect(formTypeToSanghaType('member_tang')).toBe('tang')
    expect(formTypeToSanghaType('member_ni')).toBe('ni')
  })

  it('labels temple resume matches with display names and fallback ids', () => {
    expect(
      templeMatchesFromResume([
        { temple: temple({ id: 'temple-a', danhHieu: 'Tịnh xá A' }), access: 'edit' },
        { temple: temple({ id: 'temple-b', danhHieu: undefined }), access: 'view' },
      ]),
    ).toEqual([
      { id: 'temple-a', label: 'Tịnh xá A' },
      { id: 'temple-b', label: 'temple-b' },
    ])
  })
})
