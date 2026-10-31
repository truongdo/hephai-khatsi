import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
  toMemberSearchDoc,
  toTempleSearchDoc,
} from '#/domain/searchDocs'
import type { Env } from '../env'
import { createTypesenseClient } from '../typesenseClient'
import type { SearchSync } from './context'

/**
 * Keeps Typesense in step with D1 writes after the response is sent. A
 * failure is logged and never fails the save (`/api/search/reindex` repairs
 * the index).
 */
export function createSearchSync(env: Env, waitUntil: (promise: Promise<unknown>) => void): SearchSync {
  const client = createTypesenseClient(env)
  const run = (action: string, task: () => Promise<void>) => {
    waitUntil(
      task().catch((error: unknown) => {
        console.error(`[search-sync] ${action} failed`, error)
      }),
    )
  }
  return {
    upsertMember: (member) =>
      run('member upsert', () => client.upsert(TYPESENSE_MEMBERS_COLLECTION, toMemberSearchDoc(member))),
    upsertTemple: (temple) =>
      run('temple upsert', () => client.upsert(TYPESENSE_TEMPLES_COLLECTION, toTempleSearchDoc(temple))),
    deleteMember: (id) =>
      run('member delete', () => client.deleteDocument(TYPESENSE_MEMBERS_COLLECTION, id)),
    deleteTemple: (id) =>
      run('temple delete', () => client.deleteDocument(TYPESENSE_TEMPLES_COLLECTION, id)),
  }
}
