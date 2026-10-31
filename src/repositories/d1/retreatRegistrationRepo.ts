import { dataApi, type DataApiClient } from '#/data/apiClient'
import { DATA_API_MAX_IDS } from '#/domain/dataApiLimits'
import type { RetreatRegistrationStore } from '#/repositories/retreatRegistrationRepo'
import { chunk } from './paging'

// RetreatRegistrationStore over /api/data/registrations/*
// (src/worker/dataApi/handlers/registrations.ts). The Worker builds the
// server-set fields itself (id, org unit, status, registeredBy, reviewer,
// timestamps), so only what the caller chose is sent.

export function createD1RetreatRegistrationRepo(
  api: DataApiClient = dataApi,
): RetreatRegistrationStore {
  return {
    async create(reg) {
      await api.post('registrations/create', {
        retreatId: reg.retreatId,
        memberId: reg.memberId,
        registeredVia: reg.registeredVia,
        extraAnswers: reg.extraAnswers,
      })
    },
    getById: (id) => api.post('registrations/get', { id }),
    listByRetreat: (input) => api.post('registrations/list-by-retreat', input),
    async updateReview(ids, patch) {
      for (const idChunk of chunk(ids, DATA_API_MAX_IDS)) {
        await api.post('registrations/review', {
          ids: idChunk,
          status: patch.status,
          rejectionReason: patch.rejectionReason,
        })
      }
    },
  }
}

export const d1RetreatRegistrationRepo: RetreatRegistrationStore =
  createD1RetreatRegistrationRepo()
