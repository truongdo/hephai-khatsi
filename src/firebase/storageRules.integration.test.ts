import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeEach, describe, it } from 'vitest'

// Storage rules' firestore.get() cross-service calls resolve against the
// project the emulator suite itself was started with (`--project demo-khatsi`,
// see package.json's `emulator:firestore`/`test:integration` scripts), not
// whatever project id this test process picks — so this must match.
const PROJECT_ID = 'demo-khatsi'
const MEMBER_ID = 'gd-i_tang_012345678901'
const INVITE_ID = 'invite-member-1'

let testEnv: RulesTestEnvironment

async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (testEnv) return testEnv
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: 'service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }',
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(resolve(__dirname, '../../../firebase/storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  })
  return testEnv
}

async function seedMember(status: 'draft' | 'locked' = 'draft') {
  const env = await getTestEnv()
  const db = env.unauthenticatedContext().firestore()
  await setDoc(doc(db, 'members', MEMBER_ID), { orgUnitId: 'gd-i', status })
  await setDoc(doc(db, 'invites', INVITE_ID), { orgUnitId: 'gd-i', formType: 'member_tang' })
}

const bytes = new Uint8Array([1, 2, 3])

beforeEach(async () => {
  const env = await getTestEnv()
  await env.clearFirestore()
})

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

describe('member photo storage rules', () => {
  it('allows anyone to read a photo', async () => {
    await seedMember()
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().storage()
    await assertSucceeds(
      uploadBytes(ref(anon, `members/${MEMBER_ID}/photo.jpg`), bytes, {
        contentType: 'image/jpeg',
        customMetadata: { inviteToken: INVITE_ID },
      }),
    )
    await assertSucceeds(getBytes(ref(anon, `members/${MEMBER_ID}/photo.jpg`)))
  })

  it('allows upload with a matching invite, rejects without one', async () => {
    await seedMember()
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().storage()
    await assertSucceeds(
      uploadBytes(ref(anon, `members/${MEMBER_ID}/photo.jpg`), bytes, {
        contentType: 'image/jpeg',
        customMetadata: { inviteToken: INVITE_ID },
      }),
    )
    await assertFails(
      uploadBytes(ref(anon, `members/${MEMBER_ID}/photo.jpg`), bytes, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects upload for a locked member even with a valid invite', async () => {
    await seedMember('locked')
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().storage()
    await assertFails(
      uploadBytes(ref(anon, `members/${MEMBER_ID}/photo.jpg`), bytes, {
        contentType: 'image/jpeg',
        customMetadata: { inviteToken: INVITE_ID },
      }),
    )
  })

  it('rejects non-image content types', async () => {
    await seedMember()
    const env = await getTestEnv()
    const anon = env.unauthenticatedContext().storage()
    await assertFails(
      uploadBytes(ref(anon, `members/${MEMBER_ID}/photo.jpg`), bytes, {
        contentType: 'application/pdf',
        customMetadata: { inviteToken: INVITE_ID },
      }),
    )
  })

  it('lets admin upload without an invite', async () => {
    await seedMember()
    const env = await getTestEnv()
    const admin = env.authenticatedContext('admin-uid', { admin: true }).storage()
    await assertSucceeds(
      uploadBytes(ref(admin, `members/${MEMBER_ID}/photo.jpg`), bytes, { contentType: 'image/jpeg' }),
    )
  })
})
