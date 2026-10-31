import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import {
  buildCityStatRows,
  type TempleDirectoryStats,
} from '#/domain/templeDirectoryStats'
import { DATA_BACKEND } from '#/data/dataBackend'
import { COLLECTIONS } from '#/firebase/collections'
import { getClientFirestore } from '#/firebase/firestore'
import { d1TempleStatsRepo } from '#/repositories/d1/stats'

export type TempleDirectoryStatsScope = {
  /** null = hệ phái global; string = thư ký giáo đoàn scope */
  orgUnitId: string | null
  /** org unit ids to count for byOrgUnit; empty skips that block */
  orgUnitIdsForBreakdown: string[]
  /** city short names for listCityName buckets (from cities[].name) */
  cityNamesForBreakdown: string[]
}

export type CountTemplesFn = (
  constraints: QueryConstraint[],
) => Promise<number>

async function defaultCountTemples(
  constraints: QueryConstraint[],
): Promise<number> {
  const db = getClientFirestore()
  if (!db) throw new Error('Firestore is not configured')
  const snap = await getCountFromServer(
    query(collection(db, COLLECTIONS.temples), ...constraints),
  )
  return snap.data().count
}

export function createTempleStatsRepo(countTemples: CountTemplesFn): {
  loadDashboardStats(
    scope: TempleDirectoryStatsScope,
  ): Promise<TempleDirectoryStats>
} {
  return {
    async loadDashboardStats(
      scope: TempleDirectoryStatsScope,
    ): Promise<TempleDirectoryStats> {
      const scopeConstraints: QueryConstraint[] = []
      if (scope.orgUnitId) {
        scopeConstraints.push(where('orgUnitId', '==', scope.orgUnitId))
      }
      const orgUnitIds = scope.orgUnitIdsForBreakdown
      const cityNames = scope.cityNamesForBreakdown

      const counts = await Promise.all([
        countTemples([...scopeConstraints]),
        ...orgUnitIds.map((orgUnitId) =>
          countTemples([where('orgUnitId', '==', orgUnitId)]),
        ),
        ...cityNames.map((cityName) =>
          countTemples([
            ...scopeConstraints,
            where('listCityName', '==', cityName),
          ]),
        ),
      ])

      const allCount = counts[0]!
      const orgUnitCounts = counts.slice(1, 1 + orgUnitIds.length)
      const cityCounts = counts.slice(1 + orgUnitIds.length)

      return {
        totals: { all: allCount },
        byOrgUnit: orgUnitIds.map((orgUnitId, i) => ({
          orgUnitId,
          count: orgUnitCounts[i]!,
        })),
        byCity: buildCityStatRows(cityNames, cityCounts, allCount),
      }
    },
  }
}

export const templeStatsRepo =
  DATA_BACKEND === 'd1' ? d1TempleStatsRepo : createTempleStatsRepo(defaultCountTemples)
