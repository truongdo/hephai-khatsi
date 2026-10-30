import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Member } from '#/domain/types'
import type { MemberStore } from '#/repositories/memberRepo'
import { updateMemberTinhTrang } from './updateMemberTinhTrang'

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'locked',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: '2026-07-19T00:00:00.000Z',
    lockedBy: 'admin',
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('updateMemberTinhTrang', () => {
  const audit = { actorType: 'admin' as const, actorId: 'uid-1' }
  const claims = { role: 'he_phai_admin' as const, orgUnitId: null }

  it('patches tinhTrang with allowWhenLocked', async () => {
    const existing = member()
    const updated = member({ tinhTrang: 'ĐI HỌC' })
    const store = {
      getById: vi.fn(async () => existing),
      updateDraftById: vi.fn(async () => updated),
    } as unknown as MemberStore

    const result = await updateMemberTinhTrang(
      { memberId: 'm1', tinhTrang: 'ĐI HỌC' },
      audit,
      claims,
      store,
    )

    expect(result).toBe(updated)
    expect(store.updateDraftById).toHaveBeenCalledWith(
      'm1',
      { tinhTrang: 'ĐI HỌC' },
      { allowWhenLocked: true, audit },
    )
  })

  it('rejects invalid tinhTrang', async () => {
    const store = {
      getById: vi.fn(),
      updateDraftById: vi.fn(),
    } as unknown as MemberStore

    await expect(
      updateMemberTinhTrang(
        { memberId: 'm1', tinhTrang: 'KHÁC' as never },
        audit,
        claims,
        store,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' } satisfies Partial<DomainError>)
    expect(store.getById).not.toHaveBeenCalled()
  })

  it('rejects when member is outside claim scope', async () => {
    const store = {
      getById: vi.fn(async () => member({ orgUnitId: 'gd-ii' })),
      updateDraftById: vi.fn(),
    } as unknown as MemberStore

    await expect(
      updateMemberTinhTrang(
        { memberId: 'm1', tinhTrang: 'SINH HOẠT' },
        audit,
        { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<DomainError>)
    expect(store.updateDraftById).not.toHaveBeenCalled()
  })

  it('rejects missing member', async () => {
    const store = {
      getById: vi.fn(async () => null),
      updateDraftById: vi.fn(),
    } as unknown as MemberStore

    await expect(
      updateMemberTinhTrang(
        { memberId: 'missing', tinhTrang: 'SINH HOẠT' },
        audit,
        claims,
        store,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Partial<DomainError>)
  })
})
