import { describe, expect, it } from 'vitest'
import { createInvite } from './createInvite'
import { ensurePublicInvite } from './ensurePublicInvite'
import { getInviteByToken } from './getInviteByToken'
import type { Invite } from '#/domain/types'

function memoryInviteStore() {
  const map = new Map<string, Invite>()
  return {
    async create(invite: Invite) {
      map.set(invite.token, invite)
    },
    async getByToken(token: string) {
      return map.get(token) ?? null
    },
  }
}

describe('invites', () => {
  it('creates the one invite and loads it by token', async () => {
    const store = memoryInviteStore()
    const invite = await createInvite({ createdBy: 'admin-1' }, store)
    expect(invite.token).toBe('public')
    expect(invite.createdBy).toBe('admin-1')
    const loaded = await getInviteByToken(invite.token, store)
    expect(loaded.id).toBe('public')
  })

  it('throws INVITE_NOT_FOUND', async () => {
    const store = memoryInviteStore()
    await expect(getInviteByToken('missing', store)).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
    })
  })

  it('ensurePublicInvite creates when missing', async () => {
    const store = memoryInviteStore()
    const invite = await ensurePublicInvite({ createdBy: 'admin-1' }, store)
    expect(invite).toMatchObject({
      id: 'public',
      token: 'public',
      createdBy: 'admin-1',
    })
  })

  it('ensurePublicInvite returns existing without overwrite', async () => {
    const store = memoryInviteStore()
    const first = await ensurePublicInvite({ createdBy: 'admin-1' }, store)
    const second = await ensurePublicInvite({ createdBy: 'admin-2' }, store)
    expect(second.createdBy).toBe('admin-1')
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.token).toBe('public')
  })
})
