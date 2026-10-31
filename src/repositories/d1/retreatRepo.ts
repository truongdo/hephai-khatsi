import { dataApi, type DataApiClient } from '#/data/apiClient'
import type { RetreatStore } from '#/repositories/retreatRepo'

// RetreatStore over /api/data/retreats/* (src/worker/dataApi/handlers/retreats.ts).
// The Worker sets `createdBy` from the caller's token.

export function createD1RetreatRepo(api: DataApiClient = dataApi): RetreatStore {
  return {
    create: ({ orgUnitId, fields }) => api.post('retreats/create', { orgUnitId, fields }),
    update: (id, fields) => api.post('retreats/update', { id, fields }),
    setStatus: (id, status) => api.post('retreats/set-status', { id, status }),
    getById: (id) => api.post('retreats/get', { id }),
    list: (input) => api.post('retreats/list', input),
    async delete(id) {
      await api.post('retreats/delete', { id })
    },
  }
}

export const d1RetreatRepo: RetreatStore = createD1RetreatRepo()
