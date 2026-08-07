// @vitest-environment node
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'test-project'
const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const UID = 'admin-user-123'

let privateKey: CryptoKey
let publicJwk: JsonWebKey & { kid: string; alg: string; use: string }

beforeAll(async () => {
  const { publicKey, privateKey: pk } = await generateKeyPair('RS256')
  privateKey = pk
  const jwk = await exportJWK(publicKey)
  publicJwk = { ...jwk, kid: 'test-key-id', alg: 'RS256', use: 'sig' }
})

async function signToken(claims: Record<string, unknown>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuer(`https://securetoken.google.com/${PROJECT_ID}`)
    .setAudience(PROJECT_ID)
    .setSubject(UID)
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(privateKey)
}

function mockJwksFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === JWKS_URL) {
        return new Response(JSON.stringify({ keys: [publicJwk] }))
      }
      return new Response('Not found', { status: 404 })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('verifyFirebaseAdminToken', () => {
  it('returns uid and he_phai_admin role when admin claim is true', async () => {
    mockJwksFetch()
    const token = await signToken({ admin: true })
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toEqual({ uid: UID, role: 'he_phai_admin' })
  })

  it('returns uid and he_phai_admin role when role is he_phai_admin without legacy admin claim', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'he_phai_admin' })
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toEqual({ uid: UID, role: 'he_phai_admin' })
  })

  it('returns uid and giao_doan_admin role when role is giao_doan_admin', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toEqual({ uid: UID, role: 'giao_doan_admin' })
  })

  it('returns uid and he_phai_secretary role when role is he_phai_secretary', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'he_phai_secretary' })
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toEqual({ uid: UID, role: 'he_phai_secretary' })
  })

  it('returns null when role is kiem_soat', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'kiem_soat' })
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toBeNull()
  })

  it('returns null when admin claim is false', async () => {
    mockJwksFetch()
    const token = await signToken({ admin: false })
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toBeNull()
  })

  it('returns null when admin claim is missing', async () => {
    mockJwksFetch()
    const token = await signToken({})
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken(token, PROJECT_ID)
    expect(result).toBeNull()
  })

  it('returns null for invalid token', async () => {
    mockJwksFetch()
    const { verifyFirebaseAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyFirebaseAdminToken('not-a-jwt', PROJECT_ID)
    expect(result).toBeNull()
  })
})

describe('verifyHePhaiAdminToken', () => {
  it('returns uid when role is he_phai_admin', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'he_phai_admin' })
    const { verifyHePhaiAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyHePhaiAdminToken(token, PROJECT_ID)
    expect(result).toEqual({ uid: UID })
  })

  it('returns uid when legacy admin claim is true', async () => {
    mockJwksFetch()
    const token = await signToken({ admin: true })
    const { verifyHePhaiAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyHePhaiAdminToken(token, PROJECT_ID)
    expect(result).toEqual({ uid: UID })
  })

  it('returns null when role is giao_doan_admin', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'giao_doan_admin', orgUnitId: 'gd-i' })
    const { verifyHePhaiAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyHePhaiAdminToken(token, PROJECT_ID)
    expect(result).toBeNull()
  })

  it('returns null when role is he_phai_secretary', async () => {
    mockJwksFetch()
    const token = await signToken({ role: 'he_phai_secretary' })
    const { verifyHePhaiAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyHePhaiAdminToken(token, PROJECT_ID)
    expect(result).toBeNull()
  })

  it('returns null for invalid token', async () => {
    mockJwksFetch()
    const { verifyHePhaiAdminToken } = await import('./verifyFirebaseAdmin')
    const result = await verifyHePhaiAdminToken('not-a-jwt', PROJECT_ID)
    expect(result).toBeNull()
  })
})
