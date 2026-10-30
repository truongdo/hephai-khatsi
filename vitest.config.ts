import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

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

const integrationExclude = 'src/**/*.integration.test.{ts,tsx}'

/** `.test.ts` files that need DOM APIs (jsdom). Everything else `.ts` runs in node. */
const domUnitTests = [
  'src/hooks/useFormLocalDraft.test.ts',
  'src/components/admin/useAdminListSelection.test.ts',
  'src/lib/scrollToFirstFieldError.test.ts',
  'src/lib/formLocalDraft.test.ts',
  // Firebase web SDK initializes only when `window` exists.
  'src/firebase/firestore.test.ts',
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
          exclude: [integrationExclude, ...domUnitTests],
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
          exclude: [integrationExclude],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
})
