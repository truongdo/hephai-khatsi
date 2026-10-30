import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { grantDirectoryRole, revokeDirectoryRole } from './directoryRoleApiClient'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('grantDirectoryRole', () => {
  it('POSTs to grant with memberId and Authorization', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memberId: 'm1',
        directoryAuthUid: 'auth-1',
        orgUnitId: 'gd-i',
        email: 'sec@gmail.com',
      }),
    })

    const result = await grantDirectoryRole({
      memberId: 'm1',
      role: 'giao_doan_admin',
      idToken: 'admin-token',
    })

    expect(result).toEqual({
      memberId: 'm1',
      directoryAuthUid: 'auth-1',
      orgUnitId: 'gd-i',
      email: 'sec@gmail.com',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/directory-role/grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ memberId: 'm1', role: 'giao_doan_admin' }),
    })
  })

  it('throws when grant fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'EMAIL_NOT_GMAIL', code: 'EMAIL_NOT_GMAIL' }),
    })

    await expect(
      grantDirectoryRole({
        memberId: 'm1',
        role: 'giao_doan_admin',
        idToken: 'admin-token',
      }),
    ).rejects.toThrow(/EMAIL_NOT_GMAIL/)
  })
})

describe('revokeDirectoryRole', () => {
  it('POSTs to revoke with memberId and Authorization', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ memberId: 'm1' }),
    })

    const result = await revokeDirectoryRole({
      memberId: 'm1',
      idToken: 'admin-token',
    })

    expect(result).toEqual({ memberId: 'm1' })
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/directory-role/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ memberId: 'm1' }),
    })
  })

  it('throws when revoke fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    })

    await expect(
      revokeDirectoryRole({ memberId: 'm1', idToken: 'bad' }),
    ).rejects.toThrow(/Forbidden/)
  })
})
