import type { Member, SanghaType, Temple } from '#/domain/types'
import {
  toMemberSearchDoc,
  toTempleSearchDoc,
} from '#/domain/searchDocs'
import {
  reindexEnsure,
  reindexImport,
  reindexImportFromDb,
} from '#/search/searchApiClient'

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

async function importAllFromDb(
  idToken: string,
  collection: 'members' | 'temples',
): Promise<number> {
  let total = 0
  let cursor: string | null = null
  do {
    const page = await reindexImportFromDb({ idToken, collection, cursor })
    total += page.imported
    cursor = page.nextCursor
  } while (cursor)
  return total
}

/** D1 backend: the Worker reads the records itself, page by page (nothing is loaded in the browser). */
export async function reindexDirectorySearchFromDb(input: {
  idToken: string
}): Promise<{ members: number; temples: number }> {
  await reindexEnsure({ idToken: input.idToken })
  const members = await importAllFromDb(input.idToken, 'members')
  const temples = await importAllFromDb(input.idToken, 'temples')
  return { members, temples }
}
