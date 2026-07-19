import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'

type DocData = Record<string, unknown>

function createFirestoreMock() {
  const docs = new Map<string, DocData>()

  function docPath(collection: string, id: string) {
    return `${collection}/${id}`
  }

  function collection(name: string) {
    return {
      doc(id?: string) {
        const docId = id ?? `auto-${docs.size + 1}`
        const path = docPath(name, docId)
        return {
          id: docId,
          path,
          async get() {
            const data = docs.get(path)
            return {
              exists: data !== undefined,
              id: docId,
              data: () => data,
            }
          },
        }
      },
    }
  }

  const db = {
    collection,
    async runTransaction<T>(fn: (transaction: {
      get: (ref: { path: string }) => Promise<{
        exists: boolean
        id: string
        data: () => DocData | undefined
      }>
      set: (ref: { path: string; id: string }, data: DocData) => void
    }) => Promise<T>) {
      const transaction = {
        async get(ref: { path: string }) {
          const data = docs.get(ref.path)
          return {
            exists: data !== undefined,
            id: ref.path.split('/').at(-1)!,
            data: () => data,
          }
        },
        set(ref: { path: string; id: string }, data: DocData) {
          docs.set(ref.path, data)
        },
      }
      return fn(transaction)
    },
    _docs: docs,
  }

  return db
}

vi.mock('#/firebase/admin', () => ({
  getAdminDb: vi.fn(),
}))

describe('memberRepo.createOrUpdateDraft', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { getAdminDb } = await import('#/firebase/admin')
    const db = createFirestoreMock()
    vi.mocked(getAdminDb).mockReturnValue(db as never)
  })

  it('ignores forged orgUnitId and status in patch on create', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')

    const { member } = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'invite-1',
      cccd: '012345678901',
      patch: {
        orgUnitId: 'forged-org',
        status: 'locked',
        phapDanh: 'Minh Tam',
      } as never,
    })

    expect(member).toMatchObject({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      status: 'draft',
      cccd: '012345678901',
      inviteId: 'invite-1',
      phapDanh: 'Minh Tam',
    })

    const stored = await memberRepo.getByCccd({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      cccd: '012345678901',
    })
    expect(stored).toMatchObject({
      orgUnitId: 'gd-i',
      status: 'draft',
    })
  })

  it('ignores forged orgUnitId and status in patch on update', async () => {
    const { memberRepo } = await import('#/repositories/memberRepo')
    const { getAdminDb } = await import('#/firebase/admin')
    const db = vi.mocked(getAdminDb).mock.results[0]?.value as ReturnType<
      typeof createFirestoreMock
    >

    const created = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'invite-1',
      cccd: '012345678901',
      patch: { phapDanh: 'Minh Tam' },
    })

    const memberPath = `${COLLECTIONS.members}/${created.member.id}`
    const existing = db._docs.get(memberPath) as Omit<Member, 'id'>

    const { member } = await memberRepo.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'invite-1',
      cccd: '012345678901',
      patch: {
        orgUnitId: 'forged-org',
        status: 'locked',
        phapDanh: 'Minh Tue',
      } as never,
    })

    expect(member).toMatchObject({
      id: created.member.id,
      orgUnitId: 'gd-i',
      status: 'draft',
      phapDanh: 'Minh Tue',
      inviteId: existing.inviteId,
    })
  })
})
