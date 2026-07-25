import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminClaim } from './useAdminClaim'

const useAuthMock = vi.fn()

vi.mock('#/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

describe('useAdminClaim', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('returns signed_out when no user', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('signed_out')
    })
  })

  it('returns denied when no recognizable claim is present', async () => {
    useAuthMock.mockReturnValue({
      user: {
        getIdTokenResult: async () => ({ claims: {} }),
        getIdToken: async () => 'token',
      },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('denied')
    })
  })

  it('returns denied when getIdTokenResult rejects', async () => {
    useAuthMock.mockReturnValue({
      user: {
        getIdTokenResult: async () => {
          throw new Error('token refresh failed')
        },
        getIdToken: async () => 'token',
      },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('denied')
    })
  })

  it('returns admin with he_phai_admin role for the legacy admin:true claim', async () => {
    const getIdTokenResult = vi.fn(async () => ({ claims: { admin: true } }))
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-uid-1', getIdTokenResult },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('admin')
    })
    expect(getIdTokenResult).toHaveBeenCalledWith(true)
    if (result.current.status === 'admin') {
      expect(result.current.uid).toBe('admin-uid-1')
      expect(result.current.role).toBe('he_phai_admin')
      expect(result.current.orgUnitId).toBeNull()
    }
  })

  it('returns admin with a scoped role and orgUnitId for role-based claims', async () => {
    const getIdTokenResult = vi.fn(async () => ({
      claims: { role: 'giao_doan_admin', orgUnitId: 'gd-i' },
    }))
    useAuthMock.mockReturnValue({
      user: { uid: 'gd-admin-uid', getIdTokenResult },
      loading: false,
    })
    const { result } = renderHook(() => useAdminClaim())
    await waitFor(() => {
      expect(result.current.status).toBe('admin')
    })
    if (result.current.status === 'admin') {
      expect(result.current.uid).toBe('gd-admin-uid')
      expect(result.current.role).toBe('giao_doan_admin')
      expect(result.current.orgUnitId).toBe('gd-i')
    }
  })
})
