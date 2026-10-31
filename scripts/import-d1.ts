import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { exportToRecords } from '../src/worker/dataApi/import/exportFormat'
import {
  checkImport,
  chunkStatements,
  importRows,
  importStatements,
} from '../src/worker/dataApi/import/importSql'
import { d1Target, executeSqlFile, readExport } from './lib/d1Migration'

// Phase 5 of the D1 migration: a Firestore export (export-firestore.ts) as SQL
// files in <export>/sql/, rows built with the Worker's row mappers. The phone
// index collections are not imported: members.phone and temple_manager_phones
// are rebuilt from the records. Refuses to write anything when checkImport
// finds an error.
//
//   pnpm import:d1 --export <dir> [--replace]
//     [--apply --database <name> --remote|--local]
//
// --replace deletes every data row first (re-runnable dry runs; remote only on
// a *-preview database). Without it, an import into a database that already
// holds a record fails.

const MAX_FILE_BYTES = 5 * 1024 * 1024

const { values } = parseArgs({
  options: {
    export: { type: 'string' },
    replace: { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
    database: { type: 'string' },
    remote: { type: 'boolean', default: false },
    local: { type: 'boolean', default: false },
  },
})
if (!values.export) throw new Error('Pass --export <dir>')
if (!values.apply && (values.database || values.remote || values.local)) {
  throw new Error('--database / --remote / --local only apply with --apply')
}
const target = values.apply ? d1Target(values) : null
// A remote --replace wipes the database: only ever on a preview copy, never on
// production (which is imported once, empty, at the cutover).
if (target?.location === '--remote' && values.replace && !target.database.endsWith('-preview')) {
  throw new Error(`Refusing --replace on remote database ${target.database} (only *-preview)`)
}

const records = exportToRecords(readExport(values.export).exported)
const { errors, warnings } = checkImport(records)
for (const warning of warnings) console.warn(`warning: ${warning}`)
if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`)
  console.error('Nothing written: fix the data in Firestore (or the export) and export again.')
  process.exit(1)
}

const tables = importRows(records)
for (const { table, rows } of tables) console.log(`${table}: ${rows.length}`)

const sqlDir = join(values.export, 'sql')
rmSync(sqlDir, { recursive: true, force: true })
mkdirSync(sqlDir)
const files = chunkStatements(importStatements(tables, { replace: values.replace }), MAX_FILE_BYTES).map(
  (sql, i) => {
    const file = join(sqlDir, `${String(i + 1).padStart(4, '0')}.sql`)
    writeFileSync(file, sql)
    return file
  },
)
console.log(`Wrote ${files.length} SQL file(s) to ${sqlDir}`)

if (target) {
  const started = Date.now()
  for (const [i, file] of files.entries()) {
    console.log(`Applying ${file} to ${target.database} (${target.location})`)
    try {
      executeSqlFile(target, file)
    } catch (error) {
      // Each file is applied on its own: the earlier ones stay written.
      console.error(
        `Failed on file ${i + 1} of ${files.length}; files 1–${i} are applied. ` +
          'Empty the database (or re-run with --replace on a preview copy) before importing again.',
      )
      throw error
    }
  }
  console.log(`Imported in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}
