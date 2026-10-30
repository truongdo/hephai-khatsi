import type { OrgUnit, OrgUnitKind } from '#/domain/types'
import { fromBooleanColumn, toBooleanColumn } from './rowValues'

export type OrgUnitRow = {
  id: string
  code: string
  name: string
  kind: OrgUnitKind
  sort_order: number
  allows_tang: number
  allows_ni: number
}

export function orgUnitToRow(unit: OrgUnit): OrgUnitRow {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    kind: unit.kind,
    sort_order: unit.order,
    allows_tang: toBooleanColumn(unit.allowsTang),
    allows_ni: toBooleanColumn(unit.allowsNi),
  }
}

function sqlLiteral(value: string | number): string {
  return typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`
}

/** Body of migrations/0002_seed_org_units.sql (see scripts/generate-d1-org-unit-seed.ts). */
export function orgUnitSeedSql(units: OrgUnit[]): string {
  const values = units.map((unit) => {
    const row = orgUnitToRow(unit)
    return `  (${[
      row.id,
      row.code,
      row.name,
      row.kind,
      row.sort_order,
      row.allows_tang,
      row.allows_ni,
    ]
      .map(sqlLiteral)
      .join(', ')})`
  })
  return [
    '-- Generated from src/domain/orgUnitSeed.ts by scripts/generate-d1-org-unit-seed.ts; do not edit.',
    'INSERT INTO org_units (id, code, name, kind, sort_order, allows_tang, allows_ni) VALUES',
    `${values.join(',\n')}`,
    'ON CONFLICT (id) DO NOTHING;',
    '',
  ].join('\n')
}

export function orgUnitFromRow(row: OrgUnitRow): OrgUnit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    order: row.sort_order,
    allowsTang: fromBooleanColumn(row.allows_tang),
    allowsNi: fromBooleanColumn(row.allows_ni),
  }
}
