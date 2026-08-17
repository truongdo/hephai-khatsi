import {
  TYPESENSE_MEMBERS_COLLECTION,
  TYPESENSE_TEMPLES_COLLECTION,
  type MemberSearchDoc,
  type TempleSearchDoc,
} from '#/domain/searchDocs'
import type { Env } from './env'

const DEFAULT_HOST = 'https://typesense.giasuai.io'

const MEMBERS_QUERY_BY = 'phapDanh,theDanh,cccd,dienThoai'
const TEMPLES_QUERY_BY = 'danhHieu,truTriPhapDanh,phones'

const membersSchema = {
  name: TYPESENSE_MEMBERS_COLLECTION,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'orgUnitId', type: 'string', facet: true },
    { name: 'sanghaType', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'phapDanh', type: 'string' },
    { name: 'theDanh', type: 'string' },
    { name: 'cccd', type: 'string' },
    { name: 'dienThoai', type: 'string' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt',
}

const templesSchema = {
  name: TYPESENSE_TEMPLES_COLLECTION,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'orgUnitId', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'danhHieu', type: 'string' },
    { name: 'truTriPhapDanh', type: 'string' },
    { name: 'phones', type: 'string[]' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt',
}

type TypesenseEnv = Pick<Env, 'TYPESENSE_API_KEY' | 'TYPESENSE_HOST'>

function normalizeHost(host?: string): string {
  const base = host?.trim() || DEFAULT_HOST
  return base.replace(/\/$/, '')
}

type MultiSearchResponse = {
  results?: Array<{
    hits?: Array<{ document?: MemberSearchDoc | TempleSearchDoc }>
  }>
}

export function createTypesenseClient(env: TypesenseEnv) {
  const host = normalizeHost(env.TYPESENSE_HOST)
  const apiKey = env.TYPESENSE_API_KEY

  function headers(contentType = 'application/json'): Record<string, string> {
    const h: Record<string, string> = { 'X-TYPESENSE-API-KEY': apiKey }
    if (contentType) h['Content-Type'] = contentType
    return h
  }

  async function createCollection(
    name: string,
    schema: typeof membersSchema | typeof templesSchema,
  ): Promise<void> {
    const postRes = await fetch(`${host}/collections`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(schema),
    })
    if (!postRes.ok) {
      throw new Error(`Typesense create collection ${name} failed: ${postRes.status}`)
    }
  }

  async function deleteCollectionIfExists(name: string): Promise<void> {
    const collectionUrl = `${host}/collections/${name}`
    const getRes = await fetch(collectionUrl, { headers: headers() })
    if (getRes.status === 404) return
    if (!getRes.ok) {
      throw new Error(`Typesense GET collection ${name} failed: ${getRes.status}`)
    }
    const delRes = await fetch(collectionUrl, {
      method: 'DELETE',
      headers: headers(),
    })
    if (!delRes.ok) {
      throw new Error(`Typesense delete collection ${name} failed: ${delRes.status}`)
    }
  }

  async function ensureCollection(
    name: string,
    schema: typeof membersSchema | typeof templesSchema,
  ): Promise<void> {
    const collectionUrl = `${host}/collections/${name}`
    const getRes = await fetch(collectionUrl, { headers: headers() })
    if (getRes.ok) return
    if (getRes.status !== 404) {
      throw new Error(`Typesense GET collection ${name} failed: ${getRes.status}`)
    }
    await createCollection(name, schema)
  }

  return {
    async ensureCollections(): Promise<void> {
      await ensureCollection(TYPESENSE_MEMBERS_COLLECTION, membersSchema)
      await ensureCollection(TYPESENSE_TEMPLES_COLLECTION, templesSchema)
    },

    async recreateCollections(): Promise<void> {
      await deleteCollectionIfExists(TYPESENSE_MEMBERS_COLLECTION)
      await deleteCollectionIfExists(TYPESENSE_TEMPLES_COLLECTION)
      await createCollection(TYPESENSE_MEMBERS_COLLECTION, membersSchema)
      await createCollection(TYPESENSE_TEMPLES_COLLECTION, templesSchema)
    },

    async multiSearch(input: {
      q: string
      filterBy?: string
      perPage: number
    }): Promise<{ members: MemberSearchDoc[]; temples: TempleSearchDoc[] }> {
      const searchBase = {
        q: input.q,
        per_page: input.perPage,
        prefix: true,
        ...(input.filterBy ? { filter_by: input.filterBy } : {}),
      }

      const body = {
        searches: [
          {
            collection: TYPESENSE_MEMBERS_COLLECTION,
            query_by: MEMBERS_QUERY_BY,
            ...searchBase,
          },
          {
            collection: TYPESENSE_TEMPLES_COLLECTION,
            query_by: TEMPLES_QUERY_BY,
            ...searchBase,
          },
        ],
      }

      const res = await fetch(`${host}/multi_search`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(`Typesense multi_search failed: ${res.status}`)
      }

      const data = (await res.json()) as MultiSearchResponse
      const members: MemberSearchDoc[] = []
      const temples: TempleSearchDoc[] = []

      const memberHits = data.results?.[0]?.hits ?? []
      for (const hit of memberHits) {
        if (hit.document) members.push(hit.document as MemberSearchDoc)
      }

      const templeHits = data.results?.[1]?.hits ?? []
      for (const hit of templeHits) {
        if (hit.document) temples.push(hit.document as TempleSearchDoc)
      }

      return { members, temples }
    },

    async upsert(collection: string, doc: object): Promise<void> {
      const res = await fetch(
        `${host}/collections/${collection}/documents?action=upsert`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(doc),
        },
      )
      if (!res.ok) {
        throw new Error(`Typesense upsert failed: ${res.status}`)
      }
    },

    async deleteDocument(collection: string, id: string): Promise<void> {
      const res = await fetch(`${host}/collections/${collection}/documents/${id}`, {
        method: 'DELETE',
        headers: headers(),
      })
      if (!res.ok) {
        throw new Error(`Typesense delete failed: ${res.status}`)
      }
    },

    async importDocuments(collection: string, docs: object[]): Promise<void> {
      const ndjson = docs.map((doc) => JSON.stringify(doc)).join('\n')
      const res = await fetch(
        `${host}/collections/${collection}/documents/import?action=upsert`,
        {
          method: 'POST',
          headers: headers('text/plain'),
          body: ndjson,
        },
      )
      if (!res.ok) {
        throw new Error(`Typesense import failed: ${res.status}`)
      }

      const text = await res.text()
      const failures: string[] = []
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parsed = JSON.parse(trimmed) as { success?: boolean; error?: string }
        if (parsed.success === false) {
          failures.push(parsed.error ?? trimmed)
        }
      }
      if (failures.length > 0) {
        throw new Error(`Typesense import failed: ${failures.join('; ')}`)
      }
    },
  }
}
