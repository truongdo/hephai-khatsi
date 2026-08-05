// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import type { WorkerMember } from './firestoreRest'

const getMemberDocument = vi.fn()
const inviteExists = vi.fn()
const verifyFirebaseAdminToken = vi.fn()
const createR2PresignedPutUrl = vi.fn()

vi.mock('./firestoreRest', () => ({
  getMemberDocument,
  inviteExists,
}))

vi.mock('./verifyFirebaseAdmin', () => ({
  verifyFirebaseAdminToken,
}))

vi.mock('./presignR2Put', () => ({
  createR2PresignedPutUrl,
  memberDocumentKey: (
    memberId: string,
    typeId: string,
    side: string,
    ext: string,
  ) => `members/${memberId}/docs/${typeId}/${side}.${ext}`,
}))

const PROJECT_ID = 'test-project'
const MEMBER_ID = 'm1'

const draftMember: WorkerMember = {
  id: MEMBER_ID,
  orgUnitId: 'gd-i',
  cccd: '012345678901',
  status: 'draft',
  photoPath: null,
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    PHOTOS: {
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => ({ objects: [], truncated: false })),
    } as unknown as R2Bucket,
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
    'https://acct.r2.cloudflarestorage.com/photos/members/m1/docs/cccd/front.jpg?signed=1',
  )
})

afterEach(() => {
  vi.resetModules()
})

describe('handleDocsApi', () => {
  describe('POST /api/docs/member-upload-url', () => {
    it('returns uploadUrl for admin bearer auth', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const env = makeEnv()
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            typeId: 'cccd',
            side: 'front',
            contentType: 'image/jpeg',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        uploadUrl:
          'https://acct.r2.cloudflarestorage.com/photos/members/m1/docs/cccd/front.jpg?signed=1',
        filePath: 'members/m1/docs/cccd/front.jpg',
      })
      expect(createR2PresignedPutUrl).toHaveBeenCalledWith({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET_NAME,
        key: 'members/m1/docs/cccd/front.jpg',
        contentType: 'image/jpeg',
        expiresSeconds: 300,
      })
    })

    it('returns 400 when side is invalid for type', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            typeId: 'diep_sa_di',
            side: 'front',
            contentType: 'image/jpeg',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(400)
    })

    it('returns uploadUrl for filler invite when invite exists (global invite, no orgUnitId)', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      inviteExists.mockResolvedValue(true)
      const env = makeEnv()
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            typeId: 'cccd',
            side: 'front',
            contentType: 'image/jpeg',
            inviteToken: 'public',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      expect(inviteExists).toHaveBeenCalledWith(PROJECT_ID, 'public')
      await expect(response.json()).resolves.toEqual({
        uploadUrl:
          'https://acct.r2.cloudflarestorage.com/photos/members/m1/docs/cccd/front.jpg?signed=1',
        filePath: 'members/m1/docs/cccd/front.jpg',
      })
    })

    it('returns uploadUrl for invite on locked member', async () => {
      getMemberDocument.mockResolvedValue({ ...draftMember, status: 'locked' })
      inviteExists.mockResolvedValue(true)
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            typeId: 'cccd',
            side: 'front',
            contentType: 'image/jpeg',
            inviteToken: 'invite-1',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(200)
    })

    it('accepts image/jpg content type', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const env = makeEnv()
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            cccd: '012345678901',
            typeId: 'cccd',
            side: 'front',
            contentType: 'image/jpg',
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      expect(createR2PresignedPutUrl).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/jpg' }),
      )
    })
  })

  describe('DELETE /api/docs/member', () => {
    it('deletes listed paths and returns ok for admin', async () => {
      getMemberDocument.mockResolvedValue(draftMember)
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const deleteFn = vi.fn(async () => undefined)
      const env = makeEnv({
        PHOTOS: {
          delete: deleteFn,
          list: vi.fn(async () => ({ objects: [], truncated: false })),
        } as unknown as R2Bucket,
      })
      const { handleDocsApi } = await import('./docsApi')

      const paths = [
        'members/m1/docs/cccd/front.jpg',
        'members/m1/docs/cccd/back.jpg',
      ]

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer admin-token',
          },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            typeId: 'cccd',
            paths,
          }),
        }),
        env,
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ ok: true })
      expect(deleteFn).toHaveBeenCalledTimes(2)
      expect(deleteFn).toHaveBeenCalledWith('members/m1/docs/cccd/front.jpg')
      expect(deleteFn).toHaveBeenCalledWith('members/m1/docs/cccd/back.jpg')
    })

    it('returns 403 for invite on locked member', async () => {
      getMemberDocument.mockResolvedValue({ ...draftMember, status: 'locked' })
      inviteExists.mockResolvedValue(true)
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: MEMBER_ID,
            typeId: 'cccd',
            paths: ['members/m1/docs/cccd/front.jpg'],
            cccd: '012345678901',
            inviteToken: 'invite-token',
          }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/docs/member-prefix', () => {
    it('returns 401 without admin bearer token', async () => {
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-prefix', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: MEMBER_ID }),
        }),
        makeEnv(),
      )

      expect(response.status).toBe(401)
    })

    it('lists prefix and deletes all objects for admin', async () => {
      verifyFirebaseAdminToken.mockResolvedValue({ uid: 'admin-1' })
      const deleteFn = vi.fn(async () => undefined)
      const listFn = vi.fn(async () => ({
        objects: [
          { key: 'members/m1/docs/cccd/front.jpg' },
          { key: 'members/m1/docs/cccd/back.jpg' },
        ],
        truncated: false,
      }))
      const env = makeEnv({
        PHOTOS: {
          delete: deleteFn,
          list: listFn,
        } as unknown as R2Bucket,
      })
      const { handleDocsApi } = await import('./docsApi')

      const response = await handleDocsApi(
        new Request('https://example.com/api/docs/member-prefix', {
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
      expect(listFn).toHaveBeenCalledWith({ prefix: 'members/m1/docs/' })
      expect(deleteFn).toHaveBeenCalledTimes(2)
      expect(deleteFn).toHaveBeenCalledWith('members/m1/docs/cccd/front.jpg')
      expect(deleteFn).toHaveBeenCalledWith('members/m1/docs/cccd/back.jpg')
    })
  })
})
