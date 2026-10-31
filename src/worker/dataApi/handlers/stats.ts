import { canListDirectory } from '#/domain/authz/caller'
import { DomainError } from '#/domain/errors'
import { GIAO_PHAM_HE_PHAI_RANKS } from '#/domain/giaoPhamHePhaiRankOrder'
import { buildRankStatRows, type MemberDirectoryStats } from '#/domain/memberDirectoryStats'
import { buildCityStatRows, type TempleDirectoryStats } from '#/domain/templeDirectoryStats'
import type { SanghaType } from '#/domain/types'
import type { DataContext } from '../context'
import { stringArrayField, type Body } from '../input'
import { authorize } from '../records'
import { route, type DataRoute } from '../route'
import { MAX_BOUND_PARAMS, chunk, placeholders, selectAll } from '../sql'

// The stats dashboards in one request each (the Firestore repos made one
// count query per number): grouped counts, assembled like
// memberStatsRepo / templeStatsRepo.

const MAX_BREAKDOWN = 200

type Scope = { orgUnitId: string | null; orgUnitIdsForBreakdown: string[] }

/** Counts are list queries for the rules: each org unit counted must be listable. */
function authorizeScope(ctx: DataContext, scope: Scope): void {
  authorize(canListDirectory(ctx.caller, { orgUnitId: scope.orgUnitId }))
  for (const orgUnitId of scope.orgUnitIdsForBreakdown) {
    authorize(canListDirectory(ctx.caller, { orgUnitId }))
  }
}

function scopeFilter(scope: Scope): { sql: string; params: string[] } {
  return scope.orgUnitId === null
    ? { sql: '', params: [] }
    : { sql: 'WHERE org_unit_id = ?', params: [scope.orgUnitId] }
}

/** Counts per org unit, ignoring the scope (same as the Firestore repos). */
async function countByOrgUnit(
  db: D1Database,
  table: 'members' | 'temples',
  orgUnitIds: string[],
): Promise<{ orgUnitId: string; count: number }[]> {
  const counts = new Map<string, number>()
  for (const ids of chunk(orgUnitIds, MAX_BOUND_PARAMS)) {
    const rows = await selectAll<{ org_unit_id: string; count: number }>(
      db,
      `SELECT org_unit_id, COUNT(*) AS count FROM ${table} WHERE org_unit_id IN (${placeholders(ids.length)}) GROUP BY org_unit_id`,
      ids,
    )
    for (const row of rows) counts.set(row.org_unit_id, row.count)
  }
  return orgUnitIds.map((orgUnitId) => ({ orgUnitId, count: counts.get(orgUnitId) ?? 0 }))
}

async function memberStats(ctx: DataContext, scope: Scope): Promise<MemberDirectoryStats> {
  authorizeScope(ctx, scope)
  const filter = scopeFilter(scope)
  const rows = await selectAll<{ sangha_type: SanghaType; rank: string | null; count: number }>(
    ctx.db,
    `SELECT sangha_type, giao_pham_he_phai_rank AS rank, COUNT(*) AS count FROM members ${filter.sql} GROUP BY sangha_type, giao_pham_he_phai_rank`,
    filter.params,
  )
  const total = (sanghaType: SanghaType) =>
    rows.filter((row) => row.sangha_type === sanghaType).reduce((sum, row) => sum + row.count, 0)
  const rankRows = (sanghaType: SanghaType) => {
    const ranks = GIAO_PHAM_HE_PHAI_RANKS[sanghaType]
    const counts = ranks.map(
      (rank) => rows.find((row) => row.sangha_type === sanghaType && row.rank === rank)?.count ?? 0,
    )
    return buildRankStatRows(ranks, counts, total(sanghaType))
  }
  return {
    totals: { all: total('tang') + total('ni'), tang: total('tang'), ni: total('ni') },
    byOrgUnit: await countByOrgUnit(ctx.db, 'members', scope.orgUnitIdsForBreakdown),
    byRankTang: rankRows('tang'),
    byRankNi: rankRows('ni'),
  }
}

async function templeStats(
  ctx: DataContext,
  scope: Scope & { cityNamesForBreakdown: string[] },
): Promise<TempleDirectoryStats> {
  authorizeScope(ctx, scope)
  const filter = scopeFilter(scope)
  const rows = await selectAll<{ city: string | null; count: number }>(
    ctx.db,
    `SELECT list_city_name AS city, COUNT(*) AS count FROM temples ${filter.sql} GROUP BY list_city_name`,
    filter.params,
  )
  const all = rows.reduce((sum, row) => sum + row.count, 0)
  const cityCounts = scope.cityNamesForBreakdown.map(
    (cityName) => rows.find((row) => row.city === cityName)?.count ?? 0,
  )
  return {
    totals: { all },
    byOrgUnit: await countByOrgUnit(ctx.db, 'temples', scope.orgUnitIdsForBreakdown),
    byCity: buildCityStatRows(scope.cityNamesForBreakdown, cityCounts, all),
  }
}

function parseScope(body: Body): Scope {
  const orgUnitId = body.orgUnitId
  if (orgUnitId !== null && (typeof orgUnitId !== 'string' || orgUnitId.length === 0)) {
    throw new DomainError('INVALID_INPUT', 'orgUnitId must be a non-empty string or null')
  }
  return {
    orgUnitId,
    orgUnitIdsForBreakdown: stringArrayField(body, 'orgUnitIdsForBreakdown', MAX_BREAKDOWN),
  }
}

export const statsRoutes: Record<string, DataRoute> = {
  'stats/members': route(parseScope, memberStats),
  'stats/temples': route(
    (body) => ({
      ...parseScope(body),
      cityNamesForBreakdown: stringArrayField(body, 'cityNamesForBreakdown', MAX_BREAKDOWN),
    }),
    templeStats,
  ),
}
