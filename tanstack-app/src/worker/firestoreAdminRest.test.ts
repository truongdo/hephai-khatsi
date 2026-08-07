import { afterEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-project'
const ACCESS_TOKEN = 'ya29.test-token'
const MEMBER_ID = 'm1'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('getMemberAdminFields', () => {
  it('parses admin fields from member document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/members/${MEMBER_ID}`,
        )
        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        })

        return new Response(
          JSON.stringify({
            name: `projects/${PROJECT_ID}/databases/(default)/documents/members/${MEMBER_ID}`,
            fields: {
              orgUnitId: { stringValue: 'gd-i' },
              email: { stringValue: 'secretary@gmail.com' },
              directoryRole: { stringValue: 'giao_doan_admin' },
              directoryAuthUid: { stringValue: 'auth-uid-123' },
            },
          }),
        )
      }),
    )

    const { getMemberAdminFields } = await import('./firestoreAdminRest')
    const result = await getMemberAdminFields(
      ACCESS_TOKEN,
      PROJECT_ID,
      MEMBER_ID,
    )

    expect(result).toEqual({
      id: MEMBER_ID,
      orgUnitId: 'gd-i',
      email: 'secretary@gmail.com',
      directoryRole: 'giao_doan_admin',
      directoryAuthUid: 'auth-uid-123',
    })
  })
})

describe('patchMemberDirectoryFields', () => {
  it('builds Firestore REST PATCH body with updateMask', async () => {
    const fields = {
      directoryRole: 'giao_doan_admin',
      directoryAuthUid: 'auth-uid-123',
      directoryRoleGrantedAt: '2026-08-05T12:00:00.000Z',
      directoryRoleGrantedBy: 'hp-admin-uid',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toContain(
          `/documents/members/${MEMBER_ID}?`,
        )
        expect(url).toContain('updateMask.fieldPaths=directoryRole')
        expect(url).toContain('updateMask.fieldPaths=directoryAuthUid')
        expect(url).toContain('updateMask.fieldPaths=directoryRoleGrantedAt')
        expect(url).toContain('updateMask.fieldPaths=directoryRoleGrantedBy')
        expect(init?.method).toBe('PATCH')
        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        })
        expect(JSON.parse(init?.body as string)).toEqual({
          fields: {
            directoryRole: { stringValue: 'giao_doan_admin' },
            directoryAuthUid: { stringValue: 'auth-uid-123' },
            directoryRoleGrantedAt: { stringValue: '2026-08-05T12:00:00.000Z' },
            directoryRoleGrantedBy: { stringValue: 'hp-admin-uid' },
          },
        })

        return new Response(JSON.stringify({}))
      }),
    )

    const { patchMemberDirectoryFields } = await import('./firestoreAdminRest')
    await patchMemberDirectoryFields(
      ACCESS_TOKEN,
      PROJECT_ID,
      MEMBER_ID,
      fields,
    )
  })
})

describe('listSecretaries', () => {
  it('parses secretary documents from runQuery response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        )
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        })

        const body = JSON.parse(init?.body as string)
        expect(body.structuredQuery.from).toEqual([{ collectionId: 'members' }])
        expect(body.structuredQuery.where.fieldFilter).toEqual({
          field: { fieldPath: 'directoryRole' },
          op: 'IN',
          value: {
            arrayValue: {
              values: [
                { stringValue: 'giao_doan_admin' },
                { stringValue: 'he_phai_secretary' },
              ],
            },
          },
        })

        return new Response(
          JSON.stringify([
            {
              document: {
                name: `projects/${PROJECT_ID}/databases/(default)/documents/members/m1`,
                fields: {
                  orgUnitId: { stringValue: 'gd-i' },
                  email: { stringValue: 'a@gmail.com' },
                  phapDanh: { stringValue: 'Thich A' },
                  theDanh: { stringValue: 'Nguyen Van A' },
                  directoryRoleGrantedAt: {
                    stringValue: '2026-08-01T00:00:00.000Z',
                  },
                },
              },
            },
            {
              document: {
                name: `projects/${PROJECT_ID}/databases/(default)/documents/members/m2`,
                fields: {
                  orgUnitId: { stringValue: 'gd-ii' },
                  email: { stringValue: 'b@gmail.com' },
                },
              },
            },
          ]),
        )
      }),
    )

    const { listSecretaries } = await import('./firestoreAdminRest')
    const result = await listSecretaries(ACCESS_TOKEN, PROJECT_ID)

    expect(result).toEqual([
      {
        id: 'm1',
        orgUnitId: 'gd-i',
        email: 'a@gmail.com',
        phapDanh: 'Thich A',
        theDanh: 'Nguyen Van A',
        directoryRoleGrantedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'm2',
        orgUnitId: 'gd-ii',
        email: 'b@gmail.com',
      },
    ])
  })
})
