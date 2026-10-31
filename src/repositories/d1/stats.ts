import type { MemberDirectoryStats } from '#/domain/memberDirectoryStats'
import type { TempleDirectoryStats } from '#/domain/templeDirectoryStats'
import { dataApi, type DataApiClient } from '#/data/apiClient'
import type { MemberDirectoryStatsScope } from '#/repositories/memberStatsRepo'
import type { TempleDirectoryStatsScope } from '#/repositories/templeStatsRepo'

// The stats dashboards in one request each over /api/data/stats/*.

export function createD1MemberStatsRepo(api: DataApiClient = dataApi) {
  return {
    loadDashboardStats: (scope: MemberDirectoryStatsScope): Promise<MemberDirectoryStats> =>
      api.post('stats/members', scope),
  }
}

export function createD1TempleStatsRepo(api: DataApiClient = dataApi) {
  return {
    loadDashboardStats: (scope: TempleDirectoryStatsScope): Promise<TempleDirectoryStats> =>
      api.post('stats/temples', scope),
  }
}

export const d1MemberStatsRepo = createD1MemberStatsRepo()
export const d1TempleStatsRepo = createD1TempleStatsRepo()
