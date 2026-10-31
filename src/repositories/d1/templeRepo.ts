import type { Temple } from '#/domain/types'
import { dataApi, type DataApiClient } from '#/data/apiClient'
import type { AdminListPage } from '#/repositories/adminListTypes'
import type { TempleStore } from '#/repositories/templeRepo'
import { MAX_IDS, MAX_PAGE_SIZE, chunk, collectPages } from './paging'

// TempleStore over /api/data/temples/* (src/worker/dataApi/handlers/temples.ts).

export function createD1TempleRepo(api: DataApiClient = dataApi): TempleStore {
  const list: TempleStore['list'] = (input) =>
    api.post<AdminListPage<Temple>>('temples/list', input)

  return {
    createOrUpdateDraft: (input) => api.post('temples/save-draft', input),
    createOrUpdateAndLock: (input) => api.post('temples/save-and-lock', input),
    requestEdit: (templeId, phone) => api.post('temples/request-edit', { templeId, phone }),
    getById: (templeId) => api.post('temples/get', { id: templeId }),
    listByOrgAndPhone: (input) => api.post('temples/list-by-phone', input),
    list,
    listAllForExport: (input) =>
      collectPages((cursor) => list({ ...input, limit: MAX_PAGE_SIZE, cursor })),
    lock: (templeId, lockedBy, audit) => api.post('temples/lock', { templeId, lockedBy, audit }),
    unlock: (templeId, audit) => api.post('temples/unlock', { templeId, audit }),
    setPhotoPath: (templeId, photoPath, audit) =>
      api.post('temples/set-photo', { templeId, photoPath, audit }),
    async deleteMany(ids) {
      for (const idChunk of chunk(ids, MAX_IDS)) {
        await api.post('temples/delete-many', { ids: idChunk })
      }
    },
  }
}

export const d1TempleRepo: TempleStore = createD1TempleRepo()
