// Which database the client repositories use: Firestore (today) or D1
// through the Worker's /api/data routes (after the cutover, see
// docs/superpowers/plans/2026-10-30-firestore-to-d1-migration.md). The
// Worker's own `DATA_BACKEND` var must match.

export type DataBackend = 'firestore' | 'd1'

/** Anything but `d1` keeps Firestore, so a missing or mistyped value is safe. */
export function parseDataBackend(value: string | undefined): DataBackend {
  return value === 'd1' ? 'd1' : 'firestore'
}

// `?.`: scripts run under node, where `import.meta.env` does not exist.
export const DATA_BACKEND: DataBackend = parseDataBackend(import.meta.env?.VITE_DATA_BACKEND)
