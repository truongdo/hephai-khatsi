import { auditLogFromRow, type AuditLogRow } from '../rows/auditLog'
import { inviteFromRow, type InviteRow } from '../rows/invite'
import { memberFromRow, type MemberRow } from '../rows/member'
import { orgUnitFromRow, type OrgUnitRow } from '../rows/orgUnit'
import { registrationFromRow, type RegistrationRow } from '../rows/registration'
import { retreatFromRow, type RetreatRow } from '../rows/retreat'
import {
  templeFromRow,
  templeManagerPhoneRows,
  type TempleManagerPhoneRow,
  type TempleRow,
} from '../rows/temple'
import type { ExportManifest, ImportRecords } from './exportFormat'
import type { ImportTable } from './importSql'

/** Every row of the D1 data tables (as `SELECT *` returns them). */
export type D1Snapshot = {
  org_units: OrgUnitRow[]
  invites: InviteRow[]
  members: MemberRow[]
  temples: TempleRow[]
  temple_manager_phones: TempleManagerPhoneRow[]
  audit_logs: AuditLogRow[]
  retreats: RetreatRow[]
  retreat_registrations: RegistrationRow[]
}

export type TableCheck = {
  table: ImportTable
  expected: number
  actual: number
  /** Keys of records in the export but not in D1, in D1 but not in the export, in both but not equal. */
  missing: string[]
  extra: string[]
  different: string[]
}

export type CountCheck = { what: string; firestore: number; exported: number; d1: number }

export type VerifyReport = { tables: TableCheck[]; counts: CountCheck[]; ok: boolean }

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
  )
}

/**
 * JSON with sorted keys. A top-level `null` equals an absent field (NULL
 * columns of optional fields read back as absent, see the row mappers).
 */
export function canonicalJson(record: object): string {
  const present = Object.entries(record).filter(([, value]) => value !== null && value !== undefined)
  return JSON.stringify(sortKeys(Object.fromEntries(present)))
}

function compare(
  table: ImportTable,
  expected: Array<[key: string, record: object]>,
  actual: Array<[key: string, record: object]>,
): TableCheck {
  const expectedByKey = new Map(expected.map(([key, record]) => [key, canonicalJson(record)]))
  const actualByKey = new Map(actual.map(([key, record]) => [key, canonicalJson(record)]))
  const missing: string[] = []
  const different: string[] = []
  for (const [key, json] of expectedByKey) {
    const actualJson = actualByKey.get(key)
    if (actualJson === undefined) missing.push(key)
    else if (actualJson !== json) different.push(key)
  }
  return {
    table,
    expected: expected.length,
    actual: actual.length,
    missing,
    extra: [...actualByKey.keys()].filter((key) => !expectedByKey.has(key)),
    different,
  }
}

function byId<T extends { id: string }>(records: T[]): Array<[string, T]> {
  return records.map((record) => [record.id, record])
}

function phoneKey(row: TempleManagerPhoneRow): string {
  return `${row.org_unit_id}/${row.phone}/${row.temple_id}`
}

function auditKey(parentType: string, parentId: string, id: string): string {
  return `${parentType}/${parentId}/${id}`
}

/** Each exported record against its D1 row read back through the row mapper. */
export function compareTables(records: ImportRecords, d1: D1Snapshot): TableCheck[] {
  const expectedPhones = records.temples.flatMap(templeManagerPhoneRows)
  return [
    compare('org_units', byId(records.orgUnits), byId(d1.org_units.map(orgUnitFromRow))),
    compare('invites', byId(records.invites), byId(d1.invites.map(inviteFromRow))),
    compare('members', byId(records.members), byId(d1.members.map(memberFromRow))),
    compare('temples', byId(records.temples), byId(d1.temples.map(templeFromRow))),
    compare(
      'temple_manager_phones',
      expectedPhones.map((row) => [phoneKey(row), row]),
      d1.temple_manager_phones.map((row) => [phoneKey(row), { ...row }]),
    ),
    compare(
      'audit_logs',
      records.auditLogs.map(({ parent, entry }) => [auditKey(parent.type, parent.id, entry.id), entry]),
      d1.audit_logs.map((row) => [
        auditKey(row.parent_type, row.parent_id, row.id),
        auditLogFromRow(row),
      ]),
    ),
    compare('retreats', byId(records.retreats), byId(d1.retreats.map(retreatFromRow))),
    compare(
      'retreat_registrations',
      byId(records.registrations),
      byId(d1.retreat_registrations.map(registrationFromRow)),
    ),
  ]
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return counts
}

/** Firestore's own counts (taken by the export) against the export and D1. */
export function compareCounts(
  manifest: ExportManifest,
  records: ImportRecords,
  d1: D1Snapshot,
): CountCheck[] {
  const totals: Array<[keyof ExportManifest['counts'], number, number]> = [
    ['orgUnits', records.orgUnits.length, d1.org_units.length],
    ['invites', records.invites.length, d1.invites.length],
    ['members', records.members.length, d1.members.length],
    ['temples', records.temples.length, d1.temples.length],
    ['auditLogs', records.auditLogs.length, d1.audit_logs.length],
    ['retreats', records.retreats.length, d1.retreats.length],
    ['retreatRegistrations', records.registrations.length, d1.retreat_registrations.length],
  ]
  const exportedMembers = countBy(records.members, (m) => `${m.orgUnitId}/${m.sanghaType}`)
  const d1Members = countBy(d1.members, (m) => `${m.org_unit_id}/${m.sangha_type}`)
  const exportedTemples = countBy(records.temples, (t) => t.orgUnitId)
  const d1Temples = countBy(d1.temples, (t) => t.org_unit_id)
  return [
    ...totals.map(([what, exported, d1Count]) => ({
      what,
      firestore: manifest.counts[what],
      exported,
      d1: d1Count,
    })),
    ...manifest.memberCounts.map(({ orgUnitId, sanghaType, count }) => {
      const key = `${orgUnitId}/${sanghaType}`
      return {
        what: `members ${key}`,
        firestore: count,
        exported: exportedMembers.get(key) ?? 0,
        d1: d1Members.get(key) ?? 0,
      }
    }),
    ...manifest.templeCounts.map(({ orgUnitId, count }) => ({
      what: `temples ${orgUnitId}`,
      firestore: count,
      exported: exportedTemples.get(orgUnitId) ?? 0,
      d1: d1Temples.get(orgUnitId) ?? 0,
    })),
  ]
}

/** The import is good only when every record and every count is equal. */
export function verifyImport(
  manifest: ExportManifest,
  records: ImportRecords,
  d1: D1Snapshot,
): VerifyReport {
  const tables = compareTables(records, d1)
  const counts = compareCounts(manifest, records, d1)
  const ok =
    tables.every((t) => !t.missing.length && !t.extra.length && !t.different.length) &&
    counts.every((c) => c.firestore === c.exported && c.exported === c.d1)
  return { tables, counts, ok }
}
