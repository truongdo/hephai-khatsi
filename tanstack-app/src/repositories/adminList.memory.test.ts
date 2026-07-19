import { describe, expect, it } from 'vitest'
import type { Member, RecordStatus, SanghaType, Temple } from '#/domain/types'
import { createMemoryTempleStore, createMemoryMemberStore } from '#/test/memoryStores'

function temple(
  overrides: Partial<Temple> & { id: string; status?: RecordStatus; updatedAt?: string },
): Temple {
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

function member(
  overrides: Partial<Member> & { id: string; sanghaType: SanghaType },
): Member {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    cccd: '123456789012',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    ...overrides,
  }
}

describe('memory temple list', () => {
  it('filters by status and paginates with cursor', async () => {
    const store = createMemoryTempleStore([
      temple({ id: 't1', status: 'draft', updatedAt: '2026-07-19T03:00:00.000Z' }),
      temple({ id: 't2', status: 'locked', updatedAt: '2026-07-19T02:00:00.000Z' }),
      temple({ id: 't3', status: 'draft', updatedAt: '2026-07-19T01:00:00.000Z' }),
    ])
    const page1 = await store.list({ status: 'draft', limit: 1 })
    expect(page1.items.map((t) => t.id)).toEqual(['t1'])
    expect(page1.nextCursor).toBe('t1')
    const page2 = await store.list({ status: 'draft', limit: 1, cursor: page1.nextCursor! })
    expect(page2.items.map((t) => t.id)).toEqual(['t3'])
    expect(page2.nextCursor).toBeNull()
  })
})

describe('memory member list', () => {
  it('requires sanghaType and filters', async () => {
    const store = createMemoryMemberStore([
      member({ id: 'm1', sanghaType: 'tang' }),
      member({ id: 'm2', sanghaType: 'ni' }),
    ])
    const page = await store.list({ sanghaType: 'tang', limit: 25 })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]!.id).toBe('m1')
  })
})
