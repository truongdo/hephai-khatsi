import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import type { Invite } from '#/domain/types'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'

// There is exactly one invite for the whole app — a fixed doc id, not a
// per-registration token — so "creating an invite" is really "creating the
// invite" (idempotent: see createInvite.ts).
export const PUBLIC_INVITE_ID = 'public'

export type InviteStore = {
  create(invite: Invite): Promise<void>
  getByToken(token: string): Promise<Invite | null>
}

function requireDb(): Firestore {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  return db
}

async function create(invite: Invite): Promise<void> {
  const { id, ...data } = invite
  await setDoc(doc(requireDb(), COLLECTIONS.invites, id), data)
}

async function getByToken(token: string): Promise<Invite | null> {
  const snap = await getDoc(doc(requireDb(), COLLECTIONS.invites, token))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Invite, 'id'>) }
}

export const inviteRepo: InviteStore = { create, getByToken }
