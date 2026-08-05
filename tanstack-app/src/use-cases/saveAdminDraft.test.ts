import { describe, expect, it } from 'vitest'
import type { AuthClaims } from '#/domain/authClaims'
import { memberCccdIndexId } from '#/domain/memberCccdIndex'
import { ADMIN_AUDIT } from '#/test/auditActors'
import { createMemoryMemberStore, createMemoryTempleStore } from '#/test/memoryStores'
import { saveAdminMember } from './saveAdminMember'
import { saveAdminTemple } from './saveAdminTemple'

const HE_PHAI_CLAIMS: AuthClaims = { role: 'he_phai_admin', orgUnitId: null }
const GIAO_DOAN_CLAIMS: AuthClaims = {
  role: 'giao_doan_admin',
  orgUnitId: 'gd-i',
}

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
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
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
        ADMIN_AUDIT,
        HE_PHAI_CLAIMS,
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
        editRequestedAt: null,
        editRequestedBy: null,
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
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
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
        ADMIN_AUDIT,
        HE_PHAI_CLAIMS,
        createMemoryMemberStore([]),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('updates a locked member via saveAdminMember and preserves locked status', async () => {
    const store = createMemoryMemberStore([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        status: 'locked',
        cccd: '001099012345',
        inviteId: 'inv-1',
        currentTempleId: null,
        photoPath: null,
        phapDanh: 'Old',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'admin-1',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { member, mode } = await saveAdminMember(
      {
        memberId: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        patch: { phapDanh: 'New' },
      },
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    )
    expect(mode).toBe('updated')
    expect(member.phapDanh).toBe('New')
    expect(member.status).toBe('locked')
    expect(member.lockedBy).toBe('admin-1')
    expect(member.inviteId).toBe('inv-1')
  })

  it('setPhotoPath works on locked members', async () => {
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
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'admin-1',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const updated = await store.setPhotoPath(
      'm1',
      'members/m1/photo.jpg',
      ADMIN_AUDIT,
    )
    expect(updated.photoPath).toBe('members/m1/photo.jpg')
    expect(updated.status).toBe('locked')
  })

  it('updateDraftById rejects locked member without allowWhenLocked', async () => {
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
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'admin-1',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    await expect(
      store.updateDraftById('m1', { phapDanh: 'New' }),
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
        editRequestedAt: null,
        editRequestedBy: null,
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
        ADMIN_AUDIT,
        HE_PHAI_CLAIMS,
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
        ADMIN_AUDIT,
        HE_PHAI_CLAIMS,
        store,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects email change when member has directoryRole', async () => {
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
        email: 'old@gmail.com',
        directoryRole: 'giao_doan_admin',
        directoryAuthUid: 'auth-1',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    await expect(
      saveAdminMember(
        {
          memberId: 'm1',
          orgUnitId: 'gd-i',
          sanghaType: 'tang',
          patch: { email: 'new@gmail.com' },
        },
        ADMIN_AUDIT,
        HE_PHAI_CLAIMS,
        store,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Revoke Thư ký before changing email',
    })
  })

  it('allows same email update when member has directoryRole', async () => {
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
        email: 'Sec@gmail.com',
        directoryRole: 'giao_doan_admin',
        directoryAuthUid: 'auth-1',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
        phapDanh: 'Old',
      },
    ])
    const { member } = await saveAdminMember(
      {
        memberId: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        patch: { email: 'sec@gmail.com', phapDanh: 'New' },
      },
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    )
    expect(member.phapDanh).toBe('New')
    expect(member.email).toBe('sec@gmail.com')
  })

  it('strips directoryRole fields from patch on update', async () => {
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
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { member } = await saveAdminMember(
      {
        memberId: 'm1',
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        patch: {
          phapDanh: 'New',
          directoryRole: 'giao_doan_admin',
          directoryAuthUid: 'forged',
          directoryRoleGrantedAt: '2026-01-01T00:00:00.000Z',
          directoryRoleGrantedBy: 'forged',
        } as never,
      },
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    )
    expect(member.phapDanh).toBe('New')
    expect(member.directoryRole).toBeUndefined()
    expect(member.directoryAuthUid).toBeUndefined()
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
        editRequestedAt: null,
        editRequestedBy: null,
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
        editRequestedAt: null,
        editRequestedBy: null,
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
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    )
    expect(mode).toBe('updated')
    expect(member.id).toBe('m1')
    expect(member.phapDanh).toBe('New')
    expect(store.members.size).toBe(2)
  })

  it('rejects cross-org create for giao_doan_admin', async () => {
    await expect(
      saveAdminMember(
        {
          orgUnitId: 'gd-ii',
          sanghaType: 'tang',
          cccd: '001099012345',
          patch: {},
        },
        ADMIN_AUDIT,
        GIAO_DOAN_CLAIMS,
        createMemoryMemberStore([]),
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Org unit out of scope',
    })
  })

  it('allows create in own org for giao_doan_admin', async () => {
    const store = createMemoryMemberStore([])
    const { member, mode } = await saveAdminMember(
      {
        orgUnitId: 'gd-i',
        sanghaType: 'tang',
        cccd: '001099012345',
        patch: { phapDanh: 'Thiện' },
      },
      ADMIN_AUDIT,
      GIAO_DOAN_CLAIMS,
      store,
    )
    expect(mode).toBe('created')
    expect(member.orgUnitId).toBe('gd-i')
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
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
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
        photoPath: null,
        danhHieu: 'Old',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: null,
        lockedBy: null,
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { temple, mode } = await saveAdminTemple(
      {
        orgUnitId: 'gd-i',
        templeId: 't1',
        patch: { danhHieu: 'New' },
      },
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    )
    expect(mode).toBe('updated')
    expect(temple.danhHieu).toBe('New')
    expect(temple.inviteId).toBe('inv-1')
  })

  it('updates a locked temple and preserves locked status', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'locked',
        managerPhones: ['0901234567'],
        inviteId: 'inv-1',
        photoPath: null,
        danhHieu: 'Old',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'admin-1',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const { temple, mode } = await saveAdminTemple(
      {
        orgUnitId: 'gd-i',
        templeId: 't1',
        patch: { danhHieu: 'New' },
      },
      ADMIN_AUDIT,
      HE_PHAI_CLAIMS,
      store,
    )
    expect(mode).toBe('updated')
    expect(temple.danhHieu).toBe('New')
    expect(temple.status).toBe('locked')
    expect(temple.lockedBy).toBe('admin-1')
    expect(temple.inviteId).toBe('inv-1')
  })

  it('setPhotoPath works on locked temples', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-i',
        status: 'locked',
        managerPhones: ['0901234567'],
        inviteId: null,
        photoPath: null,
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        lockedAt: '2026-07-19T01:00:00.000Z',
        lockedBy: 'admin-1',
        editRequestedAt: null,
        editRequestedBy: null,
      },
    ])
    const updated = await store.setPhotoPath(
      't1',
      'temples/t1/photo.jpg',
      ADMIN_AUDIT,
    )
    expect(updated.photoPath).toBe('temples/t1/photo.jpg')
    expect(updated.status).toBe('locked')
  })

  it('rejects cross-org save for giao_doan_admin', async () => {
    const store = createMemoryTempleStore([
      {
        id: 't1',
        orgUnitId: 'gd-ii',
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
      },
    ])
    await expect(
      saveAdminTemple(
        {
          orgUnitId: 'gd-ii',
          templeId: 't1',
          patch: { danhHieu: 'New' },
        },
        ADMIN_AUDIT,
        GIAO_DOAN_CLAIMS,
        store,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Org unit out of scope',
    })
  })
})
