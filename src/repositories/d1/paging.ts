import type { AdminListPage } from '#/repositories/adminListTypes'

/** The Worker's page size cap, used for exports. */
export const MAX_PAGE_SIZE = 500
/** The Worker's cap on ids per request (delete-many, by-temples, review). */
export const MAX_IDS = 500

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** Every page of a list, in order (exports). */
export async function collectPages<T>(
  loadPage: (cursor: string | undefined) => Promise<AdminListPage<T>>,
): Promise<T[]> {
  const all: T[] = []
  let cursor: string | undefined
  do {
    const page = await loadPage(cursor)
    all.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return all
}
