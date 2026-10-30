import { afterEach, describe, expect, it, vi } from 'vitest'

describe('readFirebaseWebConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns null when required VITE vars are missing', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '')
    const { readFirebaseWebConfig } = await import('./client')
    expect(readFirebaseWebConfig()).toBeNull()
  })

  it('returns config when required VITE vars are set', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '')
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', '')
    const { readFirebaseWebConfig } = await import('./client')
    expect(readFirebaseWebConfig()).toEqual({
      apiKey: 'key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:123:web:abc',
      messagingSenderId: undefined,
      storageBucket: undefined,
    })
  })

  it('returns config with optional VITE vars when set', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456')
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'demo.appspot.com')
    const { readFirebaseWebConfig } = await import('./client')
    expect(readFirebaseWebConfig()).toEqual({
      apiKey: 'key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:123:web:abc',
      messagingSenderId: '123456',
      storageBucket: 'demo.appspot.com',
    })
  })
})

describe('getFirebaseApp / getClientAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('getFirebaseApp returns null when config is incomplete', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    const { getFirebaseApp } = await import('./client')
    expect(getFirebaseApp()).toBeNull()
  })

  it('getFirebaseApp returns null when window is undefined', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc')
    const { getFirebaseApp } = await import('./client')
    expect(getFirebaseApp()).toBeNull()
  })

  it('getClientAuth returns null when config is incomplete', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    const { getClientAuth } = await import('./client')
    expect(getClientAuth()).toBeNull()
  })
})
