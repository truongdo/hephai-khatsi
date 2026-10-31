import type { OrgUnit } from '#/domain/types'
import type { DataContext } from '../context'
import { stringField } from '../input'
import { route, type DataRoute } from '../route'
import { orgUnitFromRow, type OrgUnitRow } from '../rows/orgUnit'
import { selectAll, selectFirst } from '../sql'

// Ports of src/repositories/orgUnitRepo.ts reads (public). Org units are
// written by migrations only (0002 seed).

async function list(ctx: DataContext): Promise<OrgUnit[]> {
  const rows = await selectAll<OrgUnitRow>(ctx.db, 'SELECT * FROM org_units ORDER BY sort_order')
  return rows.map(orgUnitFromRow)
}

async function getById(ctx: DataContext, input: { id: string }): Promise<OrgUnit | null> {
  const row = await selectFirst<OrgUnitRow>(ctx.db, 'SELECT * FROM org_units WHERE id = ?', [input.id])
  return row ? orgUnitFromRow(row) : null
}

export const orgUnitRoutes: Record<string, DataRoute> = {
  'org-units/list': route(() => ({}), list),
  'org-units/get': route((body) => ({ id: stringField(body, 'id') }), getById),
}
