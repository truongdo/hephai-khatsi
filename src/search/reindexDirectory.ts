import { reindexEnsure, reindexImportFromDb } from '#/search/searchApiClient'

async function importAll(
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

/** Rebuilds the search index: the Worker reads D1 page by page (nothing is loaded in the browser). */
export async function reindexDirectorySearch(input: {
  idToken: string
}): Promise<{ members: number; temples: number }> {
  await reindexEnsure({ idToken: input.idToken })
  const members = await importAll(input.idToken, 'members')
  const temples = await importAll(input.idToken, 'temples')
  return { members, temples }
}
