import { describe, expect, it } from 'vitest'
import { normalizeVnPhone } from '#/domain/normalize'
import type { Temple } from '#/domain/types'
import { createMemoryTempleStore } from '#/test/memoryStores'

function templePhoneIndexId(orgUnitId: string, phone: string): string {
  return `${orgUnitId}_${phone}`
}

function temple(overrides: Partial<Temple> & { id: string }): Temple {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: [],
    inviteId: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

describe('temple deleteMany (memory store)', () => {
  it('removes temples and shrinks the phone index', async () => {
    const phone = normalizeVnPhone('0901234567')
    const store = createMemoryTempleStore([
      temple({ id: 't1', managerPhones: [phone] }),
      temple({ id: 't2', managerPhones: [phone] }),
    ])
    const indexKey = templePhoneIndexId('gd-i', phone)
    expect(store.phoneIndex.get(indexKey)).toEqual(['t1', 't2'])

    await store.deleteMany(['t1'])

    expect(await store.getById('t1')).toBeNull()
    expect(await store.getById('t2')).not.toBeNull()
    expect(store.phoneIndex.get(indexKey)).toEqual(['t2'])
  })

  it('deletes the phone index doc when the last temple is removed', async () => {
    const phone = normalizeVnPhone('0901234567')
    const store = createMemoryTempleStore([
      temple({ id: 't1', managerPhones: [phone] }),
    ])
    const indexKey = templePhoneIndexId('gd-i', phone)
    expect(store.phoneIndex.has(indexKey)).toBe(true)

    await store.deleteMany(['t1'])

    expect(store.phoneIndex.has(indexKey)).toBe(false)
    expect(await store.getById('t1')).toBeNull()
  })

  it('skips missing ids without throwing', async () => {
    const store = createMemoryTempleStore([temple({ id: 't1' })])

    await expect(store.deleteMany(['t1', 'missing'])).resolves.toBeUndefined()
    expect(await store.getById('t1')).toBeNull()
  })
})
