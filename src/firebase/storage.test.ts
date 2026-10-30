import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getClientStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns null when Firebase config is incomplete', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    const { getClientStorage } = await import('./storage')
    expect(getClientStorage()).toBeNull()
  })

  it('returns a Storage instance when config is present', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    const { getClientStorage } = await import('./storage')
    expect(getClientStorage()).not.toBeNull()
  })
})
