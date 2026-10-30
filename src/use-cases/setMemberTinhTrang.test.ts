import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { ADMIN_AUDIT } from '#/test/auditActors'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { setMemberTinhTrang } from '#/use-cases/setMemberTinhTrang'

function lockedMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'locked',
    cccd: '001099012345',
    inviteId: 'inv-1',
    currentTempleId: null,
    photoPath: null,
    theDanh: 'A',
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T01:00:00.000Z',
    lockedAt: '2026-07-19T01:00:00.000Z',
    lockedBy: 'filler',
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('setMemberTinhTrang', () => {
  it('sets tình trạng on a locked member and keeps the lock and profile', async () => {
    const store = createMemoryMemberStore([lockedMember()])

    const member = await setMemberTinhTrang(
      { memberId: 'm1', tinhTrang: 'di_hoc', audit: ADMIN_AUDIT },
      store,
    )

    expect(member.tinhTrang).toBe('di_hoc')
    expect(member.status).toBe('locked')
    expect(member.theDanh).toBe('A')
    expect(store.members.get('m1')?.tinhTrang).toBe('di_hoc')
    const logs = store.auditLogs.get('members:m1') ?? []
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      action: 'updated',
      changes: [{ path: 'tinhTrang', after: 'di_hoc' }],
    })
  })

  it('clears tình trạng with null', async () => {
    const store = createMemoryMemberStore([lockedMember({ tinhTrang: 'gia_yeu' })])

    const member = await setMemberTinhTrang(
      { memberId: 'm1', tinhTrang: null, audit: ADMIN_AUDIT },
      store,
    )

    expect(member.tinhTrang).toBeNull()
  })

  it('does not write when the value is unchanged', async () => {
    const store = createMemoryMemberStore([lockedMember({ tinhTrang: 'sinh_hoat' })])

    const member = await setMemberTinhTrang(
      { memberId: 'm1', tinhTrang: 'sinh_hoat', audit: ADMIN_AUDIT },
      store,
    )

    expect(member.updatedAt).toBe('2026-07-19T01:00:00.000Z')
    expect(store.auditLogs.get('members:m1') ?? []).toHaveLength(0)
  })

  it('rejects an unknown member', async () => {
    const store = createMemoryMemberStore([])

    await expect(
      setMemberTinhTrang(
        { memberId: 'missing', tinhTrang: 'di_hoc', audit: ADMIN_AUDIT },
        store,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
