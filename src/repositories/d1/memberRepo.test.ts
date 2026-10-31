import { describe, expect, it } from 'vitest'
import type { DataApiBody, DataApiClient } from '#/data/apiClient'
import { DATA_API_MAX_IDS } from '#/domain/dataApiLimits'
import { createD1MemberRepo } from './memberRepo'

/** Records each request and answers with `respond`. */
function fakeApi(respond: (route: string, body: DataApiBody) => unknown) {
  const calls: Array<{ route: string; body: DataApiBody }> = []
  const api: DataApiClient = {
    post: async <T>(route: string, body: DataApiBody = {}) => {
      calls.push({ route, body })
      return respond(route, body) as T
    },
    get: async <T>(route: string) => respond(route, {}) as T,
  }
  return { api, calls }
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => `id-${i}`)

describe('createD1MemberRepo', () => {
  it('deletes in requests of at most the Worker cap, and none for no ids', async () => {
    const { api, calls } = fakeApi(() => ({ ok: true }))
    const repo = createD1MemberRepo(api)
    await repo.deleteMany([])
    expect(calls).toEqual([])

    await repo.deleteMany(ids(DATA_API_MAX_IDS + 1))
    expect(calls.map((call) => (call.body.ids as string[]).length)).toEqual([DATA_API_MAX_IDS, 1])
  })

  it('looks up members of each temple id once', async () => {
    const { api, calls } = fakeApi(() => [])
    await createD1MemberRepo(api).listByCurrentTempleIds(['t1', 't1', 't2'])
    expect(calls).toEqual([{ route: 'members/by-temples', body: { templeIds: ['t1', 't2'] } }])
  })

  it('exports every page', async () => {
    const { api, calls } = fakeApi((_route, body) =>
      body.cursor === undefined
        ? { items: [{ id: 'm1' }], nextCursor: 'c1' }
        : { items: [{ id: 'm2' }], nextCursor: null },
    )
    const members = await createD1MemberRepo(api).listAllForExport({ sanghaType: 'tang', status: 'locked' })
    expect(members.map((member) => member.id)).toEqual(['m1', 'm2'])
    expect(calls.map((call) => call.body)).toEqual([
      { sanghaType: 'tang', status: 'locked', limit: 500, cursor: undefined },
      { sanghaType: 'tang', status: 'locked', limit: 500, cursor: 'c1' },
    ])
  })

  it('returns the count of the hạ lạp tab', async () => {
    const { api } = fakeApi(() => ({ count: 7 }))
    expect(await createD1MemberRepo(api).countByHaLapTab({ sanghaType: 'ni', haLapTabRank: 'ni_su' })).toBe(7)
  })
})
