import { describe, expect, it } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import { auditActorDisplayName } from './auditActorDisplayName'

const member = (overrides: Partial<Member> = {}): Member =>
  ({
    id: 'm1',
    orgUnitId: 'ou1',
    sanghaType: 'tang',
    cccd: '012345678901',
    status: 'locked',
    ...overrides,
  }) as Member

const temple = (overrides: Partial<Temple> = {}): Temple =>
  ({
    id: 't1',
    orgUnitId: 'ou1',
    status: 'locked',
    ...overrides,
  }) as Temple

describe('auditActorDisplayName', () => {
  it('uses secretary phapDanh for admin actorId matching directoryAuthUid', () => {
    expect(
      auditActorDisplayName({
        actorType: 'admin',
        actorId: 'auth-1',
        directoryMembers: [
          member({ directoryAuthUid: 'auth-1', phapDanh: 'Thích Minh' }),
        ],
      }),
    ).toBe('Thích Minh')
  })

  it('uses member phapDanh when filler phone matches parent member', () => {
    expect(
      auditActorDisplayName({
        actorType: 'filler',
        actorId: '0901234567',
        parentMember: member({
          dienThoai: '0901.234.567',
          phapDanh: 'Minh Tâm',
        }),
      }),
    ).toBe('Minh Tâm')
  })

  it('uses tru tri phapDanh when filler phone matches temple', () => {
    expect(
      auditActorDisplayName({
        actorType: 'filler',
        actorId: '0901234567',
        parentTemple: temple({
          truTriHienNay: { phapDanh: 'Thích A', dienThoai: '0901234567' },
        }),
      }),
    ).toBe('Thích A')
  })

  it('falls back to actorId when no phapDanh is found', () => {
    expect(
      auditActorDisplayName({
        actorType: 'admin',
        actorId: 'admin-uid',
        directoryMembers: [],
      }),
    ).toBe('admin-uid')
  })
})
