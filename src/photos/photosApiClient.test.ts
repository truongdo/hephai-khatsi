import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadMemberDocumentFile } from './docsApiClient'
import { uploadMemberPhotoFile, uploadTemplePhotoFile } from './photosApiClient'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const bytes = new Uint8Array([0xff, 0xd8, 0xff])

function sentForm(): { headers: Record<string, string>; form: FormData } {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { headers: init.headers as Record<string, string>, form: init.body as FormData }
}

describe('uploadMemberPhotoFile', () => {
  it('POSTs the member fields, invite token and file as multipart', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ photoPath: 'members/m1/photo.jpg' }))

    const result = await uploadMemberPhotoFile({
      memberId: 'm1',
      cccd: '012345678901',
      bytes,
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
    })

    expect(result).toEqual({ photoPath: 'members/m1/photo.jpg' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/photos/member')
    const { headers, form } = sentForm()
    expect(headers).toEqual({})
    expect(form.get('memberId')).toBe('m1')
    expect(form.get('cccd')).toBe('012345678901')
    expect(form.get('inviteToken')).toBe('invite-token')
    const file = form.get('file') as Blob
    expect(file.type).toBe('image/jpeg')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
  })

  it('sends the admin ID token as Bearer', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ photoPath: 'members/m1/photo.jpg' }))

    await uploadMemberPhotoFile({
      memberId: 'm1',
      cccd: '012345678901',
      bytes,
      contentType: 'image/jpeg',
      idToken: 'admin-token',
    })

    const { headers, form } = sentForm()
    expect(headers).toEqual({ Authorization: 'Bearer admin-token' })
    expect(form.get('inviteToken')).toBeNull()
  })

  it('throws the API error', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'File too large' }, { status: 413 }))

    await expect(
      uploadMemberPhotoFile({ memberId: 'm1', cccd: '1', bytes, contentType: 'image/jpeg' }),
    ).rejects.toThrow(/File too large/)
  })
})

describe('uploadTemplePhotoFile', () => {
  it('POSTs the temple id and file', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ photoPath: 'temples/t1/photo.jpg' }))

    await expect(
      uploadTemplePhotoFile({ templeId: 't1', bytes, contentType: 'image/png', inviteToken: 'i' }),
    ).resolves.toEqual({ photoPath: 'temples/t1/photo.jpg' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/photos/temple')
    expect(sentForm().form.get('templeId')).toBe('t1')
  })
})

describe('uploadMemberDocumentFile', () => {
  it('POSTs the document type and side with the file', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ filePath: 'members/m1/docs/cccd/front.jpg' }))

    await expect(
      uploadMemberDocumentFile({
        memberId: 'm1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        bytes,
        contentType: 'image/jpeg',
        inviteToken: 'invite-token',
      }),
    ).resolves.toEqual({ filePath: 'members/m1/docs/cccd/front.jpg' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/docs/member')
    const { form } = sentForm()
    expect(form.get('typeId')).toBe('cccd')
    expect(form.get('side')).toBe('front')
  })
})
