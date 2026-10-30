import type { Member, Temple } from '#/domain/types'
import {
  toMemberSearchDoc,
  toTempleSearchDoc,
} from '#/domain/searchDocs'
import {
  deleteSearchDocument,
  upsertSearchDocument,
} from './searchApiClient'

type SearchAuth = {
  idToken?: string
  inviteToken?: string
}

function logSearchNotifyError(action: string, error: unknown): void {
  console.error(`[search-index] ${action} failed`, error)
}

export async function notifyMemberUpsert(
  member: Member,
  auth: SearchAuth,
): Promise<void> {
  try {
    await upsertSearchDocument({
      collection: 'members',
      document: toMemberSearchDoc(member),
      idToken: auth.idToken,
      inviteToken: auth.inviteToken,
    })
  } catch (error) {
    logSearchNotifyError('member upsert', error)
  }
}

export async function notifyTempleUpsert(
  temple: Temple,
  auth: SearchAuth,
): Promise<void> {
  try {
    await upsertSearchDocument({
      collection: 'temples',
      document: toTempleSearchDoc(temple),
      idToken: auth.idToken,
      inviteToken: auth.inviteToken,
    })
  } catch (error) {
    logSearchNotifyError('temple upsert', error)
  }
}

export async function notifyMemberDelete(
  id: string,
  idToken: string,
): Promise<void> {
  try {
    await deleteSearchDocument({
      collection: 'members',
      id,
      idToken,
    })
  } catch (error) {
    logSearchNotifyError('member delete', error)
  }
}

export async function notifyTempleDelete(
  id: string,
  idToken: string,
): Promise<void> {
  try {
    await deleteSearchDocument({
      collection: 'temples',
      id,
      idToken,
    })
  } catch (error) {
    logSearchNotifyError('temple delete', error)
  }
}
