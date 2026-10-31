import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUDIT_LOGS_FILE,
  EXPORTED_COLLECTIONS,
  type ExportFile,
  type ExportManifest,
  type FirestoreExport,
} from '../../src/worker/dataApi/import/exportFormat'

// Shared by the phase 5 scripts of the D1 migration (export-firestore,
// import-d1, verify-d1-import).

/** Where the export script writes by default; git-ignored. */
export const EXPORT_ROOT = '.d1-migration'

export const MANIFEST_FILE = 'manifest.json'

export function ndjsonPath(dir: string, file: ExportFile): string {
  return join(dir, `${file}.ndjson`)
}

function readNdjson<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T)
}

export function readExport(dir: string): { exported: FirestoreExport; manifest: ExportManifest } {
  const collections = Object.fromEntries(
    EXPORTED_COLLECTIONS.map((collection) => [collection, readNdjson(ndjsonPath(dir, collection))]),
  ) as Omit<FirestoreExport, 'auditLogs'>
  return {
    exported: { ...collections, auditLogs: readNdjson(ndjsonPath(dir, AUDIT_LOGS_FILE)) },
    manifest: JSON.parse(readFileSync(join(dir, MANIFEST_FILE), 'utf8')) as ExportManifest,
  }
}

/** A D1 database for wrangler: its name and `--remote` or `--local`. */
export type D1Target = { database: string; location: '--remote' | '--local' }

/**
 * The database is always named on the command line (no default), so a dry
 * run cannot hit production by accident.
 */
export function d1Target(values: { database?: string; remote?: boolean; local?: boolean }): D1Target {
  if (!values.database) throw new Error('Pass --database <name> (e.g. hephai-khatsi-preview)')
  if (values.remote === values.local) throw new Error('Pass exactly one of --remote or --local')
  return { database: values.database, location: values.remote ? '--remote' : '--local' }
}

const WRANGLER = ['exec', 'wrangler', 'd1', 'execute']

export function executeSqlFile(target: D1Target, file: string): void {
  execFileSync('pnpm', [...WRANGLER, target.database, target.location, '--yes', '--file', file], {
    stdio: 'inherit',
  })
}

/** Rows of one read-only query (`wrangler d1 execute --json`). */
export function queryRows<T>(target: D1Target, sql: string): T[] {
  const output = execFileSync(
    'pnpm',
    [...WRANGLER, target.database, target.location, '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
  )
  const [result] = JSON.parse(output) as Array<{ results?: T[] }>
  if (!result?.results) throw new Error(`Unexpected wrangler output for: ${sql}`)
  return result.results
}
