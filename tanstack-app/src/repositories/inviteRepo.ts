import { getAdminDb } from '#/firebase/admin'
import { COLLECTIONS } from '#/firebase/collections'
import type { Invite } from '#/domain/types'

export type InviteStore = {
  create(invite: Invite): Promise<void>
  getByToken(token: string): Promise<Invite | null>
}

async function create(invite: Invite): Promise<void> {
  const { id, ...data } = invite
  await getAdminDb().collection(COLLECTIONS.invites).doc(id).set(data)
}

async function getByToken(token: string): Promise<Invite | null> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.invites)
    .doc(token)
    .get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<Invite, 'id'>) }
}

export const inviteRepo: InviteStore = { create, getByToken }
