// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'

const verifyHePhaiAdminToken = vi.fn()
const parseServiceAccountJson = vi.fn()
const getGoogleAccessToken = vi.fn()
const getMemberAdminFields = vi.fn()
const listSecretaries = vi.fn()
const patchMemberDirectoryFields = vi.fn()
const lookupAuthUserByEmail = vi.fn()
const createAuthUserWithEmail = vi.fn()
const setAuthCustomClaims = vi.fn()

vi.mock('./verifyFirebaseAdmin', () => ({
  verifyHePhaiAdminToken,
}))

vi.mock('./googleServiceAccount', () => ({
  parseServiceAccountJson,
  getGoogleAccessToken,
}))

vi.mock('./firestoreAdminRest', () => ({
  getMemberAdminFields,
  listSecretaries,
  patchMemberDirectoryFields,
}))

vi.mock('./identityToolkit', () => ({
  lookupAuthUserByEmail,
  createAuthUserWithEmail,
  setAuthCustomClaims,
}))

const PROJECT_ID = 'test-project'
const HP_ADMIN_UID = 'hp-admin-uid'
const MEMBER_ID = 'member-1'
const AUTH_UID = 'auth-uid-123'
const ACCESS_TOKEN = 'ya29.test-token'
const SA_JSON = '{"client_email":"sa@test.iam.gserviceaccount.com","private_key":"key","project_id":"test-project"}'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    PHOTOS: {} as R2Bucket,
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET_NAME: 'photos',
    FIREBASE_PROJECT_ID: PROJECT_ID,
    FIREBASE_SERVICE_ACCOUNT_JSON: SA_JSON,
    ...overrides,
  }
}

function grantRequest(
  memberId = MEMBER_ID,
  role: 'giao_doan_admin' | 'he_phai_secretary' = 'giao_doan_admin',
): Request {
  return new Request('https://example.com/api/admin/directory-role/grant', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer he-phai-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memberId, role }),
  })
}

function revokeRequest(memberId = MEMBER_ID): Request {
  return new Request('https://example.com/api/admin/directory-role/revoke', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer he-phai-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memberId }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyHePhaiAdminToken.mockResolvedValue({ uid: HP_ADMIN_UID })
  parseServiceAccountJson.mockReturnValue({
    clientEmail: 'sa@test.iam.gserviceaccount.com',
    privateKey: 'key',
    projectId: PROJECT_ID,
  })
  getGoogleAccessToken.mockResolvedValue(ACCESS_TOKEN)
  getMemberAdminFields.mockResolvedValue({
    id: MEMBER_ID,
    orgUnitId: 'gd-i',
    email: 'secretary@gmail.com',
    directoryRole: null,
    directoryAuthUid: null,
  })
  listSecretaries.mockResolvedValue([])
  lookupAuthUserByEmail.mockResolvedValue({ localId: AUTH_UID, customClaims: {} })
  patchMemberDirectoryFields.mockResolvedValue(undefined)
  setAuthCustomClaims.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe('handleDirectoryRoleApi', () => {
  describe('POST /api/admin/directory-role/grant', () => {
    it('grants directory role on happy path', async () => {
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
        memberId: MEMBER_ID,
        directoryAuthUid: AUTH_UID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
      })

      expect(verifyHePhaiAdminToken).toHaveBeenCalledWith(
        'he-phai-token',
        PROJECT_ID,
      )
      expect(setAuthCustomClaims).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        AUTH_UID,
        { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
      )
      expect(patchMemberDirectoryFields).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        MEMBER_ID,
        expect.objectContaining({
          directoryRole: 'giao_doan_admin',
          directoryAuthUid: AUTH_UID,
          directoryRoleGrantedBy: HP_ADMIN_UID,
        }),
      )
      const patchFields = patchMemberDirectoryFields.mock.calls[0][3]
      expect(patchFields.directoryRoleGrantedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T/,
      )
    })

    it('creates auth user when lookup returns null', async () => {
      lookupAuthUserByEmail.mockResolvedValue(null)
      createAuthUserWithEmail.mockResolvedValue({ localId: 'new-auth-uid' })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(createAuthUserWithEmail).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        'secretary@gmail.com',
      )
      expect(body.directoryAuthUid).toBe('new-auth-uid')
    })

    it('returns 403 when caller is not he_phai admin', async () => {
      verifyHePhaiAdminToken.mockResolvedValue(null)
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())

      expect(response.status).toBe(403)
      expect(getMemberAdminFields).not.toHaveBeenCalled()
    })

    it('returns 400 EMAIL_NOT_GMAIL for non-gmail email', async () => {
      getMemberAdminFields.mockResolvedValue({
        id: MEMBER_ID,
        orgUnitId: 'gd-i',
        email: 'user@hephai.org',
        directoryRole: null,
        directoryAuthUid: null,
      })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ code: 'EMAIL_NOT_GMAIL' })
    })

    it('returns 400 ALREADY_SECRETARY when member already has role', async () => {
      getMemberAdminFields.mockResolvedValue({
        id: MEMBER_ID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
        directoryRole: 'giao_doan_admin',
        directoryAuthUid: AUTH_UID,
      })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ code: 'ALREADY_SECRETARY' })
    })

    it('returns 400 AUTH_USER_PRIVILEGED when auth user is he_phai_admin', async () => {
      lookupAuthUserByEmail.mockResolvedValue({
        localId: AUTH_UID,
        customClaims: { role: 'he_phai_admin' },
      })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ code: 'AUTH_USER_PRIVILEGED' })
      expect(setAuthCustomClaims).not.toHaveBeenCalled()
    })

    it('returns 400 EMAIL_IN_USE when another secretary has same email', async () => {
      listSecretaries.mockResolvedValue([
        {
          id: 'other-member',
          orgUnitId: 'gd-ii',
          email: 'Secretary@Gmail.COM',
        },
      ])
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ code: 'EMAIL_IN_USE' })
    })

    it('allows same member email when they are the only secretary match', async () => {
      listSecretaries.mockResolvedValue([
        {
          id: MEMBER_ID,
          orgUnitId: 'gd-i',
          email: 'secretary@gmail.com',
        },
      ])
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())

      expect(response.status).toBe(200)
    })

    it('compensates claims and returns 500 when patch fails', async () => {
      patchMemberDirectoryFields.mockRejectedValue(new Error('patch failed'))
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())

      expect(response.status).toBe(500)
      expect(setAuthCustomClaims).toHaveBeenCalledTimes(2)
      expect(setAuthCustomClaims).toHaveBeenNthCalledWith(
        2,
        ACCESS_TOKEN,
        PROJECT_ID,
        AUTH_UID,
        {},
      )
    })

    it('returns 502 when Identity Toolkit lookup fails', async () => {
      lookupAuthUserByEmail.mockRejectedValue(
        new Error('Identity Toolkit lookup failed: 503'),
      )
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(502)
      expect(body).toEqual({ error: 'Identity provider request failed' })
    })

    it('returns 404 when member not found', async () => {
      getMemberAdminFields.mockResolvedValue(null)
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(grantRequest(), makeEnv())

      expect(response.status).toBe(404)
    })

    it('returns 400 when body is invalid', async () => {
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(
        new Request('https://example.com/api/admin/directory-role/grant', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer he-phai-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(400)
    })

    it('grants he_phai_secretary claims and patches member', async () => {
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(
        grantRequest(MEMBER_ID, 'he_phai_secretary'),
        makeEnv(),
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
        memberId: MEMBER_ID,
        directoryAuthUid: AUTH_UID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
      })
      expect(setAuthCustomClaims).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        AUTH_UID,
        { role: 'he_phai_secretary' },
      )
      expect(patchMemberDirectoryFields).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        MEMBER_ID,
        expect.objectContaining({
          directoryRole: 'he_phai_secretary',
          directoryAuthUid: AUTH_UID,
        }),
      )
    })

    it('returns 400 ROLE_REQUIRED when role missing', async () => {
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(
        new Request('https://example.com/api/admin/directory-role/grant', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer he-phai-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId: MEMBER_ID }),
        }),
        makeEnv(),
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ code: 'ROLE_REQUIRED' })
    })

    it('returns 400 ALREADY_SECRETARY when member has he_phai_secretary', async () => {
      getMemberAdminFields.mockResolvedValue({
        id: MEMBER_ID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
        directoryRole: 'he_phai_secretary',
        directoryAuthUid: AUTH_UID,
      })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(
        grantRequest(MEMBER_ID, 'he_phai_secretary'),
        makeEnv(),
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ code: 'ALREADY_SECRETARY' })
    })

    it('returns 403 when caller is he_phai_secretary', async () => {
      verifyHePhaiAdminToken.mockResolvedValue(null)
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(
        grantRequest(MEMBER_ID, 'he_phai_secretary'),
        makeEnv(),
      )

      expect(response.status).toBe(403)
      expect(getMemberAdminFields).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/admin/directory-role/revoke', () => {
    it('revokes directory role and clears claims', async () => {
      getMemberAdminFields.mockResolvedValue({
        id: MEMBER_ID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
        directoryRole: 'giao_doan_admin',
        directoryAuthUid: AUTH_UID,
      })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(revokeRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({ memberId: MEMBER_ID })
      expect(setAuthCustomClaims).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        AUTH_UID,
        {},
      )
      expect(patchMemberDirectoryFields).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        PROJECT_ID,
        MEMBER_ID,
        {
          directoryRole: null,
          directoryAuthUid: null,
          directoryRoleGrantedAt: null,
          directoryRoleGrantedBy: null,
        },
      )
    })

    it('returns 200 idempotently when member has no directory role', async () => {
      getMemberAdminFields.mockResolvedValue({
        id: MEMBER_ID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
        directoryRole: null,
        directoryAuthUid: null,
      })
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(revokeRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({ memberId: MEMBER_ID })
      expect(setAuthCustomClaims).not.toHaveBeenCalled()
      expect(patchMemberDirectoryFields).not.toHaveBeenCalled()
    })

    it('returns 502 when clearing claims fails on revoke', async () => {
      getMemberAdminFields.mockResolvedValue({
        id: MEMBER_ID,
        orgUnitId: 'gd-i',
        email: 'secretary@gmail.com',
        directoryRole: 'giao_doan_admin',
        directoryAuthUid: AUTH_UID,
      })
      setAuthCustomClaims.mockRejectedValue(
        new Error('Identity Toolkit update failed: 500'),
      )
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(revokeRequest(), makeEnv())
      const body = await response.json()

      expect(response.status).toBe(502)
      expect(body).toEqual({ error: 'Identity provider request failed' })
      expect(patchMemberDirectoryFields).not.toHaveBeenCalled()
    })

    it('returns 403 when caller is not he_phai admin', async () => {
      verifyHePhaiAdminToken.mockResolvedValue(null)
      const { handleDirectoryRoleApi } = await import('./directoryRoleApi')

      const response = await handleDirectoryRoleApi(revokeRequest(), makeEnv())

      expect(response.status).toBe(403)
    })
  })
})
