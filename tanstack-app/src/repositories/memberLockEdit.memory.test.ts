import { describe, expect, it } from 'vitest'
import { createMemoryMemberStore } from '#/test/memoryStores'

describe('member createOrUpdateAndLock', () => {
  it('creates locked with lockedBy filler and clears edit request', async () => {
    const store = createMemoryMemberStore([])
    const { member, mode } = await store.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'inv-1',
      cccd: '001099012345',
      patch: { theDanh: 'A', dienThoai: '0901111111' },
    })
    expect(mode).toBe('created')
    expect(member.status).toBe('locked')
    expect(member.lockedBy).toBe('filler')
    expect(member.lockedAt).toBeTruthy()
    expect(member.editRequestedAt).toBeNull()
    expect(member.theDanh).toBe('A')
  })

  it('updates draft into locked', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'gd-i_tang_001099012345',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099012345',
        inviteId: 'inv-1',
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { member, mode } = await store.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'inv-1',
      cccd: '001099012345',
      patch: { theDanh: 'B' },
    })
    expect(mode).toBe('updated')
    expect(member.status).toBe('locked')
    expect(member.theDanh).toBe('B')
  })

  it('rejects when already locked', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'gd-i_tang_001099012345',
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
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    await expect(
      store.createOrUpdateAndLock({
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        inviteId: 'inv-1',
        cccd: '001099012345',
        patch: { theDanh: 'X' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })
})

describe('member requestEdit', () => {
  it('sets flag once', async () => {
    const store = createMemoryMemberStore([
      {
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
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const first = await store.requestEdit('m1', '0901234567')
    expect(first.editRequestedBy).toBe('0901234567')
    expect(first.editRequestedAt).toBeTruthy()
    const second = await store.requestEdit('m1', '0909999999')
    expect(second.editRequestedBy).toBe('0901234567')
    expect(second.editRequestedAt).toBe(first.editRequestedAt)
  })
})

describe('unlock clears edit request', () => {
  it('clears editRequested*', async () => {
    const store = createMemoryMemberStore([
      {
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
        lockedBy: 'filler',
        editRequestedAt: '2026-08-04T00:00:00.000Z',
        editRequestedBy: '0901234567',
      },
    ])
    const result = await store.unlock('m1')
    expect(result.status).toBe('draft')
    expect(result.editRequestedAt).toBeNull()
    expect(result.editRequestedBy).toBeNull()
  })
})
