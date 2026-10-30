import { describe, expect, it } from 'vitest'
import type { AuthClaims } from '#/domain/authClaims'
import { DomainError } from '#/domain/errors'
import type { Retreat, RetreatStatus, RetreatWritableFields } from '#/domain/retreat'
import type { AdminListPage, ListRetreatsAdminInput } from '#/repositories/adminListTypes'
import type { CreateRetreatInput, RetreatStore } from '#/repositories/retreatRepo'
import { createRetreat } from './createRetreat'
import { updateRetreat } from './updateRetreat'
import { openRetreat } from './openRetreat'
import { closeRetreat } from './closeRetreat'
import { deleteRetreat } from './deleteRetreat'

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

describe('retreat use-cases', () => {
  it('giao_doan_admin creates for own org', async () => {
    const store = createMemoryRetreatStore()
    const claims: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    const retreat = await createRetreat(
      claims,
      { createdBy: 'admin-1', fields: validFields() },
      store,
    )

    expect(retreat.orgUnitId).toBe('gd-i')
    expect(retreat.status).toBe('draft')
    expect(retreat.createdBy).toBe('admin-1')
  })

  it('giao_doan_admin cannot create for other org', async () => {
    const store = createMemoryRetreatStore()
    const claims: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    await expect(
      createRetreat(
        claims,
        { orgUnitId: 'gd-ii', createdBy: 'admin-1', fields: validFields() },
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('kiem_soat cannot create', async () => {
    const store = createMemoryRetreatStore()
    const claims: AuthClaims = { role: 'kiem_soat', orgUnitId: 'gd-i' }

    await expect(
      createRetreat(
        claims,
        { orgUnitId: 'gd-i', createdBy: 'admin-1', fields: validFields() },
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('he_phai_admin creates for any org', async () => {
    const store = createMemoryRetreatStore()
    const claims: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }

    const retreat = await createRetreat(
      claims,
      { orgUnitId: 'gd-ii', createdBy: 'admin-1', fields: validFields() },
      store,
    )

    expect(retreat.orgUnitId).toBe('gd-ii')
  })

  it('open, close, and delete draft retreat', async () => {
    const store = createMemoryRetreatStore()
    const claims: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }

    const draft = await createRetreat(
      claims,
      { orgUnitId: 'gd-i', createdBy: 'admin-1', fields: validFields() },
      store,
    )

    const opened = await openRetreat(claims, draft.id, store)
    expect(opened.status).toBe('open')

    const closed = await closeRetreat(claims, draft.id, store)
    expect(closed.status).toBe('closed')

    const reopened = await openRetreat(claims, draft.id, store)
    expect(reopened.status).toBe('open')

    await closeRetreat(claims, draft.id, store)
    store.retreats.set(draft.id, { ...draft, status: 'draft' })

    await deleteRetreat(claims, draft.id, store)
    expect(await store.getById(draft.id)).toBeNull()
  })

  it('rejects open, close, and delete when status is invalid', async () => {
    const store = createMemoryRetreatStore()
    const claims: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }

    const draft = await createRetreat(
      claims,
      { orgUnitId: 'gd-i', createdBy: 'admin-1', fields: validFields() },
      store,
    )

    await expect(closeRetreat(claims, draft.id, store)).rejects.toMatchObject({
      code: 'INVALID_STATUS',
    })

    const opened = await openRetreat(claims, draft.id, store)

    await expect(openRetreat(claims, opened.id, store)).rejects.toMatchObject({
      code: 'INVALID_STATUS',
    })
    await expect(deleteRetreat(claims, opened.id, store)).rejects.toMatchObject({
      code: 'INVALID_STATUS',
    })
  })

  it('giao_doan_admin cannot update other org retreat', async () => {
    const store = createMemoryRetreatStore()
    const hePhai: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }
    const giaoDoan: AuthClaims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    const retreat = await createRetreat(
      hePhai,
      { orgUnitId: 'gd-ii', createdBy: 'admin-1', fields: validFields() },
      store,
    )

    await expect(
      updateRetreat(
        giaoDoan,
        { retreatId: retreat.id, fields: validFields() },
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
