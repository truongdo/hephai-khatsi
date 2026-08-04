import { describe, expect, it } from 'vitest'
import { createMemoryTempleStore } from '#/test/memoryStores'

describe('temple createOrUpdateAndLock', () => {
  it('creates locked with lockedBy filler and clears edit request', async () => {
    const store = createMemoryTempleStore([])
    const { temple, mode } = await store.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      inviteId: 'inv-1',
      managerPhones: ['0901111111'],
      patch: { danhHieu: 'Chua A' },
    })
    expect(mode).toBe('created')
    expect(temple.status).toBe('locked')
    expect(temple.lockedBy).toBe('filler')
    expect(temple.lockedAt).toBeTruthy()
    expect(temple.editRequestedAt).toBeNull()
    expect(temple.danhHieu).toBe('Chua A')
  })

  it('updates draft into locked', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'draft',
        managerPhones: ['0901111111'],
        inviteId: 'inv-1',
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { temple, mode } = await store.createOrUpdateAndLock({
      orgUnitId: 'gd-i',
      inviteId: 'inv-1',
      managerPhones: ['0901111111'],
      templeId: 't1',
      patch: { danhHieu: 'Chua B' },
    })
    expect(mode).toBe('updated')
    expect(temple.status).toBe('locked')
    expect(temple.danhHieu).toBe('Chua B')
  })

  it('rejects when already locked', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'locked',
        managerPhones: ['0901111111'],
        inviteId: 'inv-1',
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
        inviteId: 'inv-1',
        managerPhones: ['0901111111'],
        templeId: 't1',
        patch: { danhHieu: 'X' },
      }),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })
})

describe('temple requestEdit', () => {
  it('sets flag once', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'locked',
        managerPhones: ['0901234567'],
        inviteId: 'inv-1',
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const first = await store.requestEdit('t1', '0901234567')
    expect(first.editRequestedBy).toBe('0901234567')
    expect(first.editRequestedAt).toBeTruthy()
    const second = await store.requestEdit('t1', '0909999999')
    expect(second.editRequestedBy).toBe('0901234567')
    expect(second.editRequestedAt).toBe(first.editRequestedAt)
  })
})

describe('temple unlock clears edit request', () => {
  it('clears editRequested*', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'locked',
        managerPhones: ['0901234567'],
        inviteId: 'inv-1',
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T01:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'filler',
        editRequestedAt: '2026-08-04T00:00:00.000Z',
        editRequestedBy: '0901234567',
      },
    ])
    const result = await store.unlock('t1')
    expect(result.status).toBe('draft')
    expect(result.editRequestedAt).toBeNull()
    expect(result.editRequestedBy).toBeNull()
  })
})
