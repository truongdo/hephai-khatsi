import { describe, expect, it } from 'vitest'
import type { AuthClaims } from '#/domain/authClaims'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'
import { deleteMembers } from './deleteMembers'

const HE_PHAI_CLAIMS: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }
const GIAO_DOAN_CLAIMS: AuthClaims = {
  role: 'giao_doan_admin',
  orgUnitId: 'gd-i',
}

function member(
  overrides: Partial<Member> & { id: string },
): Member {
  return {
    orgUnitId: 'gd-i',
    sanghaType: 'tang',
    status: 'draft',
    cccd: '123456789012',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('deleteMembers', () => {
  it('deletes the given members', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1' }),
      member({ id: 'm2' }),
    ])

    await deleteMembers(HE_PHAI_CLAIMS, { ids: ['m1'] }, store)

    expect(await store.getById('m1')).toBeNull()
    expect(await store.getById('m2')).not.toBeNull()
  })

  it('passes all ids to deleteMany', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1' }),
      member({ id: 'm2' }),
      member({ id: 'm3' }),
    ])

    await deleteMembers(HE_PHAI_CLAIMS, { ids: ['m1', 'm3'] }, store)

    expect(await store.getById('m1')).toBeNull()
    expect(await store.getById('m2')).not.toBeNull()
    expect(await store.getById('m3')).toBeNull()
  })

  it('rejects cross-org delete for giao_doan_admin', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1', orgUnitId: 'gd-ii' }),
    ])

    await expect(
      deleteMembers(
        GIAO_DOAN_CLAIMS,
        { ids: ['m1'] },
        store,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Org unit out of scope',
    })

    expect(await store.getById('m1')).not.toBeNull()
  })
})
