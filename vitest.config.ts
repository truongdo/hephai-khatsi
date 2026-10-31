import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

/** Vitest runs react-pdf in Node; `?url` must resolve to absolute file paths. */
function woffUrlAsFilePath(): Plugin {
  return {
    name: 'woff-url-as-file-path',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('.woff?url')) return
      const resolved = await this.resolve(source.replace(/\?url$/, ''), importer, {
        ...options,
        skipSelf: true,
      })
      if (!resolved) return
      return `${resolved.id}?url`
    },
    load(id) {
      if (!id.endsWith('.woff?url')) return
      const filePath = id.slice(0, -'?url'.length)
      return `export default ${JSON.stringify(filePath)}`
    },
  }
}

/** Worker tests against a local D1 (Miniflare), run inside workerd. */
const d1Tests = 'src/worker/**/*.d1.test.ts'

/** `.test.ts` files that need DOM APIs (jsdom). Everything else `.ts` runs in node. */
const domUnitTests = [
  'src/hooks/useFormLocalDraft.test.ts',
  'src/components/admin/useAdminListSelection.test.ts',
  'src/lib/scrollToFirstFieldError.test.ts',
  'src/lib/formLocalDraft.test.ts',
]

export default defineConfig({
  plugins: [woffUrlAsFilePath(), viteReact()],
  resolve: { tsconfigPaths: true },
  assetsInclude: ['**/*.woff'],
  test: {
    // Default is cpus-1, which saturates the machine; 20% (2 workers on 10 cores)
    // made the suite ~2x slower.
    maxWorkers: '50%',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
          exclude: [d1Tests, ...domUnitTests],
          // No RTL/jsdom setup for pure unit tests.
          setupFiles: [],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.tsx', ...domUnitTests],
          setupFiles: ['./src/test/setup.ts'],
          // Rendering the full member / temple forms in jsdom takes 4–11 s per
          // test on slower machines; the 5 s default fails them spuriously.
          testTimeout: 30_000,
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            miniflare: {
              // Keep in sync with wrangler.jsonc.
              compatibilityDate: '2026-07-20',
              compatibilityFlags: ['nodejs_compat'],
              d1Databases: ['DB'],
              r2Buckets: ['PHOTOS'],
              bindings: { TEST_MIGRATIONS: await readD1Migrations('migrations') },
            },
          })),
        ],
        resolve: { tsconfigPaths: true },
        test: {
          name: 'worker-d1',
          include: [d1Tests],
          // Each test file gets its own empty D1; this applies the migrations.
          setupFiles: ['./src/worker/dataApi/test/applyMigrations.ts'],
        },
      },
    ],
  },
})
