import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore'
import { getFirebaseApp } from './client'

let cachedDb: Firestore | null | undefined

export function getClientFirestore(): Firestore | null {
  if (cachedDb !== undefined) return cachedDb

  const app = getFirebaseApp()
  if (!app) {
    cachedDb = null
    return null
  }

  try {
    cachedDb = initializeFirestore(app, { ignoreUndefinedProperties: true })
  } catch {
    // Already initialized elsewhere — settings only apply on first init.
    cachedDb = getFirestore(app)
  }
  return cachedDb
}
