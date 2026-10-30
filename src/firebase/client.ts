import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId?: string
  storageBucket?: string
}

export function readFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID
  if (!apiKey || !authDomain || !projectId || !appId) return null

  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId,
    storageBucket,
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null
  const config = readFirebaseWebConfig()
  if (!config) return null
  return getApps().length > 0 ? getApp() : initializeApp(config)
}

export function getClientAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app) return null
  return getAuth(app)
}
