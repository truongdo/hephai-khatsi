import { describe, expect, it } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import { createMemoryMemberStore, createMemoryTempleStore } from '#/test/memoryStores'
import { unlockMember } from './unlockMember'
import { unlockTemple } from './unlockTemple'

const lockedMember: Member = {
  id: 'm1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'locked',
  cccd: '001099012345',
  inviteId: 'inv-1',
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T01:00:00.000Z',
  lockedAt: '2026-07-19T01:00:00.000Z',
  lockedBy: 'admin-1',
}

describe('unlockMember', () => {
  it('sets status back to draft and clears lock metadata', async () => {
    const store = createMemoryMemberStore([lockedMember])
    const result = await unlockMember({ memberId: 'm1' }, store)
    expect(result.status).toBe('draft')
    expect(result.lockedAt).toBeNull()
    expect(result.lockedBy).toBeNull()
  })

  it('is idempotent when already draft', async () => {
    const store = createMemoryMemberStore([{ ...lockedMember, status: 'draft', lockedAt: null, lockedBy: null }])
    const result = await unlockMember({ memberId: 'm1' }, store)
    expect(result.status).toBe('draft')
  })

  it('throws NOT_FOUND for missing member', async () => {
    await expect(
      unlockMember({ memberId: 'missing' }, createMemoryMemberStore([])),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('unlockTemple', () => {
  it('sets status back to draft and clears lock metadata', async () => {
    const temple: Temple = {
      id: 't1',
      orgUnitId: 'gd-i',
      status: 'locked',
      managerPhones: ['0901234567'],
      inviteId: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T01:00:00.000Z',
      lockedAt: '2026-07-19T01:00:00.000Z',
      lockedBy: 'admin-1',
    }
    const store = createMemoryTempleStore([temple])
    const result = await unlockTemple({ templeId: 't1' }, store)
    expect(result.status).toBe('draft')
    expect(result.lockedAt).toBeNull()
    expect(result.lockedBy).toBeNull()
  })
})
