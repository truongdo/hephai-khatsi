import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseApp } from './client'

export function getClientFirestore(): Firestore | null {
  const app = getFirebaseApp()
  if (!app) return null
  return getFirestore(app)
}
