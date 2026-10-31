import { DATA_API_MAX_IDS, DATA_API_MAX_PAGE_SIZE } from '#/domain/dataApiLimits'
import type { Member } from '#/domain/types'
import { dataApi, type DataApiClient } from '#/data/apiClient'
import type { AdminListPage } from '#/repositories/adminListTypes'
import type { MemberStore } from '#/repositories/memberRepo'
import { chunk, collectPages } from './paging'

// MemberStore over /api/data/members/* (src/worker/dataApi/handlers/members.ts).

export function createD1MemberRepo(api: DataApiClient = dataApi): MemberStore {
  const list: MemberStore['list'] = (input) =>
    api.post<AdminListPage<Member>>('members/list', input)

  return {
    createOrUpdateDraft: (input) => api.post('members/save-draft', input),
    createOrUpdateAndLock: (input) => api.post('members/save-and-lock', input),
    requestEdit: (memberId, phone) => api.post('members/request-edit', { memberId, phone }),
    updateDraftById: (memberId, patch, options = {}) =>
      api.post('members/update', { memberId, patch, ...options }),
    getByCccd: (input) => api.post('members/get-by-cccd', input),
    getById: (memberId) => api.post('members/get', { id: memberId }),
    listByOrgSanghaAndPhone: (input) => api.post('members/list-by-phone', input),
    list,
    listByHaLapTab: (input) => api.post('members/list-ha-lap', input),
    async countByHaLapTab(input) {
      const { count } = await api.post<{ count: number }>('members/count-ha-lap', input)
      return count
    },
    listAllForExport: (input) =>
      collectPages((cursor) => list({ ...input, limit: DATA_API_MAX_PAGE_SIZE, cursor })),
    async listByCurrentTempleIds(templeIds) {
      const pages = await Promise.all(
        chunk([...new Set(templeIds)], DATA_API_MAX_IDS).map((ids) =>
          api.post<Member[]>('members/by-temples', { templeIds: ids }),
        ),
      )
      return pages.flat()
    },
    async deleteMany(ids) {
      for (const idChunk of chunk(ids, DATA_API_MAX_IDS)) {
        await api.post('members/delete-many', { ids: idChunk })
      }
    },
    setPhotoPath: (memberId, photoPath, audit) =>
      api.post('members/set-photo', { memberId, photoPath, audit }),
    setDocumentPaths: (memberId, documents) =>
      api.post('members/set-documents', { memberId, documents }),
    setTinhTrang: (memberId, tinhTrang, audit) =>
      api.post('members/set-tinh-trang', { memberId, tinhTrang, audit }),
    mergeDocumentSide: (memberId, typeId, side, filePath, audit) =>
      api.post('members/merge-document', { memberId, typeId, side, filePath, audit }),
    removeDocumentPaths: (memberId, typeId, side, audit) =>
      api.post('members/remove-document', { memberId, typeId, side, audit }),
    lock: (memberId, lockedBy, audit) => api.post('members/lock', { memberId, lockedBy, audit }),
    unlock: (memberId, audit) => api.post('members/unlock', { memberId, audit }),
    listDirectorySecretaries: () => api.post('members/secretaries', { role: 'giao_doan_admin' }),
    listHePhaiSecretaries: () => api.post('members/secretaries', { role: 'he_phai_secretary' }),
  }
}

export const d1MemberRepo: MemberStore = createD1MemberRepo()
