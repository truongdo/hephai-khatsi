import { describe, expect, it } from 'vitest'
import { memberPhoneIndexId } from '#/domain/memberPhoneIndex'
import { normalizeVnPhone } from '#/domain/normalize'
import type { Member } from '#/domain/types'
import { createMemoryMemberStore } from '#/test/memoryStores'

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

describe('member listByCurrentTempleIds (memory store)', () => {
  it('returns members whose currentTempleId is in the given list', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1', currentTempleId: 't1' }),
      member({ id: 'm2', currentTempleId: 't2' }),
      member({ id: 'm3', currentTempleId: 't1' }),
      member({ id: 'm4', currentTempleId: null }),
      member({ id: 'm5', currentTempleId: 't3' }),
    ])

    const found = await store.listByCurrentTempleIds(['t1', 't2'])
    expect(found.map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm3'])
  })

  it('returns empty array when templeIds is empty', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1', currentTempleId: 't1' }),
    ])

    expect(await store.listByCurrentTempleIds([])).toEqual([])
  })
})

describe('member deleteMany (memory store)', () => {
  it('removes members and shrinks the phone index', async () => {
    const phone = normalizeVnPhone('0901234567')
    const store = createMemoryMemberStore([
      member({ id: 'm1', dienThoai: phone, cccd: '111111111111' }),
      member({ id: 'm2', dienThoai: phone, cccd: '222222222222' }),
    ])
    const indexKey = memberPhoneIndexId('gd-i', 'tang', phone)
    expect(store.phoneIndex.get(indexKey)).toEqual(['m1', 'm2'])

    await store.deleteMany(['m1'])

    expect(await store.getById('m1')).toBeNull()
    expect(await store.getById('m2')).not.toBeNull()
    expect(store.phoneIndex.get(indexKey)).toEqual(['m2'])
  })

  it('deletes the phone index doc when the last member is removed', async () => {
    const phone = normalizeVnPhone('0901234567')
    const store = createMemoryMemberStore([
      member({ id: 'm1', dienThoai: phone }),
    ])
    const indexKey = memberPhoneIndexId('gd-i', 'tang', phone)
    expect(store.phoneIndex.has(indexKey)).toBe(true)

    await store.deleteMany(['m1'])

    expect(store.phoneIndex.has(indexKey)).toBe(false)
    expect(await store.getById('m1')).toBeNull()
  })

  it('skips missing ids without throwing', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1' }),
    ])

    await expect(store.deleteMany(['m1', 'missing'])).resolves.toBeUndefined()
    expect(await store.getById('m1')).toBeNull()
  })
})
