import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFirebaseApp } from './client'

export function getClientStorage(): FirebaseStorage | null {
  const app = getFirebaseApp()
  if (!app) return null
  return getStorage(app)
}
