import type { AdminListPage } from '#/repositories/adminListTypes'

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
