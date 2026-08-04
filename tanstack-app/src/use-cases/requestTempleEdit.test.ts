import { describe, expect, it } from 'vitest'
import type { Temple } from '#/domain/types'
import { createMemoryTempleStore } from '#/test/memoryStores'
import { requestTempleEdit } from './requestTempleEdit'

function lockedTemple(id: string): Temple {
  return {
    id,
    orgUnitId: 'gd-i',
    status: 'locked',
    managerPhones: ['0912345678'],
    inviteId: 'public',
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: '2026-07-19T00:00:00.000Z',
    lockedBy: 'filler',
    editRequestedAt: null,
    editRequestedBy: null,
  }
}

describe('requestTempleEdit', () => {
  it('requestTempleEdit sets phone', async () => {
    const store = createMemoryTempleStore()
    store.temples.set('t1', lockedTemple('t1'))

    const result = await requestTempleEdit(
      { templeId: 't1', phone: '0901234567' },
      store,
    )

    expect(result.editRequestedBy).toBe('0901234567')
    expect(result.editRequestedAt).toBe('2026-07-19T00:00:00.000Z')
  })

  it('rejects when temple is not locked', async () => {
    const store = createMemoryTempleStore()
    store.temples.set('t1', { ...lockedTemple('t1'), status: 'draft' })

    await expect(
      requestTempleEdit({ templeId: 't1', phone: '0901234567' }, store),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' })
  })
})
