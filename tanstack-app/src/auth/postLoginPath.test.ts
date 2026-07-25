import { describe, expect, it, vi } from 'vitest'
import { postLoginPath } from '#/auth/postLoginPath'

function userWithClaims(claims: Record<string, unknown>) {
  return {
    getIdTokenResult: vi.fn(async () => ({ claims })),
  }
}

describe('postLoginPath', () => {
  it('returns safe redirect when redirect is provided', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, '/admin/temples')).resolves.toBe(
      '/admin/temples',
    )
    expect(user.getIdTokenResult).not.toHaveBeenCalled()
  })

  it('rejects open-redirect values and falls through to claim check', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, '//evil.example')).resolves.toBe('/admin')
  })

  it('returns /admin when no redirect and admin claim is true', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, undefined)).resolves.toBe('/admin')
  })

  it('returns /admin when redirect is only "/" and admin claim is true', async () => {
    const user = userWithClaims({ admin: true })
    await expect(postLoginPath(user, '/')).resolves.toBe('/admin')
  })

  it('returns / when no redirect and user is not admin', async () => {
    const user = userWithClaims({})
    await expect(postLoginPath(user, undefined)).resolves.toBe('/')
  })

  it('returns / when getIdTokenResult throws', async () => {
    const user = {
      getIdTokenResult: vi.fn(async () => {
        throw new Error('token failed')
      }),
    }
    await expect(postLoginPath(user, undefined)).resolves.toBe('/')
  })
})
