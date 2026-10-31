import { describe, expect, it } from 'vitest'
import { fixtureExport } from '../test/exportFixture'
import { exportToRecords, type FirestoreExport } from './exportFormat'
import {
  chunkStatements,
  checkImport,
  importRows,
  importStatements,
  MAX_STATEMENT_BYTES,
} from './importSql'

function records(change?: (exported: FirestoreExport) => void) {
  const exported = fixtureExport()
  change?.(exported)
  return exportToRecords(exported)
}

describe('exportToRecords', () => {
  it('reads documents like the Firestore repositories', () => {
    const exported = fixtureExport()
    delete exported.temples[0]!.data.photoPath
    exported.invites.push({ id: 'old', data: { token: 'old', createdAt: 'x', createdBy: 'y' } })
    const result = exportToRecords(exported)
    expect(result.temples[0]).toMatchObject({ id: 'temple-min', photoPath: null })
    expect(result.invites.at(-1)).toMatchObject({ kind: 'filler', disabled: false, retreatId: null })
    expect(result.auditLogs[0]).toMatchObject({
      parent: { type: 'members', id: 'ni-gd-i_ni_079123456789' },
      entry: { id: 'log-1', action: 'updated' },
    })
  })
})

describe('checkImport', () => {
  it('passes the fixtures', () => {
    expect(checkImport(records()).errors).toEqual([])
  })

  it('refuses an invite whose token is not its id', () => {
    const result = checkImport(records((e) => (e.invites[0]!.data.token = 'other')))
    expect(result.errors).toEqual(['invites: token differs from the document id: public'])
  })

  it('refuses missing required fields and values outside the CHECK constraints', () => {
    const result = checkImport(
      records((e) => {
        delete e.members[0]!.data.createdAt
        e.temples[0]!.data.status = 'archived'
        e.retreats[0]!.data.createdBy = { uid: 'x' }
      }),
    )
    expect(result.errors).toEqual([
      'members: created_at is missing: gd-i_tang_123456789012',
      'temples: status is not one of draft / locked: temple-min',
      'retreats: created_by is not a string or number: retreat-1',
    ])
  })

  it('refuses two members with the same identity', () => {
    const result = checkImport(
      records((e) => e.members.push({ ...e.members[0]!, id: 'moved-copy' })),
    )
    expect(result.errors).toEqual([
      'members: same org unit, sangha type and CCCD: gd-i_tang_123456789012, moved-copy',
    ])
  })

  it('refuses a record over the statement limit', () => {
    const result = checkImport(
      records((e) => (e.members[0]!.data.nguyenQuan = 'x'.repeat(MAX_STATEMENT_BYTES))),
    )
    expect(result.errors).toEqual([
      "records over D1's 100000-byte statement limit: members/gd-i_tang_123456789012",
    ])
  })

  it('warns about orphans and missing sort keys', () => {
    const result = checkImport(
      records((e) => {
        e.retreats = []
        e.auditLogs[0]!.parentId = 'deleted-member'
      }),
    )
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        '1 members without ha_lap_tab_rank (hidden from lists sorted by it): gd-i_tang_123456789012',
        '1 temples without list_city_name (hidden from lists sorted by it): temple-min',
        '1 audit logs of a deleted record: members/deleted-member/log-1',
        '2 registrations of a missing retreat or member: retreat-1_gd-i_tang_123456789012, retreat-1_ni-gd-i_ni_079123456789',
      ]),
    )
  })
})

describe('importStatements', () => {
  const tables = importRows(records())

  it('inserts every row, org units over the seed', () => {
    const statements = importStatements(tables, { replace: false })
    expect(statements).toHaveLength(tables.reduce((n, t) => n + t.rows.length, 0))
    expect(statements[0]).toMatch(/^INSERT OR REPLACE INTO org_units \(/)
    expect(statements.filter((s) => s.startsWith('INSERT INTO temple_manager_phones'))).toHaveLength(3)
  })

  it('escapes quotes and writes NULL', () => {
    const member = importStatements(tables, { replace: false }).find((s) =>
      s.includes("'ni-gd-i_ni_079123456789'"),
    )!
    expect(member).toContain("12 Lê Lợi ''A''")
    const minimal = importStatements(tables, { replace: false }).find((s) =>
      s.startsWith("INSERT INTO members") && s.includes("'gd-i_tang_123456789012'"),
    )!
    expect(minimal).toContain('NULL')
  })

  it('deletes the data rows first with replace', () => {
    const statements = importStatements(tables, { replace: true })
    expect(statements.slice(0, 7)).toEqual([
      'DELETE FROM retreat_registrations;',
      'DELETE FROM retreats;',
      'DELETE FROM audit_logs;',
      'DELETE FROM temple_manager_phones;',
      'DELETE FROM temples;',
      'DELETE FROM members;',
      'DELETE FROM invites;',
    ])
  })
})

describe('chunkStatements', () => {
  it('keeps the order and the size cap', () => {
    const files = chunkStatements(['a;', 'bb;', 'ccc;', 'd;'], 8)
    expect(files).toEqual(['a;\nbb;\n', 'ccc;\nd;\n'])
  })
})
