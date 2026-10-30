import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Setup file of the `worker-d1` Vitest project: every test file starts from an
// empty D1, so bring it to the schema in migrations/ (already-applied ones are
// skipped).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
