import { dataApi, type DataApiClient } from '#/data/apiClient'
import type { InviteStore } from '#/repositories/inviteRepo'

// InviteStore over /api/data/invites/* (src/worker/dataApi/handlers/invites.ts).
// The Worker builds the invite from its kind (and retreat) and the caller.

export function createD1InviteRepo(api: DataApiClient = dataApi): InviteStore {
  return {
    async create(invite) {
      await api.post(
        'invites/create',
        invite.kind === 'retreat_registration'
          ? { kind: invite.kind, retreatId: invite.retreatId }
          : { kind: invite.kind },
      )
    },
    getByToken: (token) => api.post('invites/get', { token }),
  }
}

export const d1InviteRepo: InviteStore = createD1InviteRepo()
