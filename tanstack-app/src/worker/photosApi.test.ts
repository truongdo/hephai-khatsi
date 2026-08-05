// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import type { WorkerMember, WorkerTemple } from './firestoreRest'

const getMemberDocument = vi.fn()
const getTempleDocument = vi.fn()
const inviteExists = vi.fn()
const verifyFirebaseAdminToken = vi.fn()
const createR2PresignedPutUrl = vi.fn()

vi.mock('./firestoreRest', () => ({
  getMemberDocument,
  getTempleDocument,
  inviteExists,
}))

vi.mock('./verifyFirebaseAdmin', () => ({
  verifyFirebaseAdminToken,
}))

vi.mock('./presignR2Put', () => ({
  createR2PresignedPutUrl,
  memberPhotoKey: (memberId: string) => `members/${memberId}/photo.jpg`,
  templePhotoKey: (templeId: string) => `temples/${templeId}/photo.jpg`,
}))

const PROJECT_ID = 'test-project'
const MEMBER_ID = 'm1'
const TEMPLE_ID = 't1'

const draftMember: WorkerMember = {
  id: MEMBER_ID,
  orgUnitId: 'gd-i',
  cccd: '012345678901',
  status: 'draft',
  photoPath: null,
}

const draftTemple: WorkerTemple = {
  id: TEMPLE_ID,
  orgUnitId: 'gd-i',
  status: 'draft',
  photoPath: null,
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    PHOTOS: { delete: vi.fn(async () => undefined) } as unknown as R2Bucket,
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET_NAME: 'photos',
    FIREBASE_PROJECT_ID: PROJECT_ID,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  createR2PresignedPutUrl.mockResolvedValue(
    'https://acct.r2.cloudflarestorage.com/photos/members/m1/photo.jpg?signed=1',
  )
})

afterEach(() => {
  vi.resetModules()
})

describe('handlePhotosApi', () => {
  describe('POST /api/photos/member-upload-url', () => {
    it('returns 401 when no auth is provided', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/jpeg',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(401)
    })

    it('returns 400 when contentType is not an image type', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'application/pdf',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(400)
    })

    it('returns 404 when member is missing', async () => {
      getMemberDocument.mockResolvedValue(null)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/jpeg',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(404)
    })

    it('returns 403 when normalized CCCD does not match', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '999999999999',
            contentType: 'image/jpeg',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })

    it('returns uploadUrl for admin bearer auth on locked member', async () => {
      getMemberDocument.mockResolvedValue({ ...draftMember, status: 'locked' })
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const env = makeEnv()
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/jpeg',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        uploadUrl:
          'https://acct.r2.cloudflarestorage.com/photos/members/m1/photo.jpg?signed=1',
        photoPath: 'members/m1/photo.jpg',
      })
    })

    it('returns uploadUrl for filler invite on locked member without photo', async () => {
      getMemberDocument.mockResolvedValue({
        ...draftMember,
        status: 'locked',
        photoPath: null,
      })
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/jpeg',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(200)
    })

    it('returns 403 for filler invite on locked member that already has a photo', async () => {
      getMemberDocument.mockResolvedValue({
        ...draftMember,
        status: 'locked',
        photoPath: 'members/m1/photo.jpg',
      })
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/jpeg',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })

    it('returns uploadUrl and photoPath for admin bearer auth', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const env = makeEnv()
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '0123 456 78901',
            contentType: 'image/jpeg',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        uploadUrl:
          'https://acct.r2.cloudflarestorage.com/photos/members/m1/photo.jpg?signed=1',
        photoPath: 'members/m1/photo.jpg',
      })
      expect(createR2PresignedPutUrl).toHaveBeenCalledWith({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET_NAME,
        key: 'members/m1/photo.jpg',
        contentType: 'image/jpeg',
        expiresSeconds: 300,
      })
    })

    it('returns uploadUrl for invite token auth when invite exists', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/png',
            inviteToken: 'public',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        photoPath: 'members/m1/photo.jpg',
      })
      expect(verifyFirebaseAdminToken).not.toHaveBeenCalled()
      expect(inviteExists).toHaveBeenCalledWith(PROJECT_ID, 'public')
    })

    it('returns 403 when invite does not exist', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      inviteExists.mockResolvedValue(false)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            contentType: 'image/jpeg',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/photos/member', () => {
    it('returns 401 without admin bearer token', async () => {
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: MEMBER_ID }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(401)
    })

    it('deletes the member photo and returns ok for admin', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const deleteFn = vi.fn(async () => undefined)
      const env = makeEnv({
        PHOTOS: { delete: deleteFn } as unknown as R2Bucket,
      })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({ memberId: MEMBER_ID }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ ok: true })
      expect(deleteFn).toHaveBeenCalledWith('members/m1/photo.jpg')
    })

    it('deletes for invite token when invite exists and cccd matches', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      inviteExists.mockResolvedValue(true)
      const deleteFn = vi.fn(async () => undefined)
      const env = makeEnv({
        PHOTOS: { delete: deleteFn } as unknown as R2Bucket,
      })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            inviteToken: 'invite-token',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      expect(deleteFn).toHaveBeenCalledWith('members/m1/photo.jpg')
    })

    it('returns 403 for invite on locked member', async () => {
      getMemberDocument.mockResolvedValue({ ...draftMember, status: 'locked' })
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            inviteToken: 'invite-token',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })

    it('returns 403 when invite cccd mismatches', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/member', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '999999999999',
            inviteToken: 'invite-token',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/photos/temple-upload-url', () => {
    it('returns 401 when no auth is provided', async () => {
      getTempleDocument.mockResolvedValue(draftTemple)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'image/jpeg',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(401)
    })

    it('returns 400 when contentType is not an image type', async () => {
      getTempleDocument.mockResolvedValue(draftTemple)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'application/pdf',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(400)
    })

    it('returns uploadUrl for admin bearer auth on locked temple', async () => {
      getTempleDocument.mockResolvedValue({ ...draftTemple, status: 'locked' })
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      createR2PresignedPutUrl.mockResolvedValue(
        'https://acct.r2.cloudflarestorage.com/photos/temples/t1/photo.jpg?signed=1',
      )
      const env = makeEnv()
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'image/jpeg',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        uploadUrl:
          'https://acct.r2.cloudflarestorage.com/photos/temples/t1/photo.jpg?signed=1',
        photoPath: 'temples/t1/photo.jpg',
      })
    })

    it('returns uploadUrl for filler invite on locked temple without photo', async () => {
      getTempleDocument.mockResolvedValue({
        ...draftTemple,
        status: 'locked',
        photoPath: null,
      })
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'image/jpeg',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(200)
    })

    it('returns 403 for filler invite on locked temple that already has a photo', async () => {
      getTempleDocument.mockResolvedValue({
        ...draftTemple,
        status: 'locked',
        photoPath: 'temples/t1/photo.jpg',
      })
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'image/jpeg',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })

    it('returns uploadUrl for filler invite on draft when inviteExists is true', async () => {
      getTempleDocument.mockResolvedValue(draftTemple)
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'image/png',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        photoPath: 'temples/t1/photo.jpg',
      })
      expect(verifyFirebaseAdminToken).not.toHaveBeenCalled()
    })

    it('returns 403 when invite does not exist', async () => {
      getTempleDocument.mockResolvedValue(draftTemple)
      inviteExists.mockResolvedValue(false)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            contentType: 'image/jpeg',
            inviteToken: 'bad-invite',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/photos/temple', () => {
    it('returns 401 without admin bearer token', async () => {
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templeId: TEMPLE_ID }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(401)
    })

    it('deletes the temple photo and returns ok for admin', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const deleteFn = vi.fn(async () => undefined)
      const env = makeEnv({
        PHOTOS: { delete: deleteFn } as unknown as R2Bucket,
      })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({ templeId: TEMPLE_ID }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ ok: true })
      expect(deleteFn).toHaveBeenCalledWith('temples/t1/photo.jpg')
    })

    it('deletes for invite when inviteExists is true', async () => {
      getTempleDocument.mockResolvedValue(draftTemple)
      inviteExists.mockResolvedValue(true)
      const deleteFn = vi.fn(async () => undefined)
      const env = makeEnv({
        PHOTOS: { delete: deleteFn } as unknown as R2Bucket,
      })
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            inviteToken: 'invite-1',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      expect(deleteFn).toHaveBeenCalledWith('temples/t1/photo.jpg')
    })

    it('returns 403 for invite on locked temple', async () => {
      getTempleDocument.mockResolvedValue({ ...draftTemple, status: 'locked' })
      inviteExists.mockResolvedValue(true)
      const { handlePhotosApi } = await import('./photosApi')

      const response = await handlePhotosApi(
        new Request('https://example.com/api/photos/temple', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templeId: TEMPLE_ID,
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })
  })
})
