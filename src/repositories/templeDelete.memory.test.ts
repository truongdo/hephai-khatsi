import { describe, expect, it } from 'vitest'
import { normalizeVnPhone } from '#/domain/normalize'
import type { Temple } from '#/domain/types'
import { createMemoryTempleStore } from '#/test/memoryStores'

function temple(overrides: Partial<Temple> & { id: string }): Temple {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    managerPhones: [],
    inviteId: null,
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

describe('temple deleteMany (memory store)', () => {
  it('removes temples from the phone lookup', async () => {
    const phone = normalizeVnPhone('0901234567')
    const store = createMemoryTempleStore([
      temple({ id: 't1', managerPhones: [phone] }),
      temple({ id: 't2', managerPhones: [phone] }),
    ])
    const lookup = () => store.listByOrgAndPhone({ orgUnitId: 'gd-i', phone })
    expect((await lookup()).map((t) => t.id).sort()).toEqual(['t1', 't2'])

    await store.deleteMany(['t1'])

    expect(await store.getById('t1')).toBeNull()
    expect(await store.getById('t2')).not.toBeNull()
    expect((await lookup()).map((t) => t.id)).toEqual(['t2'])
  })

  it('skips missing ids without throwing', async () => {
    const store = createMemoryTempleStore([temple({ id: 't1' })])

    await expect(store.deleteMany(['t1', 'missing'])).resolves.toBeUndefined()
    expect(await store.getById('t1')).toBeNull()
  })
})
