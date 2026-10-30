import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
  type MemberSearchDoc,
  type TempleSearchDoc,
} from '#/domain/searchDocs'
import type { Env } from './env'
import { inviteExists } from './firestoreRest'
import { createTypesenseClient } from './typesenseClient'
import {
  verifyFirebaseAdminToken,
  verifyHePhaiAdminToken,
} from './verifyFirebaseAdmin'

const SEARCH_PER_PAGE = 8

type SearchCollection = 'members' | 'temples'

type SearchBody = { q?: string }
type UpsertBody = {
  collection?: SearchCollection
  document?: MemberSearchDoc | TempleSearchDoc
  inviteToken?: string
}
type DeleteBody = { collection?: SearchCollection; id?: string }
type ReindexBody = {
  phase?: 'ensure' | 'import'
  collection?: SearchCollection
  documents?: object[]
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

function toTypesenseCollection(collection: SearchCollection): string {
  return collection === 'members'
    ? TYPESENSE_MEMBERS_COLLECTION
    : TYPESENSE_TEMPLES_COLLECTION
}

function isSearchCollection(value: unknown): value is SearchCollection {
  return value === 'members' || value === 'temples'
}

async function requireDirectoryAdmin(
  request: Request,
  env: Env,
): Promise<
  | { ok: true; claim: { uid: string; role: string; orgUnitId: string | null } }
  | { ok: false; response: Response }
> {
  const token = bearerToken(request)
  if (!token) return { ok: false, response: jsonError('Unauthorized', 401) }

  const claim = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
  if (!claim) return { ok: false, response: jsonError('Forbidden', 403) }

  return { ok: true, claim }
}

async function handleSearch(request: Request, env: Env): Promise<Response> {
  const auth = await requireDirectoryAdmin(request, env)
  if (!auth.ok) return auth.response

  let body: SearchBody
  try {
    body = (await request.json()) as SearchBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const q = body.q ?? ''
  if (!q.trim()) {
    return Response.json({ members: [], temples: [] })
  }

  if (auth.claim.role === 'giao_doan_admin') {
    if (!auth.claim.orgUnitId) {
      return jsonError('Forbidden', 403)
    }
  }

  const client = createTypesenseClient(env)
  const filterBy =
    auth.claim.role === 'giao_doan_admin'
      ? `orgUnitId:=${auth.claim.orgUnitId}`
      : undefined

  const results = await client.multiSearch({
    q,
    perPage: SEARCH_PER_PAGE,
    ...(filterBy ? { filterBy } : {}),
  })

  return Response.json(results)
}

async function handleUpsert(request: Request, env: Env): Promise<Response> {
  let body: UpsertBody
  try {
    body = (await request.json()) as UpsertBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { collection, document, inviteToken } = body
  if (!isSearchCollection(collection) || !document || typeof document !== 'object') {
    return jsonError('Missing required fields', 400)
  }

  const token = bearerToken(request)
  if (token) {
    const admin = await verifyFirebaseAdminToken(token, env.FIREBASE_PROJECT_ID)
    if (!admin) return jsonError('Unauthorized', 401)
  } else if (inviteToken) {
    const exists = await inviteExists(env.FIREBASE_PROJECT_ID, inviteToken)
    if (!exists) return jsonError('Unauthorized', 401)
  } else {
    return jsonError('Unauthorized', 401)
  }

  const client = createTypesenseClient(env)
  await client.upsert(toTypesenseCollection(collection), document)

  return Response.json({ ok: true })
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  const auth = await requireDirectoryAdmin(request, env)
  if (!auth.ok) return auth.response

  let body: DeleteBody
  try {
    body = (await request.json()) as DeleteBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { collection, id } = body
  if (!isSearchCollection(collection) || !id) {
    return jsonError('Missing required fields', 400)
  }

  const client = createTypesenseClient(env)
  await client.deleteDocument(toTypesenseCollection(collection), id)

  return Response.json({ ok: true })
}

async function handleReindex(request: Request, env: Env): Promise<Response> {
  const token = bearerToken(request)
  if (!token) return jsonError('Unauthorized', 401)

  const admin = await verifyHePhaiAdminToken(token, env.FIREBASE_PROJECT_ID)
  if (!admin) return jsonError('Forbidden', 403)

  let body: ReindexBody
  try {
    body = (await request.json()) as ReindexBody
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const client = createTypesenseClient(env)

  if (body.phase === 'ensure') {
    await client.recreateCollections()
    return Response.json({ ok: true })
  }

  if (body.phase === 'import') {
    const { collection, documents } = body
    if (!isSearchCollection(collection) || !Array.isArray(documents)) {
      return jsonError('Missing required fields', 400)
    }
    await client.importDocuments(toTypesenseCollection(collection), documents)
    return Response.json({ ok: true, imported: documents.length })
  }

  return jsonError('Invalid phase', 400)
}

export async function handleSearchApi(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith('/api/search')) return null

  if (pathname === '/api/search' && request.method === 'POST') {
    return handleSearch(request, env)
  }

  if (pathname === '/api/search/upsert' && request.method === 'POST') {
    return handleUpsert(request, env)
  }

  if (pathname === '/api/search/delete' && request.method === 'POST') {
    return handleDelete(request, env)
  }

  if (pathname === '/api/search/reindex' && request.method === 'POST') {
    return handleReindex(request, env)
  }

  return new Response('Not found', { status: 404 })
}
