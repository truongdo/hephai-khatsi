import { auditLogToRow } from '../rows/auditLog'
import { inviteToRow } from '../rows/invite'
import { memberToRow } from '../rows/member'
import { orgUnitToRow } from '../rows/orgUnit'
import { registrationToRow } from '../rows/registration'
import { retreatToRow } from '../rows/retreat'
import { sqlLiteral, type ColumnValue } from '../rows/rowValues'
import { templeManagerPhoneRows, templeToRow } from '../rows/temple'
import type { ImportRecords } from './exportFormat'

export type ImportTable =
  | 'org_units'
  | 'invites'
  | 'members'
  | 'temples'
  | 'temple_manager_phones'
  | 'audit_logs'
  | 'retreats'
  | 'retreat_registrations'

export type TableRows = { table: ImportTable; rows: Array<Record<string, ColumnValue>> }

export type ImportProblems = {
  /** The import would fail or lose data: nothing is written. */
  errors: string[]
  /** Imported as is, but worth a look (orphans, missing sort keys). */
  warnings: string[]
}

/** NOT NULL and CHECK constraints of migrations/0001_init.sql. */
export const COLUMN_RULES: Record<ImportTable, { required: string[]; allowed?: Record<string, string[]> }> = {
  org_units: { required: ['id', 'code', 'name', 'kind', 'sort_order', 'allows_tang', 'allows_ni'] },
  invites: { required: ['id', 'kind', 'disabled', 'created_at', 'created_by'] },
  members: {
    required: ['id', 'org_unit_id', 'sangha_type', 'cccd', 'status', 'created_at', 'updated_at', 'data'],
    allowed: { sangha_type: ['tang', 'ni'], status: ['draft', 'locked'] },
  },
  temples: {
    required: ['id', 'org_unit_id', 'status', 'created_at', 'updated_at', 'data'],
    allowed: { status: ['draft', 'locked'] },
  },
  temple_manager_phones: { required: ['temple_id', 'org_unit_id', 'phone'] },
  audit_logs: {
    required: ['parent_type', 'parent_id', 'id', 'action', 'at', 'actor_type', 'actor_id', 'changes'],
    allowed: { parent_type: ['members', 'temples'] },
  },
  retreats: {
    required: ['id', 'type', 'org_unit_id', 'status', 'created_by', 'created_at', 'updated_at', 'data'],
  },
  retreat_registrations: {
    required: [
      'id',
      'retreat_id',
      'member_id',
      'org_unit_id',
      'status',
      'registered_via',
      'created_at',
      'updated_at',
      'data',
    ],
  },
}

/** Columns the admin lists sort by: a NULL hides the row from those lists. */
const SORT_COLUMNS: Partial<Record<ImportTable, string[]>> = {
  members: ['ha_lap_tab_rank', 'sap_xep_ha_lap', 'giao_pham_he_phai_rank_order', 'org_unit_name'],
  temples: ['list_city_name', 'org_unit_name'],
}

/** Data tables, children before parents (the order `--replace` deletes in). */
const DATA_TABLES_DELETE_ORDER: ImportTable[] = [
  'retreat_registrations',
  'retreats',
  'audit_logs',
  'temple_manager_phones',
  'temples',
  'members',
  'invites',
]

/** D1's limit on the length of one SQL statement. */
export const MAX_STATEMENT_BYTES = 100_000

const SAMPLE_IDS = 5

const utf8 = new TextEncoder()

function statementBytes(statement: string): number {
  return utf8.encode(statement).length
}

function sample(ids: string[]): string {
  const shown = ids.slice(0, SAMPLE_IDS).join(', ')
  return ids.length > SAMPLE_IDS ? `${shown}, … (+${ids.length - SAMPLE_IDS})` : shown
}

function rowKey(table: ImportTable, row: Record<string, ColumnValue>): string {
  if (table === 'audit_logs') return `${row.parent_type}/${row.parent_id}/${row.id}`
  if (table === 'temple_manager_phones') return `${row.temple_id}/${row.phone}`
  return String(row.id)
}

/** Rows of every table, in insert order. Run `checkImport` first. */
export function importRows(records: ImportRecords): TableRows[] {
  return [
    { table: 'org_units', rows: records.orgUnits.map(orgUnitToRow) },
    { table: 'invites', rows: records.invites.map(inviteToRow) },
    { table: 'members', rows: records.members.map(memberToRow) },
    { table: 'temples', rows: records.temples.map(templeToRow) },
    { table: 'temple_manager_phones', rows: records.temples.flatMap(templeManagerPhoneRows) },
    {
      table: 'audit_logs',
      rows: records.auditLogs.map(({ parent, entry }) => auditLogToRow(parent, entry)),
    },
    { table: 'retreats', rows: records.retreats.map(retreatToRow) },
    { table: 'retreat_registrations', rows: records.registrations.map(registrationToRow) },
  ]
}

function isColumnValue(value: unknown): value is ColumnValue {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function checkColumns({ table, rows }: TableRows): string[] {
  const rules = COLUMN_RULES[table]
  const problems = new Map<string, string[]>()
  const add = (problem: string, id: string) => {
    problems.set(problem, [...(problems.get(problem) ?? []), id])
  }
  for (const row of rows) {
    const id = rowKey(table, row)
    for (const [column, value] of Object.entries(row)) {
      if (value === undefined || value === null) {
        if (rules.required.includes(column)) add(`${column} is missing`, id)
      } else if (!isColumnValue(value)) {
        add(`${column} is not a string or number`, id)
      } else if (rules.allowed?.[column] && !rules.allowed[column].includes(String(value))) {
        add(`${column} is not one of ${rules.allowed[column].join(' / ')}`, id)
      }
    }
  }
  return [...problems].map(([problem, ids]) => `${table}: ${problem}: ${sample(ids)}`)
}

function duplicates(keys: Array<[key: string, id: string]>): string[][] {
  const byKey = new Map<string, string[]>()
  for (const [key, id] of keys) byKey.set(key, [...(byKey.get(key) ?? []), id])
  return [...byKey.values()].filter((ids) => ids.length > 1)
}

function countWarning(what: string, ids: string[]): string[] {
  return ids.length ? [`${ids.length} ${what}: ${sample(ids)}`] : []
}

/** Everything that would make the import fail, and what it would import oddly. */
export function checkImport(records: ImportRecords): ImportProblems {
  const errors: string[] = []
  const warnings: string[] = []

  const badInvites = records.invites.filter((invite) => invite.token !== invite.id)
  if (badInvites.length) {
    errors.push(`invites: token differs from the document id: ${sample(badInvites.map((i) => i.id))}`)
  }
  const tables = importRows({
    ...records,
    invites: records.invites.filter((invite) => invite.token === invite.id),
  })
  errors.push(...tables.flatMap(checkColumns))
  if (!errors.length) {
    const tooLong = tables.flatMap(({ table, rows }) =>
      rows
        .filter((row) => statementBytes(insertStatement(table, row)) > MAX_STATEMENT_BYTES)
        .map((row) => `${table}/${rowKey(table, row)}`),
    )
    if (tooLong.length) {
      errors.push(`records over D1's ${MAX_STATEMENT_BYTES}-byte statement limit: ${sample(tooLong)}`)
    }
  }

  for (const ids of duplicates(
    records.members.map((m) => [`${m.orgUnitId}|${m.sanghaType}|${m.cccd}`, m.id]),
  )) {
    errors.push(`members: same org unit, sangha type and CCCD: ${sample(ids)}`)
  }

  for (const { table, rows } of tables) {
    for (const column of SORT_COLUMNS[table] ?? []) {
      const ids = rows.filter((row) => row[column] == null).map((row) => rowKey(table, row))
      warnings.push(...countWarning(`${table} without ${column} (hidden from lists sorted by it)`, ids))
    }
  }

  const orgUnitIds = new Set(records.orgUnits.map((u) => u.id))
  const memberIds = new Set(records.members.map((m) => m.id))
  const templeIds = new Set(records.temples.map((t) => t.id))
  const retreatIds = new Set(records.retreats.map((r) => r.id))
  warnings.push(
    ...countWarning(
      'members of an unknown org unit',
      records.members.filter((m) => !orgUnitIds.has(m.orgUnitId)).map((m) => m.id),
    ),
    ...countWarning(
      'temples of an unknown org unit',
      records.temples.filter((t) => !orgUnitIds.has(t.orgUnitId)).map((t) => t.id),
    ),
    ...countWarning(
      'audit logs of a deleted record',
      records.auditLogs
        .filter(({ parent }) => !(parent.type === 'members' ? memberIds : templeIds).has(parent.id))
        .map(({ parent, entry }) => `${parent.type}/${parent.id}/${entry.id}`),
    ),
    ...countWarning(
      'registrations of a missing retreat or member',
      records.registrations
        .filter((r) => !retreatIds.has(r.retreatId) || !memberIds.has(r.memberId))
        .map((r) => r.id),
    ),
  )
  return { errors, warnings }
}

function insertStatement(table: ImportTable, row: Record<string, ColumnValue>): string {
  const columns = Object.keys(row)
  // Org units are already seeded by migrations/0002; Firestore's copy wins.
  const insert = table === 'org_units' ? 'INSERT OR REPLACE INTO' : 'INSERT INTO'
  return `${insert} ${table} (${columns.join(', ')}) VALUES (${Object.values(row).map(sqlLiteral).join(', ')});`
}

/**
 * The import as SQL statements. `replace` first deletes every data row, so an
 * import can be re-run on the same database (dry runs); without it an import
 * into a database that already holds a record fails on its primary key.
 */
export function importStatements(tables: TableRows[], options: { replace: boolean }): string[] {
  const deletes = options.replace
    ? DATA_TABLES_DELETE_ORDER.map((table) => `DELETE FROM ${table};`)
    : []
  return [
    ...deletes,
    ...tables.flatMap(({ table, rows }) => rows.map((row) => insertStatement(table, row))),
  ]
}

/** Groups statements into SQL files of at most `maxBytes` each, in order. */
export function chunkStatements(statements: string[], maxBytes: number): string[] {
  const files: string[] = []
  let current: string[] = []
  let currentBytes = 0
  for (const statement of statements) {
    const bytes = statementBytes(statement) + 1
    if (current.length && currentBytes + bytes > maxBytes) {
      files.push(`${current.join('\n')}\n`)
      current = []
      currentBytes = 0
    }
    current.push(statement)
    currentBytes += bytes
  }
  if (current.length) files.push(`${current.join('\n')}\n`)
  return files
}
