import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
import { parseInvite } from '#/domain/invite'
import type { Invite } from '#/domain/types'
import { DATA_BACKEND } from '#/data/dataBackend'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import { d1InviteRepo } from '#/repositories/d1/inviteRepo'

export { PUBLIC_INVITE_ID } from '#/domain/invite'

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
  return parseInvite(snap.id, snap.data() as Record<string, unknown>)
}

const firestoreInviteRepo: InviteStore = { create, getByToken }

export const inviteRepo: InviteStore = DATA_BACKEND === 'd1' ? d1InviteRepo : firestoreInviteRepo
