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

export async function upsertSearchDocument(input: {
  collection: SearchCollection
  document: MemberSearchDoc | TempleSearchDoc
  idToken?: string
  inviteToken?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    collection: input.collection,
    document: input.document,
  }
  if (input.inviteToken) {
    body.inviteToken = input.inviteToken
  }

  const response = await fetch('/api/search/upsert', {
    method: 'POST',
    headers: authHeaders(input.idToken),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }
}

export async function deleteSearchDocument(input: {
  collection: SearchCollection
  id: string
  idToken: string
}): Promise<void> {
  const response = await fetch('/api/search/delete', {
    method: 'POST',
    headers: authHeaders(input.idToken),
    body: JSON.stringify({
      collection: input.collection,
      id: input.id,
    }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
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

export async function reindexImport(input: {
  idToken: string
  collection: SearchCollection
  documents: object[]
}): Promise<{ imported: number }> {
  const response = await fetch('/api/search/reindex', {
    method: 'POST',
    headers: authHeaders(input.idToken),
    body: JSON.stringify({
      phase: 'import',
      collection: input.collection,
      documents: input.documents,
    }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const body = (await response.json()) as { imported?: number }
  return { imported: body.imported ?? input.documents.length }
}
