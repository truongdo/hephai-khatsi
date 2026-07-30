import { describe, expect, it } from 'vitest'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import { retreatRegistrationId } from '#/domain/retreatRegistration'
import type { AdminListPage } from '#/repositories/adminListTypes'
import type { RetreatRegistrationStore } from './retreatRegistrationRepo'

function sampleRegistration(
  overrides: Partial<RetreatRegistration> & Pick<RetreatRegistration, 'retreatId' | 'memberId'>,
): RetreatRegistration {
  const id = retreatRegistrationId(overrides.retreatId, overrides.memberId)
  const now = overrides.createdAt ?? '2026-07-19T10:00:00.000Z'
  return {
    id,
    retreatId: overrides.retreatId,
    memberId: overrides.memberId,
    orgUnitId: overrides.orgUnitId ?? 'gd-i',
    registeredVia: overrides.registeredVia ?? 'self',
    registeredBy: overrides.registeredBy ?? null,
    extraAnswers: overrides.extraAnswers ?? {},
    status: overrides.status ?? 'pending',
    approvedBy: overrides.approvedBy ?? null,
    approvedAt: overrides.approvedAt ?? null,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function listByRetreatInMemory(
  registrations: Iterable<RetreatRegistration>,
  input: { retreatId: string; limit?: number; cursor?: string },
): AdminListPage<RetreatRegistration> {
  const limit = input.limit ?? 25
  let items = [...registrations].filter((reg) => reg.retreatId === input.retreatId)
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (input.cursor) {
    const cursorIdx = items.findIndex((item) => item.id === input.cursor)
    if (cursorIdx >= 0) {
      items = items.slice(cursorIdx + 1)
    }
  }

  const page = items.slice(0, limit)
  const nextCursor = items.length > limit ? page[page.length - 1]!.id : null
  return { items: page, nextCursor }
}

function createMemoryRetreatRegistrationStore(): RetreatRegistrationStore & {
  registrations: Map<string, RetreatRegistration>
} {
  const registrations = new Map<string, RetreatRegistration>()

  return {
    registrations,
    async create(reg: RetreatRegistration) {
      registrations.set(reg.id, reg)
    },
    async getById(id: string) {
      return registrations.get(id) ?? null
    },
    async listByRetreat(input) {
      return listByRetreatInMemory(registrations.values(), input)
    },
  }
}

describe('RetreatRegistrationStore memory contract', () => {
  it('create then getById round-trips registration data', async () => {
    const store = createMemoryRetreatRegistrationStore()
    const reg = sampleRegistration({ retreatId: 'retreat-1', memberId: 'gd-i_tang_001' })

    await store.create(reg)
    expect(await store.getById(reg.id)).toEqual(reg)
  })

  it('listByRetreat filters by retreatId and orders by createdAt desc', async () => {
    const store = createMemoryRetreatRegistrationStore()
    const retreatId = 'retreat-1'
    const older = sampleRegistration({
      retreatId,
      memberId: 'gd-i_tang_001',
      createdAt: '2026-07-19T01:00:00.000Z',
      updatedAt: '2026-07-19T01:00:00.000Z',
    })
    const newer = sampleRegistration({
      retreatId,
      memberId: 'gd-i_tang_002',
      createdAt: '2026-07-19T03:00:00.000Z',
      updatedAt: '2026-07-19T03:00:00.000Z',
    })
    const otherRetreat = sampleRegistration({
      retreatId: 'retreat-2',
      memberId: 'gd-i_tang_003',
    })

    await store.create(older)
    await store.create(newer)
    await store.create(otherRetreat)

    const page = await store.listByRetreat({ retreatId, limit: 25 })
    expect(page.items.map((r) => r.id)).toEqual([newer.id, older.id])
    expect(page.nextCursor).toBeNull()
  })

  it('paginates listByRetreat with cursor', async () => {
    const store = createMemoryRetreatRegistrationStore()
    const retreatId = 'retreat-1'
    const r1 = sampleRegistration({
      retreatId,
      memberId: 'gd-i_tang_001',
      createdAt: '2026-07-19T03:00:00.000Z',
      updatedAt: '2026-07-19T03:00:00.000Z',
    })
    const r2 = sampleRegistration({
      retreatId,
      memberId: 'gd-i_tang_002',
      createdAt: '2026-07-19T02:00:00.000Z',
      updatedAt: '2026-07-19T02:00:00.000Z',
    })

    await store.create(r1)
    await store.create(r2)

    const page1 = await store.listByRetreat({ retreatId, limit: 1 })
    expect(page1.items.map((r) => r.id)).toEqual([r1.id])
    expect(page1.nextCursor).toBe(r1.id)

    const page2 = await store.listByRetreat({
      retreatId,
      limit: 1,
      cursor: page1.nextCursor!,
    })
    expect(page2.items.map((r) => r.id)).toEqual([r2.id])
    expect(page2.nextCursor).toBeNull()
  })
})
