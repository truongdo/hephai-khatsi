import { afterEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-project'

function memberFirestoreResponse(fields: Record<string, string>) {
  return {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/members/m1`,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, { stringValue: v }]),
    ),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('getMemberDocument', () => {
  it('parses member fields from Firestore REST response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/members/m1`,
        )
        return new Response(
          JSON.stringify(
            memberFirestoreResponse({
              orgUnitId: 'gd-i',
              cccd: '012345678901',
              status: 'draft',
            }),
          ),
        )
      }),
    )

    const { getMemberDocument } = await import('./firestoreRest')
    const result = await getMemberDocument(PROJECT_ID, 'm1')

    expect(result).toEqual({
      id: 'm1',
      orgUnitId: 'gd-i',
      cccd: '012345678901',
      status: 'draft',
    })
  })

  it('returns null when document not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { code: 404, status: 'NOT_FOUND' } }),
          { status: 404 },
        ),
      ),
    )

    const { getMemberDocument } = await import('./firestoreRest')
    const result = await getMemberDocument(PROJECT_ID, 'missing')

    expect(result).toBeNull()
  })
})

describe('getInviteOrgUnitId', () => {
  it('returns orgUnitId from invite document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/invites/inv1`,
        )
        return new Response(
          JSON.stringify({
            name: `projects/${PROJECT_ID}/databases/(default)/documents/invites/inv1`,
            fields: { orgUnitId: { stringValue: 'gd-ii' } },
          }),
        )
      }),
    )

    const { getInviteOrgUnitId } = await import('./firestoreRest')
    const result = await getInviteOrgUnitId(PROJECT_ID, 'inv1')

    expect(result).toBe('gd-ii')
  })

  it('returns null when invite not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { code: 404, status: 'NOT_FOUND' } }),
          { status: 404 },
        ),
      ),
    )

    const { getInviteOrgUnitId } = await import('./firestoreRest')
    const result = await getInviteOrgUnitId(PROJECT_ID, 'missing')

    expect(result).toBeNull()
  })
})
