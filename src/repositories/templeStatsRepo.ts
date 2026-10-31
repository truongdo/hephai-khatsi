import { d1TempleStatsRepo } from '#/repositories/d1/stats'

export type TempleDirectoryStatsScope = {
  /** null = hệ phái global; string = thư ký giáo đoàn scope */
  orgUnitId: string | null
  /** org unit ids to count for byOrgUnit; empty skips that block */
  orgUnitIdsForBreakdown: string[]
  /** city short names for listCityName buckets (from cities[].name) */
  cityNamesForBreakdown: string[]
}

export const templeStatsRepo = d1TempleStatsRepo
