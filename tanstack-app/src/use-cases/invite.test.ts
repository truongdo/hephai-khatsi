import { describe, expect, it } from 'vitest'
import { createInvite } from './createInvite'
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
  it('creates and loads by token', async () => {
    const store = memoryInviteStore()
    const invite = await createInvite(
      {
        orgUnitId: 'gd-i',
        formType: 'member_tang',
        createdBy: 'admin-1',
      },
      store,
    )
    expect(invite.token.length).toBeGreaterThan(10)
    const loaded = await getInviteByToken(invite.token, store)
    expect(loaded.orgUnitId).toBe('gd-i')
  })

  it('throws INVITE_NOT_FOUND', async () => {
    const store = memoryInviteStore()
    await expect(getInviteByToken('missing', store)).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
    })
  })
})
