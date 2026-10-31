import { d1MemberStatsRepo } from '#/repositories/d1/stats'

export type MemberDirectoryStatsScope = {
  /** null = hệ phái global; string = thư ký giáo đoàn scope */
  orgUnitId: string | null
  /** org unit ids to count for byOrgUnit; empty skips that block */
  orgUnitIdsForBreakdown: string[]
}

export const memberStatsRepo = d1MemberStatsRepo
