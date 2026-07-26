import { describe, expect, it } from 'vitest'
import { DomainError } from '#/domain/errors'
import type { Retreat, RetreatStatus, RetreatWritableFields } from '#/domain/retreat'
import type { AdminListPage, ListRetreatsAdminInput } from '#/repositories/adminListTypes'
import type { CreateRetreatInput, RetreatStore } from './retreatRepo'

const validFields = (): RetreatWritableFields => ({
  name: 'Khóa tu hè',
  diaDiem: 'TX Trung Tâm',
  noiDung: 'Thiền',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T00:00:00.000Z',
  thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-20T00:00:00.000Z',
  extraFields: [{ key: 'phong', label: 'Phòng', required: false }],
  quyenDangKy: 'both',
})

function listInMemory(
  retreats: Iterable<Retreat>,
  input: ListRetreatsAdminInput,
): AdminListPage<Retreat> {
  const limit = input.limit ?? 25
  let items = [...retreats].filter(
    (retreat) =>
      (!input.orgUnitId || retreat.orgUnitId === input.orgUnitId) &&
      (!input.status || retreat.status === input.status),
  )
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

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

function createMemoryRetreatStore(): RetreatStore & { retreats: Map<string, Retreat> } {
  const retreats = new Map<string, Retreat>()
  let counter = 0

  return {
    retreats,
    async create(input: CreateRetreatInput) {
      counter += 1
      const now = `2026-07-19T0${counter}:00:00.000Z`
      const retreat: Retreat = {
        id: `retreat-${counter}`,
        type: 'giao_doan',
        orgUnitId: input.orgUnitId,
        status: 'draft',
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        ...input.fields,
      }
      retreats.set(retreat.id, retreat)
      return retreat
    },
    async getById(id: string) {
      return retreats.get(id) ?? null
    },
    async update(id: string, fields: RetreatWritableFields) {
      const existing = retreats.get(id)
      if (!existing) {
        throw new DomainError('NOT_FOUND', 'Retreat not found')
      }
      const now = '2026-07-19T10:00:00.000Z'
      const retreat: Retreat = {
        ...existing,
        ...fields,
        id: existing.id,
        type: existing.type,
        orgUnitId: existing.orgUnitId,
        status: existing.status,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        updatedAt: now,
      }
      retreats.set(id, retreat)
      return retreat
    },
    async setStatus(id: string, status: RetreatStatus) {
      const existing = retreats.get(id)
      if (!existing) {
        throw new DomainError('NOT_FOUND', 'Retreat not found')
      }
      const now = '2026-07-19T11:00:00.000Z'
      const retreat: Retreat = {
        ...existing,
        status,
        updatedAt: now,
      }
      retreats.set(id, retreat)
      return retreat
    },
    async list(input: ListRetreatsAdminInput) {
      return listInMemory(retreats.values(), input)
    },
    async delete(id: string) {
      retreats.delete(id)
    },
  }
}

describe('RetreatStore memory contract', () => {
  it('create → getById → update → setStatus → list filter → delete', async () => {
    const store = createMemoryRetreatStore()

    const created = await store.create({
      orgUnitId: 'gd-i',
      createdBy: 'admin-1',
      fields: validFields(),
    })
    expect(created.type).toBe('giao_doan')
    expect(created.status).toBe('draft')
    expect(created.orgUnitId).toBe('gd-i')
    expect(created.createdBy).toBe('admin-1')

    const fetched = await store.getById(created.id)
    expect(fetched).toEqual(created)

    const updated = await store.update(created.id, {
      ...validFields(),
      name: 'Khóa tu thu',
    })
    expect(updated.name).toBe('Khóa tu thu')
    expect(updated.status).toBe('draft')
    expect(updated.type).toBe('giao_doan')

    const opened = await store.setStatus(created.id, 'open')
    expect(opened.status).toBe('open')

    await store.create({
      orgUnitId: 'gd-ii',
      createdBy: 'admin-2',
      fields: validFields(),
    })
    const closed = await store.setStatus(created.id, 'closed')
    expect(closed.status).toBe('closed')

    const draftPage = await store.list({ orgUnitId: 'gd-i', status: 'draft', limit: 25 })
    expect(draftPage.items).toHaveLength(0)

    const closedPage = await store.list({ orgUnitId: 'gd-i', status: 'closed', limit: 25 })
    expect(closedPage.items).toHaveLength(1)
    expect(closedPage.items[0]!.id).toBe(created.id)

    await store.delete(created.id)
    expect(await store.getById(created.id)).toBeNull()
  })

  it('paginates list by updatedAt desc with cursor', async () => {
    const store = createMemoryRetreatStore()
    const r1 = await store.create({
      orgUnitId: 'gd-i',
      createdBy: 'admin-1',
      fields: validFields(),
    })
    const r2 = await store.create({
      orgUnitId: 'gd-i',
      createdBy: 'admin-1',
      fields: validFields(),
    })
    store.retreats.set(r1.id, { ...r1, updatedAt: '2026-07-19T03:00:00.000Z' })
    store.retreats.set(r2.id, { ...r2, updatedAt: '2026-07-19T02:00:00.000Z' })

    const page1 = await store.list({ orgUnitId: 'gd-i', limit: 1 })
    expect(page1.items.map((r) => r.id)).toEqual([r1.id])
    expect(page1.nextCursor).toBe(r1.id)

    const page2 = await store.list({
      orgUnitId: 'gd-i',
      limit: 1,
      cursor: page1.nextCursor!,
    })
    expect(page2.items.map((r) => r.id)).toEqual([r2.id])
    expect(page2.nextCursor).toBeNull()
  })
})
