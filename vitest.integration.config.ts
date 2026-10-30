import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    // Keep emulator/integration runs from hogging the machine.
    maxWorkers: '50%',
    include: ['src/**/*.integration.test.{ts,tsx}'],
  },
})
