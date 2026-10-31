import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
  toMemberSearchDoc,
  toTempleSearchDoc,
  type MemberSearchDoc,
  type TempleSearchDoc,
} from '#/domain/searchDocs'
import { memberFromRow, type MemberRow } from './dataApi/rows/member'
import { templeFromRow, type TempleRow } from './dataApi/rows/temple'
import type { Env } from './env'
import { createTypesenseClient } from './typesenseClient'
import {
  verifyFirebaseAdminToken,
  verifyHePhaiAdminToken,
} from './verifyFirebaseAdmin'

const SEARCH_PER_PAGE = 8

type SearchCollection = 'members' | 'temples'

type SearchBody = { q?: string }
type ReindexBody = {
  phase?: 'ensure' | 'import-from-db'
  collection?: SearchCollection
  /** `import-from-db`: the last id of the previous page. */
  cursor?: string
}

/** Rows per `import-from-db` call (one Typesense import each). */
const REINDEX_PAGE_SIZE = 250

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

  if (body.phase === 'import-from-db') {
    const { collection, cursor } = body
    if (!isSearchCollection(collection)) {
      return jsonError('Missing required fields', 400)
    }
    const page = await readSearchDocsPage(env.DB, collection, cursor ?? '')
    if (page.documents.length > 0) {
      await client.importDocuments(toTypesenseCollection(collection), page.documents)
    }
    return Response.json({ ok: true, imported: page.documents.length, nextCursor: page.nextCursor })
  }

  return jsonError('Invalid phase', 400)
}

/** One page of search documents built from D1, in id order (the reindex reads the database itself). */
export async function readSearchDocsPage(
  db: D1Database,
  collection: SearchCollection,
  afterId: string,
): Promise<{ documents: Array<MemberSearchDoc | TempleSearchDoc>; nextCursor: string | null }> {
  const statement = db
    .prepare(`SELECT * FROM ${collection} WHERE id > ? ORDER BY id LIMIT ?`)
    .bind(afterId, REINDEX_PAGE_SIZE)
  const documents =
    collection === 'members'
      ? (await statement.all<MemberRow>()).results.map((row) => toMemberSearchDoc(memberFromRow(row)))
      : (await statement.all<TempleRow>()).results.map((row) => toTempleSearchDoc(templeFromRow(row)))
  const last = documents[documents.length - 1]
  return {
    documents,
    nextCursor: documents.length === REINDEX_PAGE_SIZE && last ? last.id : null,
  }
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

  if (pathname === '/api/search/reindex' && request.method === 'POST') {
    return handleReindex(request, env)
  }

  return new Response('Not found', { status: 404 })
}
