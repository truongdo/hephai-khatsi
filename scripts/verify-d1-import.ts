import { parseArgs } from 'node:util'
import { exportToRecords } from '../src/worker/dataApi/import/exportFormat'
import { verifyImport, type D1Snapshot } from '../src/worker/dataApi/import/verifyImport'
import { d1Target, queryRows, readExport, type D1Target } from './lib/d1Migration'

// Phase 5 of the D1 migration: a D1 database against the Firestore export it
// was imported from. Every record read back through the row mappers must
// equal its exported document (canonical JSON), and every count must equal
// Firestore's count taken by the export. Exits 1 on any difference.
//
//   pnpm verify:d1-import --export <dir> --database <name> --remote|--local

const PAGE_SIZE = 500
const SHOWN_KEYS = 10

const { values } = parseArgs({
  options: {
    export: { type: 'string' },
    database: { type: 'string' },
    remote: { type: 'boolean', default: false },
    local: { type: 'boolean', default: false },
  },
})
if (!values.export) throw new Error('Pass --export <dir>')
const target = d1Target(values)

/** Every row of a table, paged by rowid (all tables are rowid tables). */
function readTable<T>(d1: D1Target, table: keyof D1Snapshot): T[] {
  const rows: T[] = []
  let after = 0
  for (;;) {
    const page = queryRows<{ _rowid: number } & T>(
      d1,
      `SELECT rowid AS _rowid, * FROM ${table} WHERE rowid > ${after} ORDER BY rowid LIMIT ${PAGE_SIZE}`,
    )
    for (const { _rowid, ...row } of page) rows.push(row as T)
    if (page.length < PAGE_SIZE) return rows
    after = page.at(-1)!._rowid
  }
}

const { exported, manifest } = readExport(values.export)
const records = exportToRecords(exported)
const snapshot: D1Snapshot = {
  org_units: readTable(target, 'org_units'),
  invites: readTable(target, 'invites'),
  members: readTable(target, 'members'),
  temples: readTable(target, 'temples'),
  temple_manager_phones: readTable(target, 'temple_manager_phones'),
  audit_logs: readTable(target, 'audit_logs'),
  retreats: readTable(target, 'retreats'),
  retreat_registrations: readTable(target, 'retreat_registrations'),
}

function keys(label: string, list: string[]): string {
  if (!list.length) return ''
  const shown = list.slice(0, SHOWN_KEYS).join(', ')
  return `\n    ${label}: ${shown}${list.length > SHOWN_KEYS ? ` (+${list.length - SHOWN_KEYS})` : ''}`
}

const report = verifyImport(manifest, records, snapshot)
console.log(`Export of ${manifest.projectId} at ${manifest.exportedAt} vs ${target.database} (${target.location})`)
for (const t of report.tables) {
  const status = t.missing.length || t.extra.length || t.different.length ? 'DIFF' : 'ok'
  console.log(
    `${status.padEnd(4)} ${t.table}: ${t.expected} exported, ${t.actual} in D1` +
      keys('missing in D1', t.missing) +
      keys('only in D1', t.extra) +
      keys('different', t.different),
  )
}
const wrongCounts = report.counts.filter((c) => c.firestore !== c.exported || c.exported !== c.d1)
for (const c of wrongCounts) {
  console.log(`DIFF count ${c.what}: Firestore ${c.firestore}, export ${c.exported}, D1 ${c.d1}`)
}
console.log(`${report.counts.length - wrongCounts.length}/${report.counts.length} counts equal`)
console.log(report.ok ? 'OK: D1 equals the export' : 'FAILED: D1 differs from the export')
process.exit(report.ok ? 0 : 1)
