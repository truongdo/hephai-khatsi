import { getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const DEFAULT_PROJECT_ID = 'demo-khatsi'

/** Admin init for Firestore emulator tests — no service account required. */
export function getTestAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const projectId = process.env.FIREBASE_PROJECT_ID ?? DEFAULT_PROJECT_ID
  return initializeApp({ projectId })
}

export function getTestAdminDb(): Firestore {
  return getFirestore(getTestAdminApp())
}

export function getTestProjectId(): string {
  return process.env.FIREBASE_PROJECT_ID ?? DEFAULT_PROJECT_ID
}

export async function clearFirestoreEmulator(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) {
    throw new Error('FIRESTORE_EMULATOR_HOST is required for integration tests')
  }

  const projectId = getTestProjectId()
  let res: Response
  try {
    res = await fetch(
      `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: 'DELETE' },
    )
  } catch (error) {
    throw new Error(
      `Firestore emulator not reachable at ${host}. Start it with: pnpm emulator:firestore`,
      { cause: error },
    )
  }

  if (!res.ok) {
    throw new Error(
      `Firestore emulator not reachable at ${host} (status ${res.status})`,
    )
  }
}
