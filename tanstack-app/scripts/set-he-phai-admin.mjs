// scripts/set-he-phai-admin.mjs
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const email = process.argv[2] ?? 'admin@example.com'
const saPath = process.argv[3] // path to service account JSON

initializeApp({
  credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))),
})

const auth = getAuth()
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { role: 'he_phai_admin' })
// optional: also set { admin: true, role: 'he_phai_admin' }

console.log('OK', email, user.uid, (await auth.getUser(user.uid)).customClaims)
