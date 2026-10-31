import { describe, expect, it } from 'vitest'
import { fixtureExport, fixtureManifest } from '../test/exportFixture'
import { exportToRecords } from './exportFormat'
import { importRows } from './importSql'
import { canonicalJson, verifyImport, type D1Snapshot } from './verifyImport'

const records = exportToRecords(fixtureExport())

/** The rows a correct import leaves in D1 (`version` defaults to 1). */
function importedSnapshot(): D1Snapshot {
  const versioned = new Set(['members', 'temples', 'retreats', 'retreat_registrations'])
  return Object.fromEntries(
    importRows(records).map(({ table, rows }) => [
      table,
      versioned.has(table) ? rows.map((row) => ({ ...row, version: 1 })) : rows,
    ]),
  ) as D1Snapshot
}

describe('canonicalJson', () => {
  it('ignores key order and top-level nulls only', () => {
    expect(canonicalJson({ b: 1, a: { d: null, c: 2 }, e: null })).toBe('{"a":{"c":2,"d":null},"b":1}')
  })
})

describe('verifyImport', () => {
  it('passes a correct import', () => {
    expect(verifyImport(fixtureManifest(), records, importedSnapshot()).ok).toBe(true)
  })

  it('fails when Firestore counted more than the export holds', () => {
    const manifest = fixtureManifest()
    manifest.memberCounts[0]!.count = 2
    const report = verifyImport(manifest, records, importedSnapshot())
    expect(report.ok).toBe(false)
    expect(report.counts.find((c) => c.what === 'members gd-i/tang')).toEqual({
      what: 'members gd-i/tang',
      firestore: 2,
      exported: 1,
      d1: 1,
    })
  })

  it('fails on a derived column the record does not show', () => {
    const snapshot = importedSnapshot()
    snapshot.members = snapshot.members.map((row) => ({ ...row, phone: null }))
    const report = verifyImport(fixtureManifest(), records, snapshot)
    expect(report.tables.find((t) => t.table === 'members')?.different).toEqual([
      'ni-gd-i_ni_079123456789',
    ])
  })

  it('fails on a row only in D1', () => {
    const snapshot = importedSnapshot()
    snapshot.invites = [...snapshot.invites, { ...snapshot.invites[0]!, id: 'extra' }]
    const report = verifyImport(fixtureManifest(), records, snapshot)
    expect(report.tables.find((t) => t.table === 'invites')?.extra).toEqual(['extra'])
    expect(report.ok).toBe(false)
  })
})
