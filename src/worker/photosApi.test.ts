// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import { handlePhotosApi } from './photosApi'
import type { WorkerMember, WorkerTemple } from './recordSource'

const { getMember, getTemple, inviteExists, verifyFirebaseAdminToken } = vi.hoisted(() => ({
  getMember: vi.fn(),
  getTemple: vi.fn(),
  inviteExists: vi.fn(),
  verifyFirebaseAdminToken: vi.fn(),
}))

vi.mock('./recordSource', () => ({
  recordSource: () => ({ getMember, getTemple, inviteExists }),
}))

vi.mock('./verifyFirebaseAdmin', () => ({ verifyFirebaseAdminToken }))

const MEMBER_ID = 'm1'
const TEMPLE_ID = 't1'
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')

const draftMember: WorkerMember = {
  id: MEMBER_ID,
  orgUnitId: 'gd-i',
  cccd: '012345678901',
  status: 'draft',
  inviteId: 'invite-1',
  photoPath: null,
}

const draftTemple: WorkerTemple = {
  id: TEMPLE_ID,
  orgUnitId: 'gd-i',
  status: 'draft',
  inviteId: 'invite-1',
  photoPath: null,
}

const hePhaiAdmin = { uid: 'admin-1', role: 'he_phai_admin', orgUnitId: null }
const ownGiaoDoanAdmin = { uid: 'gd-admin', role: 'giao_doan_admin', orgUnitId: 'gd-i' }
const otherGiaoDoanAdmin = { uid: 'gd-admin-2', role: 'giao_doan_admin', orgUnitId: 'gd-ii' }

let put: ReturnType<typeof vi.fn>

function makeEnv(): Env {
  return {
    PHOTOS: { put } as unknown as R2Bucket,
    FIREBASE_PROJECT_ID: 'test-project',
  } as unknown as Env
}

function upload(
  path: string,
  fields: Record<string, string>,
  options: { bytes?: Uint8Array; idToken?: string } = {},
): Promise<Response> {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  form.append('file', new Blob([new Uint8Array(options.bytes ?? JPEG)], { type: 'image/jpeg' }))
  return handlePhotosApi(
    new Request(`https://example.com${path}`, {
      method: 'POST',
      headers: options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {},
      body: form,
    }),
    makeEnv(),
  )
}

const memberFields = { memberId: MEMBER_ID, cccd: '012345678901' }

beforeEach(() => {
  vi.clearAllMocks()
  put = vi.fn(async () => null)
  getMember.mockResolvedValue(draftMember)
  getTemple.mockResolvedValue(draftTemple)
  inviteExists.mockResolvedValue(true)
})

describe('POST /api/photos/member', () => {
  it('writes the photo for a filler with an invite, typed by its content', async () => {
    const response = await upload('/api/photos/member', { ...memberFields, inviteToken: 'invite-1' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ photoPath: 'members/m1/photo.jpg' })
    expect(put).toHaveBeenCalledWith('members/m1/photo.jpg', JPEG, {
      httpMetadata: { contentType: 'image/jpeg' },
    })
  })

  it.each([hePhaiAdmin, ownGiaoDoanAdmin])('writes the photo for $role of the org unit', async (staff) => {
    verifyFirebaseAdminToken.mockResolvedValue(staff)
    getMember.mockResolvedValue({ ...draftMember, status: 'locked', photoPath: 'members/m1/photo.jpg' })

    const response = await upload('/api/photos/member', memberFields, { idToken: 'staff-token' })

    expect(response.status).toBe(200)
    expect(put).toHaveBeenCalled()
  })

  it('refuses staff of another giáo đoàn', async () => {
    verifyFirebaseAdminToken.mockResolvedValue(otherGiaoDoanAdmin)

    const response = await upload('/api/photos/member', memberFields, { idToken: 'gd-token' })

    expect(response.status).toBe(403)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses an invalid staff token', async () => {
    verifyFirebaseAdminToken.mockResolvedValue(null)

    const response = await upload('/api/photos/member', memberFields, { idToken: 'bad' })

    expect(response.status).toBe(401)
  })

  it('refuses a request without staff token or invite', async () => {
    const response = await upload('/api/photos/member', memberFields)

    expect(response.status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a file that is not JPEG or PNG, whatever it claims to be', async () => {
    const response = await upload(
      '/api/photos/member',
      { ...memberFields, inviteToken: 'invite-1' },
      { bytes: SVG },
    )

    expect(response.status).toBe(400)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a file over 10 MB', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    big.set(JPEG)

    const response = await upload(
      '/api/photos/member',
      { ...memberFields, inviteToken: 'invite-1' },
      { bytes: big },
    )

    expect(response.status).toBe(413)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a CCCD that does not match the member', async () => {
    const response = await upload('/api/photos/member', {
      memberId: MEMBER_ID,
      cccd: '999999999999',
      inviteToken: 'invite-1',
    })

    expect(response.status).toBe(403)
  })

  it('answers 404 for an unknown member', async () => {
    getMember.mockResolvedValue(null)

    const response = await upload('/api/photos/member', { ...memberFields, inviteToken: 'invite-1' })

    expect(response.status).toBe(404)
  })

  it('lets a filler attach the first photo of a locked member, never replace it', async () => {
    getMember.mockResolvedValue({ ...draftMember, status: 'locked' })
    expect((await upload('/api/photos/member', { ...memberFields, inviteToken: 'invite-1' })).status).toBe(200)

    getMember.mockResolvedValue({ ...draftMember, status: 'locked', photoPath: 'members/m1/photo.jpg' })
    expect((await upload('/api/photos/member', { ...memberFields, inviteToken: 'invite-1' })).status).toBe(403)
  })

  it('refuses a filler on an admin-made draft (no invite until save-and-lock)', async () => {
    getMember.mockResolvedValue({ ...draftMember, inviteId: null })

    const response = await upload('/api/photos/member', { ...memberFields, inviteToken: 'invite-1' })

    expect(response.status).toBe(403)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a filler when the invite does not exist', async () => {
    inviteExists.mockResolvedValue(false)

    const response = await upload('/api/photos/member', { ...memberFields, inviteToken: 'gone' })

    expect(response.status).toBe(403)
  })
})

describe('POST /api/photos/temple', () => {
  it('writes the photo for a filler with an invite', async () => {
    const response = await upload('/api/photos/temple', { templeId: TEMPLE_ID, inviteToken: 'invite-1' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ photoPath: 'temples/t1/photo.jpg' })
    expect(put).toHaveBeenCalledWith('temples/t1/photo.jpg', JPEG, {
      httpMetadata: { contentType: 'image/jpeg' },
    })
  })

  it('refuses staff of another giáo đoàn', async () => {
    verifyFirebaseAdminToken.mockResolvedValue(otherGiaoDoanAdmin)

    const response = await upload('/api/photos/temple', { templeId: TEMPLE_ID }, { idToken: 'gd-token' })

    expect(response.status).toBe(403)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a filler replacing the photo of a locked temple', async () => {
    getTemple.mockResolvedValue({ ...draftTemple, status: 'locked', photoPath: 'temples/t1/photo.jpg' })

    const response = await upload('/api/photos/temple', { templeId: TEMPLE_ID, inviteToken: 'invite-1' })

    expect(response.status).toBe(403)
  })
})

it('answers 404 for the removed presign and delete routes', async () => {
  const response = await handlePhotosApi(
    new Request('https://example.com/api/photos/member', { method: 'DELETE' }),
    makeEnv(),
  )
  expect(response.status).toBe(404)
})
