import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocsMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({
    field,
    op,
    value,
  })),
  limit: vi.fn((n: number) => ({ limit: n })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  doc: vi.fn(),
  getDoc: vi.fn(),
  orderBy: vi.fn(),
  startAfter: vi.fn(),
  runTransaction: vi.fn(),
}))

vi.mock('#/firebase/firestore', () => ({
  getClientFirestore: () => ({ _mock: true }),
}))

describe('memberRepo.listDirectorySecretaries', () => {
  beforeEach(() => {
    vi.resetModules()
    getDocsMock.mockReset()
  })

  it('queries members with directoryRole giao_doan_admin and limit 200', async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 'm1',
          data: () => ({
            orgUnitId: 'gd-i',
            sanghaType: 'tang',
            status: 'locked',
            cccd: '001099012345',
            inviteId: null,
            currentTempleId: null,
            photoPath: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            lockedAt: null,
            lockedBy: null,
            editRequestedAt: null,
            editRequestedBy: null,
            directoryRole: 'giao_doan_admin',
            email: 'sec@gmail.com',
          }),
        },
      ],
    })

    const { memberRepo } = await import('#/repositories/memberRepo')
    const { where, limit } = await import('firebase/firestore')
    const members = await memberRepo.listDirectorySecretaries()

    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({
      id: 'm1',
      directoryRole: 'giao_doan_admin',
      email: 'sec@gmail.com',
    })
    expect(where).toHaveBeenCalledWith('directoryRole', '==', 'giao_doan_admin')
    expect(limit).toHaveBeenCalledWith(200)
    expect(getDocsMock).toHaveBeenCalledOnce()
  })
})

describe('memberRepo.listHePhaiSecretaries', () => {
  beforeEach(() => {
    vi.resetModules()
    getDocsMock.mockReset()
  })

  it('queries members with directoryRole he_phai_secretary and limit 200', async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 'm2',
          data: () => ({
            orgUnitId: 'gd-i',
            sanghaType: 'tang',
            status: 'locked',
            cccd: '001099012346',
            inviteId: null,
            currentTempleId: null,
            photoPath: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            lockedAt: null,
            lockedBy: null,
            editRequestedAt: null,
            editRequestedBy: null,
            directoryRole: 'he_phai_secretary',
            email: 'hp@gmail.com',
          }),
        },
      ],
    })

    const { memberRepo } = await import('#/repositories/memberRepo')
    const { where, limit } = await import('firebase/firestore')
    const members = await memberRepo.listHePhaiSecretaries()

    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({
      id: 'm2',
      directoryRole: 'he_phai_secretary',
      email: 'hp@gmail.com',
    })
    expect(where).toHaveBeenCalledWith('directoryRole', '==', 'he_phai_secretary')
    expect(limit).toHaveBeenCalledWith(200)
    expect(getDocsMock).toHaveBeenCalledOnce()
  })
})
