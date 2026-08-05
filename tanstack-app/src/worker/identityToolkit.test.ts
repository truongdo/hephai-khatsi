import { afterEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'demo-project'
const ACCESS_TOKEN = 'ya29.test-token'
const EMAIL = 'secretary@gmail.com'
const LOCAL_ID = 'auth-uid-123'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('lookupAuthUserByEmail', () => {
  it('returns null when user is not found (404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
        )
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        })
        expect(JSON.parse(init?.body as string)).toEqual({ email: [EMAIL] })

        return new Response(JSON.stringify({ error: { message: 'NOT_FOUND' } }), {
          status: 404,
        })
      }),
    )

    const { lookupAuthUserByEmail } = await import('./identityToolkit')
    const result = await lookupAuthUserByEmail(ACCESS_TOKEN, PROJECT_ID, EMAIL)

    expect(result).toBeNull()
  })

  it('returns localId when user exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            users: [{ localId: LOCAL_ID, email: EMAIL }],
          }),
        ),
      ),
    )

    const { lookupAuthUserByEmail } = await import('./identityToolkit')
    const result = await lookupAuthUserByEmail(ACCESS_TOKEN, PROJECT_ID, EMAIL)

    expect(result).toEqual({ localId: LOCAL_ID, customClaims: {} })
  })

  it('parses customAttributes JSON into customClaims', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            users: [
              {
                localId: LOCAL_ID,
                email: EMAIL,
                customAttributes: JSON.stringify({
                  role: 'he_phai_admin',
                }),
              },
            ],
          }),
        ),
      ),
    )

    const { lookupAuthUserByEmail } = await import('./identityToolkit')
    const result = await lookupAuthUserByEmail(ACCESS_TOKEN, PROJECT_ID, EMAIL)

    expect(result).toEqual({
      localId: LOCAL_ID,
      customClaims: { role: 'he_phai_admin' },
    })
  })
})

describe('setAuthCustomClaims', () => {
  it('posts customAttributes as JSON string to accounts:update', async () => {
    const claims = { role: 'giao_doan_admin', orgUnitId: 'gd-i' }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
        )
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        })
        expect(JSON.parse(init?.body as string)).toEqual({
          localId: LOCAL_ID,
          customAttributes: JSON.stringify(claims),
        })

        return new Response(JSON.stringify({}))
      }),
    )

    const { setAuthCustomClaims } = await import('./identityToolkit')
    await setAuthCustomClaims(ACCESS_TOKEN, PROJECT_ID, LOCAL_ID, claims)
  })
})

describe('createAuthUserWithEmail', () => {
  it('creates a user via POST projects/{id}/accounts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        expect(url).toBe(
          `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
        )
        expect(JSON.parse(init?.body as string)).toEqual({
          email: EMAIL,
          emailVerified: true,
        })

        return new Response(
          JSON.stringify({ localId: LOCAL_ID, email: EMAIL }),
        )
      }),
    )

    const { createAuthUserWithEmail } = await import('./identityToolkit')
    const result = await createAuthUserWithEmail(ACCESS_TOKEN, PROJECT_ID, EMAIL)

    expect(result).toEqual({ localId: LOCAL_ID })
  })
})
