import { describe, expect, it } from 'vitest'
import { isPublicAuthPath } from '#/auth/RequireAuth'

describe('isPublicAuthPath', () => {
  it('allows login and filler paths', () => {
    expect(isPublicAuthPath('/login')).toBe(true)
    expect(isPublicAuthPath('/f/abc')).toBe(true)
    expect(isPublicAuthPath('/f/abc/edit/member')).toBe(true)
  })

  it('requires auth for home, admin, and other app paths', () => {
    expect(isPublicAuthPath('/')).toBe(false)
    expect(isPublicAuthPath('/admin')).toBe(false)
    expect(isPublicAuthPath('/admin/temples')).toBe(false)
  })
})
