import { describe, expect, it } from 'vitest'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import { createMemoryMemberStore, createMemoryTempleStore } from '#/test/memoryStores'
import { saveAdminMember } from './saveAdminMember'
import { saveAdminTemple } from './saveAdminTemple'

describe('saveAdminMember', () => {
  it('creates a draft with inviteId null', async () => {
    const store = createMemoryMemberStore([])
    const { member, mode } = await saveAdminMember(
      {
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '001099012345',
        patch: { phapDanh: 'Thiện' },
      },
      store,
    )
    expect(mode).toBe('created')
    expect(member.inviteId).toBeNull()
    expect(member.phapDanh).toBe('Thiện')
  })

  it('rejects invalid cccd on create', async () => {
    await expect(
      saveAdminMember(
        { orgUnitId: 'gd-i', sanghaType: 'tang', cccd: '12345678', patch: {} },
        createMemoryMemberStore([]),
      ),
    ).rejects.toMatchObject({ code: 'CCCD_INVALID' })
  })

  it('updates by memberId without requiring cccd in input', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099012345',
        inviteId: 'inv-1',
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        phapDanh: 'Old',
      },
    ])
    const { member, mode } = await saveAdminMember(
      {
        memberId: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        patch: { phapDanh: 'New' },
      },
      store,
    )
    expect(mode).toBe('updated')
    expect(member.phapDanh).toBe('New')
    expect(member.inviteId).toBe('inv-1')
    expect(member.cccd).toBe('001099012345')
  })

  it('rejects update when memberId is not found', async () => {
    await expect(
      saveAdminMember(
        {
          memberId: 'missing',
          orgUnitId: 'gd-i',
          sanghaType: 'tang',
          patch: {},
        },
        createMemoryMemberStore([]),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects update when member is locked', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'locked',
        cccd: '001099012345',
        inviteId: null,
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: '2026-07-19T00:00:00.000Z',
        lockedBy: 'admin-1',
      },
    ])
    await expect(
      saveAdminMember(
        {
          memberId: 'm1',
          orgUnitId: 'gd-i',
          sanghaType: 'tang',
          patch: { phapDanh: 'New' },
        },
        store,
      ),
    ).rejects.toMatchObject({ code: 'RECORD_LOCKED' })
  })

  it('rejects update when org unit or sangha type mismatches', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099012345',
        inviteId: null,
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
      },
    ])
    await expect(
      saveAdminMember(
        {
          memberId: 'm1',
          orgUnitId: 'other-org',
          sanghaType: 'tang',
          patch: {},
        },
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      saveAdminMember(
        {
          memberId: 'm1',
          orgUnitId: 'gd-i',
          sanghaType: 'ni',
          patch: {},
        },
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('updates by memberId even when CCCD index points elsewhere', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099012345',
        inviteId: null,
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        phapDanh: 'Old',
      },
      {
        id: 'm2',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'draft',
        cccd: '001099999999',
        inviteId: null,
        currentTempleId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
      },
    ])
    store.index.set(memberCccdIndexId('gd-i', 'tang', '001099012345'), 'm2')

    const { member, mode } = await saveAdminMember(
      {
        memberId: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        patch: { phapDanh: 'New' },
      },
      store,
    )
    expect(mode).toBe('updated')
    expect(member.id).toBe('m1')
    expect(member.phapDanh).toBe('New')
    expect(store.members.size).toBe(2)
  })
})

describe('saveAdminTemple', () => {
  it('creates a draft with inviteId null when phone present', async () => {
    const store = createMemoryTempleStore([])
    const { temple, mode } = await saveAdminTemple(
      {
        orgUnitId: 'gd-i',
        patch: {
          danhHieu: 'TX Test',
          truTriHienNay: { dienThoai: '0901234567' },
        },
      },
      store,
    )
    expect(mode).toBe('created')
    expect(temple.inviteId).toBeNull()
    expect(temple.managerPhones).toContain('0901234567')
  })

  it('updates by templeId and preserves inviteId', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'draft',
        managerPhones: ['0901234567'],
        inviteId: 'inv-1',
        danhHieu: 'Old',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
      },
    ])
    const { temple, mode } = await saveAdminTemple(
      {
        orgUnitId: 'gd-i',
        templeId: 't1',
        patch: { danhHieu: 'New' },
      },
      store,
    )
    expect(mode).toBe('updated')
    expect(temple.danhHieu).toBe('New')
    expect(temple.inviteId).toBe('inv-1')
  })
})
