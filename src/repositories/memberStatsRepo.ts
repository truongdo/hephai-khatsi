import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { NI_RANKS, TANG_RANKS } from '#/components/filler/fillerFormOptions'
import {
  buildRankStatRows,
  type MemberDirectoryStats,
} from '#/domain/memberDirectoryStats'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'

export type MemberDirectoryStatsScope = {
  /** null = hệ phái global; string = thư ký giáo đoàn scope */
  orgUnitId: string | null
  /** org unit ids to count for byOrgUnit; empty skips that block */
  orgUnitIdsForBreakdown: string[]
}

export type CountMembersFn = (
  constraints: QueryConstraint[],
) => Promise<number>

async function defaultCountMembers(
  constraints: QueryConstraint[],
): Promise<number> {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  const snap = await getCountFromServer(
    query(collection(db, COLLECTIONS.members), ...constraints),
  )
  return snap.data().count
}

export function createMemberStatsRepo(countMembers: CountMembersFn): {
  loadDashboardStats(
    scope: MemberDirectoryStatsScope,
  ): Promise<MemberDirectoryStats>
} {
  const tangRanks = TANG_RANKS.map((o) => o.value)
  const niRanks = NI_RANKS.map((o) => o.value)

  return {
    async loadDashboardStats(
      scope: MemberDirectoryStatsScope,
    ): Promise<MemberDirectoryStats> {
      const scopeConstraints: QueryConstraint[] = []
      if (scope.orgUnitId) {
        scopeConstraints.push(where('orgUnitId', '==', scope.orgUnitId))
      }

      const orgUnitIds = scope.orgUnitIdsForBreakdown

      const counts = await Promise.all([
        countMembers([...scopeConstraints]),
        countMembers([
          ...scopeConstraints,
          where('sanghaType', '==', 'tang'),
        ]),
        countMembers([...scopeConstraints, where('sanghaType', '==', 'ni')]),
        ...orgUnitIds.map((orgUnitId) =>
          countMembers([where('orgUnitId', '==', orgUnitId)]),
        ),
        ...tangRanks.map((rank) =>
          countMembers([
            ...scopeConstraints,
            where('sanghaType', '==', 'tang'),
            where('giaoPhamHePhai.rank', '==', rank),
          ]),
        ),
        ...niRanks.map((rank) =>
          countMembers([
            ...scopeConstraints,
            where('sanghaType', '==', 'ni'),
            where('giaoPhamHePhai.rank', '==', rank),
          ]),
        ),
      ])

      const [allCount, tangCount, niCount, ...rest] = counts
      const orgUnitCounts = rest.slice(0, orgUnitIds.length)
      const tangRankCounts = rest.slice(
        orgUnitIds.length,
        orgUnitIds.length + tangRanks.length,
      )
      const niRankCounts = rest.slice(orgUnitIds.length + tangRanks.length)

      return {
        totals: { all: allCount!, tang: tangCount!, ni: niCount! },
        byOrgUnit: orgUnitIds.map((orgUnitId, i) => ({
          orgUnitId,
          count: orgUnitCounts[i]!,
        })),
        byRankTang: buildRankStatRows(tangRanks, tangRankCounts, tangCount!),
        byRankNi: buildRankStatRows(niRanks, niRankCounts, niCount!),
      }
    },
  }
}

export const memberStatsRepo = createMemberStatsRepo(defaultCountMembers)
