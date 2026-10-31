import type { MemberSearchDoc, TempleSearchDoc } from '#/domain/searchDocs'

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status})`
}

type SearchCollection = 'members' | 'temples'

function authHeaders(idToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`
  }
  return headers
}

export async function searchDirectory(input: {
  q: string
  idToken: string
  signal?: AbortSignal
}): Promise<{ members: MemberSearchDoc[]; temples: TempleSearchDoc[] }> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: authHeaders(input.idToken),
    body: JSON.stringify({ q: input.q }),
    signal: input.signal,
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return (await response.json()) as {
    members: MemberSearchDoc[]
    temples: TempleSearchDoc[]
  }
}

export async function reindexEnsure(input: { idToken: string }): Promise<void> {
  const response = await fetch('/api/search/reindex', {
    method: 'POST',
    headers: authHeaders(input.idToken),
    body: JSON.stringify({ phase: 'ensure' }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }
}

/** One page of the Worker's own reindex from D1 (`cursor` from the previous page). */
export async function reindexImportFromDb(input: {
  idToken: string
  collection: SearchCollection
  cursor: string | null
}): Promise<{ imported: number; nextCursor: string | null }> {
  const response = await fetch('/api/search/reindex', {
    method: 'POST',
    headers: authHeaders(input.idToken),
    body: JSON.stringify({
      phase: 'import-from-db',
      collection: input.collection,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const body = (await response.json()) as { imported: number; nextCursor: string | null }
  return { imported: body.imported, nextCursor: body.nextCursor }
}
