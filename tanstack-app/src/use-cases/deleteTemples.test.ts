import { describe, expect, it } from 'vitest'
import type { Member, Temple } from '#/domain/types'
import {
  createMemoryMemberStore,
  createMemoryTempleStore,
} from '#/test/memoryStores'
import { deleteTemples } from './deleteTemples'

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
    ...overrides,
  }
}

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
    ...overrides,
  }
}

describe('deleteTemples', () => {
  it('returns ok when ids is empty', async () => {
    const templeStore = createMemoryTempleStore([temple({ id: 't1' })])
    const memberStore = createMemoryMemberStore([])

    const result = await deleteTemples(
      { ids: [] },
      { templeStore, memberStore },
    )

    expect(result).toEqual({ ok: true })
    expect(await templeStore.getById('t1')).not.toBeNull()
  })

  it('deletes temples when no members reference them', async () => {
    const templeStore = createMemoryTempleStore([
      temple({ id: 't1' }),
      temple({ id: 't2' }),
    ])
    const memberStore = createMemoryMemberStore([
      member({ id: 'm1', currentTempleId: 'other' }),
    ])

    const result = await deleteTemples(
      { ids: ['t1', 't2'] },
      { templeStore, memberStore },
    )

    expect(result).toEqual({ ok: true })
    expect(await templeStore.getById('t1')).toBeNull()
    expect(await templeStore.getById('t2')).toBeNull()
  })

  it('blocks delete and groups members by temple', async () => {
    const templeStore = createMemoryTempleStore([
      temple({ id: 't1', danhHieu: 'Chùa A' }),
      temple({ id: 't2', danhHieu: 'Chùa B' }),
      temple({ id: 't3' }),
    ])
    const memberStore = createMemoryMemberStore([
      member({
        id: 'm1',
        currentTempleId: 't1',
        phapDanh: 'HT Minh',
        theDanh: 'Nguyễn Văn A',
      }),
      member({
        id: 'm2',
        currentTempleId: 't1',
        theDanh: 'Nguyễn Văn B',
      }),
      member({ id: 'm3', currentTempleId: 't2', phapDanh: 'HT Tue' }),
    ])

    const result = await deleteTemples(
      { ids: ['t1', 't2', 't3'] },
      { templeStore, memberStore },
    )

    expect(result).toEqual({
      ok: false,
      blockers: [
        {
          templeId: 't1',
          templeLabel: 'Chùa A',
          members: [
            { id: 'm1', label: 'HT Minh' },
            { id: 'm2', label: 'Nguyễn Văn B' },
          ],
        },
        {
          templeId: 't2',
          templeLabel: 'Chùa B',
          members: [{ id: 'm3', label: 'HT Tue' }],
        },
      ],
    })
    expect(await templeStore.getById('t1')).not.toBeNull()
    expect(await templeStore.getById('t2')).not.toBeNull()
    expect(await templeStore.getById('t3')).not.toBeNull()
  })

  it('uses temple id when danhHieu is missing', async () => {
    const templeStore = createMemoryTempleStore([temple({ id: 't1' })])
    const memberStore = createMemoryMemberStore([
      member({ id: 'm1', currentTempleId: 't1' }),
    ])

    const result = await deleteTemples(
      { ids: ['t1'] },
      { templeStore, memberStore },
    )

    expect(result).toMatchObject({
      ok: false,
      blockers: [{ templeId: 't1', templeLabel: 't1' }],
    })
  })

  it('uses member id when phapDanh and theDanh are missing', async () => {
    const templeStore = createMemoryTempleStore([
      temple({ id: 't1', danhHieu: 'Chùa A' }),
    ])
    const memberStore = createMemoryMemberStore([
      member({ id: 'm1', currentTempleId: 't1' }),
    ])

    const result = await deleteTemples(
      { ids: ['t1'] },
      { templeStore, memberStore },
    )

    expect(result).toMatchObject({
      ok: false,
      blockers: [
        {
          templeId: 't1',
          members: [{ id: 'm1', label: 'm1' }],
        },
      ],
    })
  })
})
