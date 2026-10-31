// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleDocsApi } from './docsApi'
import type { Env } from './env'
import type { WorkerMember } from './recordSource'
import { multipartRequest } from './test/multipartRequest'

const { getMember, inviteExists, verifyFirebaseAdminToken } = vi.hoisted(() => ({
  getMember: vi.fn(),
  inviteExists: vi.fn(),
  verifyFirebaseAdminToken: vi.fn(),
}))

vi.mock('./recordSource', () => ({
  recordSource: () => ({ getMember, inviteExists }),
}))

vi.mock('./verifyFirebaseAdmin', () => ({ verifyFirebaseAdminToken }))

const PDF = new TextEncoder().encode('%PDF-1.7\n...')
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>')

const draftMember: WorkerMember = {
  id: 'm1',
  orgUnitId: 'gd-i',
  cccd: '012345678901',
  status: 'draft',
  inviteId: 'invite-1',
  photoPath: null,
}

let put: ReturnType<typeof vi.fn>

async function upload(
  fields: Record<string, string>,
  options: { bytes?: Uint8Array; idToken?: string } = {},
): Promise<Response> {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  form.append('file', new Blob([new Uint8Array(options.bytes ?? PDF)], { type: 'application/pdf' }))
  return handleDocsApi(
    await multipartRequest(
      'https://example.com/api/docs/member',
      form,
      options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {},
    ),
    { PHOTOS: { put } as unknown as R2Bucket, FIREBASE_PROJECT_ID: 'test-project' } as unknown as Env,
  )
}

const cccdFront = { memberId: 'm1', cccd: '012345678901', typeId: 'cccd', side: 'front' }

beforeEach(() => {
  vi.clearAllMocks()
  put = vi.fn(async () => null)
  getMember.mockResolvedValue(draftMember)
  inviteExists.mockResolvedValue(true)
})

describe('POST /api/docs/member', () => {
  it('writes the document with the extension of its content', async () => {
    const response = await upload({ ...cccdFront, inviteToken: 'invite-1' })

    expect(response.status).toBe(200)
    const { filePath } = (await response.json()) as { filePath: string }
    expect(filePath).toMatch(/^members\/m1\/docs\/cccd\/front-[a-f0-9]{12}\.pdf$/)
    expect(put).toHaveBeenCalledWith(filePath, PDF, {
      httpMetadata: { contentType: 'application/pdf' },
    })

    const again = (await (await upload({ ...cccdFront, inviteToken: 'invite-1' }, { bytes: PNG })).json()) as {
      filePath: string
    }
    // Every upload gets its own key, so the file it replaces can be deleted safely.
    expect(again.filePath).toMatch(/^members\/m1\/docs\/cccd\/front-[a-f0-9]{12}\.png$/)
    expect(put).toHaveBeenLastCalledWith(again.filePath, PNG, {
      httpMetadata: { contentType: 'image/png' },
    })
  })

  it('lets a filler upload to a locked member', async () => {
    getMember.mockResolvedValue({ ...draftMember, status: 'locked' })

    expect((await upload({ ...cccdFront, inviteToken: 'invite-1' })).status).toBe(200)
  })

  it('refuses content that is not an image or PDF', async () => {
    const response = await upload({ ...cccdFront, inviteToken: 'invite-1' }, { bytes: HTML })

    expect(response.status).toBe(400)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a file over 10 MB', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1)
    big.set(PDF)

    const response = await upload({ ...cccdFront, inviteToken: 'invite-1' }, { bytes: big })

    expect(response.status).toBe(413)
  })

  it('refuses a side the document type does not have', async () => {
    const response = await upload({ ...cccdFront, side: 'file', inviteToken: 'invite-1' })

    expect(response.status).toBe(400)
  })

  it('writes for staff of the org unit and refuses another giáo đoàn', async () => {
    verifyFirebaseAdminToken.mockResolvedValue({ uid: 'gd', role: 'giao_doan_admin', orgUnitId: 'gd-i' })
    expect((await upload(cccdFront, { idToken: 'staff' })).status).toBe(200)

    verifyFirebaseAdminToken.mockResolvedValue({ uid: 'gd2', role: 'giao_doan_admin', orgUnitId: 'gd-ii' })
    expect((await upload(cccdFront, { idToken: 'staff' })).status).toBe(403)
  })

  it('refuses a filler on an admin-made draft (no invite yet) or without an invite', async () => {
    getMember.mockResolvedValue({ ...draftMember, inviteId: null })
    expect((await upload({ ...cccdFront, inviteToken: 'invite-1' })).status).toBe(403)
    expect((await upload(cccdFront)).status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a CCCD that does not match', async () => {
    const response = await upload({ ...cccdFront, cccd: '999999999999', inviteToken: 'invite-1' })

    expect(response.status).toBe(403)
  })
})
