import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteMemberPhotoObject,
  deleteTemplePhotoObject,
  putToPresignedUrl,
  requestMemberPhotoUploadUrl,
  requestTemplePhotoUploadUrl,
} from './photosApiClient'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestMemberPhotoUploadUrl', () => {
  it('POSTs to member-upload-url with invite token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://r2.example/upload',
        photoPath: 'members/m1/photo.jpg',
      }),
    })

    const result = await requestMemberPhotoUploadUrl({
      memberId: 'm1',
      cccd: '012345678901',
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
    })

    expect(result).toEqual({
      uploadUrl: 'https://r2.example/upload',
      photoPath: 'members/m1/photo.jpg',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/photos/member-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'm1',
        cccd: '012345678901',
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
        photoPath: 'members/m1/photo.jpg',
      }),
    })

    await requestMemberPhotoUploadUrl({
      memberId: 'm1',
      cccd: '012345678901',
      contentType: 'image/jpeg',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/member-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        memberId: 'm1',
        cccd: '012345678901',
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
      requestMemberPhotoUploadUrl({
        memberId: 'm1',
        cccd: '012345678901',
        contentType: 'image/jpeg',
        inviteToken: 'bad',
      }),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('putToPresignedUrl', () => {
  it('PUTs bytes to the presigned URL with content type', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const bytes = new Uint8Array([1, 2, 3])

    await putToPresignedUrl('https://r2.example/upload', bytes, 'image/jpeg')

    expect(fetchMock).toHaveBeenCalledWith('https://r2.example/upload', {
      method: 'PUT',
      body: bytes,
      headers: { 'Content-Type': 'image/jpeg' },
    })
  })

  it('throws when the PUT fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(
      putToPresignedUrl(
        'https://r2.example/upload',
        new Uint8Array([1]),
        'image/jpeg',
      ),
    ).rejects.toThrow(/upload/)
  })
})

describe('deleteMemberPhotoObject', () => {
  it('DELETEs member photo with admin token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteMemberPhotoObject({
      memberId: 'm1',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/member', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ memberId: 'm1' }),
    })
  })

  it('DELETEs member photo with invite token and cccd', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteMemberPhotoObject({
      memberId: 'm1',
      cccd: '012345678901',
      inviteToken: 'invite-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/member', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'm1',
        cccd: '012345678901',
        inviteToken: 'invite-token',
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
      deleteMemberPhotoObject({ memberId: 'm1', idToken: 'bad' }),
    ).rejects.toThrow(/Unauthorized/)
  })
})

describe('requestTemplePhotoUploadUrl', () => {
  it('POSTs to temple-upload-url with invite token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://r2.example/upload',
        photoPath: 'temples/t1/photo.jpg',
      }),
    })

    const result = await requestTemplePhotoUploadUrl({
      templeId: 't1',
      contentType: 'image/jpeg',
      inviteToken: 'invite-token',
    })

    expect(result).toEqual({
      uploadUrl: 'https://r2.example/upload',
      photoPath: 'temples/t1/photo.jpg',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/photos/temple-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templeId: 't1',
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
        photoPath: 'temples/t1/photo.jpg',
      }),
    })

    await requestTemplePhotoUploadUrl({
      templeId: 't1',
      contentType: 'image/jpeg',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/temple-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        templeId: 't1',
        contentType: 'image/jpeg',
      }),
    })
  })
})

describe('deleteTemplePhotoObject', () => {
  it('DELETEs temple photo with admin token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteTemplePhotoObject({
      templeId: 't1',
      idToken: 'admin-token',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/temple', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ templeId: 't1' }),
    })
  })

  it('DELETEs temple photo with invite token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    await deleteTemplePhotoObject({
      templeId: 't1',
      inviteToken: 'invite-1',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/temple', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templeId: 't1',
        inviteToken: 'invite-1',
      }),
    })
  })
})