import { afterEach, describe, expect, it, vi } from 'vitest'
import { memberDraft, templeDraft } from '#/domain/authz/testFixtures'
import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
} from '#/domain/searchDocs'
import type { Env } from '../env'
import { createSearchSync } from './searchSync'

const env = { TYPESENSE_API_KEY: 'key', TYPESENSE_HOST: 'https://search.test' } as Env

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(response: () => Response) {
  const fetchMock = vi.fn(async () => response())
  vi.stubGlobal('fetch', fetchMock)
  const pending: Promise<unknown>[] = []
  const sync = createSearchSync(env, (promise) => pending.push(promise))
  return { fetchMock, sync, settle: () => Promise.all(pending) }
}

describe('createSearchSync', () => {
  it('upserts and deletes documents after the response', async () => {
    const { fetchMock, sync, settle } = setup(() => new Response('{}'))
    sync.upsertMember(memberDraft())
    sync.deleteTemple(templeDraft().id)
    await settle()
    const urls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]))
    expect(urls[0]).toContain(`/collections/${TYPESENSE_MEMBERS_COLLECTION}/documents`)
    expect(urls[1]).toContain(`/collections/${TYPESENSE_TEMPLES_COLLECTION}/documents/${templeDraft().id}`)
  })

  it('logs a failure instead of failing the save', async () => {
    const { sync, settle } = setup(() => new Response('down', { status: 503 }))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    sync.upsertTemple(templeDraft())
    await expect(settle()).resolves.toBeDefined()
    expect(log).toHaveBeenCalledWith('[search-sync] temple upsert failed', expect.any(Error))
  })
})
