import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { upsertAllOrgUnits } from '../src/repositories/orgUnitRepo'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

// No Admin SDK here: this app has no server, so seeding signs in as a real
// admin user (must already have the `admin` custom claim set — see
// README) via the client SDK, same as the browser would.
const app = initializeApp({
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
})

await signInWithEmailAndPassword(
  getAuth(app),
  requireEnv('SEED_ADMIN_EMAIL'),
  requireEnv('SEED_ADMIN_PASSWORD'),
)

await upsertAllOrgUnits(undefined, getFirestore(app))
console.log('Seeded org units')
