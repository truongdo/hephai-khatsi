import type { Member, SanghaType, Temple } from '#/domain/types'
import {
  toMemberSearchDoc,
  toTempleSearchDoc,
} from '#/domain/searchDocs'
import { reindexEnsure, reindexImport } from '#/search/searchApiClient'

const BATCH_SIZE = 40

async function importBatches(
  idToken: string,
  collection: 'members' | 'temples',
  documents: object[],
): Promise<void> {
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)
    await reindexImport({ idToken, collection, documents: batch })
  }
}

export async function reindexDirectorySearch(input: {
  idToken: string
  listMembers: (input: { sanghaType: SanghaType }) => Promise<Member[]>
  listTemples: () => Promise<Temple[]>
}): Promise<{ members: number; temples: number }> {
  await reindexEnsure({ idToken: input.idToken })

  const [tangMembers, niMembers, temples] = await Promise.all([
    input.listMembers({ sanghaType: 'tang' }),
    input.listMembers({ sanghaType: 'ni' }),
    input.listTemples(),
  ])

  const memberDocs = [...tangMembers, ...niMembers].map(toMemberSearchDoc)
  const templeDocs = temples.map(toTempleSearchDoc)

  await importBatches(input.idToken, 'members', memberDocs)
  await importBatches(input.idToken, 'temples', templeDocs)

  return { members: memberDocs.length, temples: templeDocs.length }
}
