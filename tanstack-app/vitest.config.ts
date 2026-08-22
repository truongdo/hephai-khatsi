import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

const integrationExclude = 'src/**/*.integration.test.{ts,tsx}'

/** `.test.ts` files that need DOM APIs (jsdom). Everything else `.ts` runs in node. */
const domUnitTests = [
  'src/hooks/useFormLocalDraft.test.ts',
  'src/components/admin/useAdminListSelection.test.ts',
  'src/lib/scrollToFirstFieldError.test.ts',
  'src/lib/formLocalDraft.test.ts',
  // Firebase web SDK initializes only when `window` exists.
  'src/firebase/firestore.test.ts',
  'src/firebase/storage.test.ts',
]

export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    // Default is cpus-1, which saturates the machine on full suite runs.
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
