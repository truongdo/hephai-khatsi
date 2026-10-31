import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearData } from '../test/db'
import { fixtureExport, fixtureManifest } from '../test/exportFixture'
import { exportToRecords } from './exportFormat'
import { checkImport, COLUMN_RULES, importRows, importStatements } from './importSql'
import { verifyImport, type D1Snapshot } from './verifyImport'

const records = exportToRecords(fixtureExport())

async function runImport(replace: boolean): Promise<void> {
  const statements = importStatements(importRows(records), { replace })
  await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)))
}

async function snapshot(): Promise<D1Snapshot> {
  const tables: Array<keyof D1Snapshot> = [
    'org_units',
    'invites',
    'members',
    'temples',
    'temple_manager_phones',
    'audit_logs',
    'retreats',
    'retreat_registrations',
  ]
  const results = await env.DB.batch(tables.map((t) => env.DB.prepare(`SELECT * FROM ${t}`)))
  return Object.fromEntries(tables.map((t, i) => [t, results[i]!.results])) as D1Snapshot
}

describe('Firestore export → D1 import', () => {
  beforeEach(clearData)

  it('reads back every record equal to the export', async () => {
    expect(checkImport(records).errors).toEqual([])
    await runImport(false)
    const report = verifyImport(fixtureManifest(), records, await snapshot())
    expect(report.tables.filter((t) => t.missing.length || t.extra.length || t.different.length)).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('rebuilds the phone lookups from the records', async () => {
    await runImport(false)
    const phones = await env.DB.prepare(
      'SELECT id FROM members WHERE phone = ? UNION ALL SELECT temple_id FROM temple_manager_phones WHERE phone = ?',
    )
      .bind('0912345678', '0912345678')
      .all<{ id: string }>()
    expect(phones.results.map((r) => r.id)).toEqual(['ni-gd-i_ni_079123456789', 'temple-1'])
  })

  it('fails on an existing record unless it replaces', async () => {
    await runImport(false)
    await expect(runImport(false)).rejects.toThrow(/UNIQUE constraint failed/)
    await runImport(true)
    expect(verifyImport(fixtureManifest(), records, await snapshot()).ok).toBe(true)
  })

  it('checks every NOT NULL column of the schema', async () => {
    for (const { table, rows } of importRows(records)) {
      const info = await env.DB.prepare(`SELECT name, "notnull", dflt_value FROM pragma_table_info(?)`)
        .bind(table)
        .all<{ name: string; notnull: number; dflt_value: string | null }>()
      const notNull = info.results
        .filter((column) => column.notnull && column.dflt_value === null)
        .map((column) => column.name)
      // Every column the import writes, and nothing it leaves to a default.
      expect(notNull.filter((column) => !(column in rows[0]!))).toEqual([])
      expect(COLUMN_RULES[table].required).toEqual(expect.arrayContaining(notNull))
    }
  })

  it('reports a record changed after the import', async () => {
    await runImport(false)
    await env.DB.prepare(`UPDATE members SET data = json_set(data, '$.phapDanh', 'X') WHERE id = ?`)
      .bind('ni-gd-i_ni_079123456789')
      .run()
    await env.DB.prepare('DELETE FROM audit_logs WHERE parent_type = ?').bind('temples').run()
    const report = verifyImport(fixtureManifest(), records, await snapshot())
    expect(report.ok).toBe(false)
    expect(report.tables.find((t) => t.table === 'members')?.different).toEqual([
      'ni-gd-i_ni_079123456789',
    ])
    expect(report.tables.find((t) => t.table === 'audit_logs')?.missing).toEqual([
      'temples/temple-1/log-1',
    ])
    expect(report.counts.find((c) => c.what === 'auditLogs')).toEqual({
      what: 'auditLogs',
      firestore: 2,
      exported: 2,
      d1: 1,
    })
  })
})
