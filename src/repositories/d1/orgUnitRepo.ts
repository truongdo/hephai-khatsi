import type { OrgUnit } from '#/domain/types'
import { dataApi, type DataApiClient } from '#/data/apiClient'

// Org unit reads over /api/data/org-units/* (public, list cached 5 min).

export function createD1ListOrgUnits(api: DataApiClient = dataApi): () => Promise<OrgUnit[]> {
  return () => api.get('org-units/list')
}

export const d1ListOrgUnits = createD1ListOrgUnits()
