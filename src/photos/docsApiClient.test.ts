import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteMemberDocumentObjects,
  deleteMemberDocumentsPrefix,
  requestMemberDocumentUploadUrl,
} from './docsApiClient'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestMemberDocumentUploadUrl', () => {
  it('POSTs to member-upload-url with document fields', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://r2.example/upload',
        filePath: 'members/m1/docs/cccd/front.jpg',
      }),
    })

    const result = await requestMemberDocumentUploadUrl({
      memberId: 'm1',
      cccd: '012345678901',
      typeId: 'cccd',
      side: 'front',
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
    })

    expect(result).toEqual({
      uploadUrl: 'https://r2.example/upload',
      filePath: 'members/m1/docs/cccd/front.jpg',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/docs/member-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'm1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        contentType: 'image/jpeg',
        inviteToken: 'invite-token',
      }),
    })
  })

  it('POSTs with Authorization when idToken is provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://r2.example/upload',
        filePath: 'members/m1/docs/cccd/front.jpg',
      }),
    })

    await requestMemberDocumentUploadUrl({
      memberId: 'm1',
      cccd: '012345678901',
      typeId: 'cccd',
      side: 'front',
      contentType: 'image/jpeg',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/member-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        memberId: 'm1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        contentType: 'image/jpeg',
      }),
    })
  })

  it('throws when the API response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    })

    await expect(
      requestMemberDocumentUploadUrl({
        memberId: 'm1',
        cccd: '012345678901',
        typeId: 'cccd',
        side: 'front',
        contentType: 'image/jpeg',
        inviteToken: 'bad',
      }),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('deleteMemberDocumentObjects', () => {
  it('DELETEs member documents with paths and invite token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteMemberDocumentObjects({
      memberId: 'm1',
      typeId: 'cccd',
      paths: ['members/m1/docs/cccd/front.jpg'],
      cccd: '012345678901',
      inviteToken: 'invite-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/member', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'm1',
        typeId: 'cccd',
        paths: ['members/m1/docs/cccd/front.jpg'],
        cccd: '012345678901',
        inviteToken: 'invite-token',
      }),
    })
  })

  it('DELETEs with admin token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteMemberDocumentObjects({
      memberId: 'm1',
      typeId: 'cccd',
      paths: ['members/m1/docs/cccd/front.jpg'],
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/member', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        memberId: 'm1',
        typeId: 'cccd',
        paths: ['members/m1/docs/cccd/front.jpg'],
      }),
    })
  })

  it('throws when delete fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })

    await expect(
      deleteMemberDocumentObjects({
        memberId: 'm1',
        typeId: 'cccd',
        paths: ['members/m1/docs/cccd/front.jpg'],
        idToken: 'bad',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })
})

describe('deleteMemberDocumentsPrefix', () => {
  it('DELETEs member docs prefix with admin token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteMemberDocumentsPrefix({
      memberId: 'm1',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/member-prefix', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ memberId: 'm1' }),
    })
  })

  it('throws when prefix delete fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })

    await expect(
      deleteMemberDocumentsPrefix({
        memberId: 'm1',
        idToken: 'bad',
      }),
    ).rejects.toThrow(/Unauthorized/)
  })
})
