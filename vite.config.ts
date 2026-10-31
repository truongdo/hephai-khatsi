import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const config = defineConfig(({ mode }) => {
  // Non-VITE_ vars (SENTRY_*) are read here only, never exposed to the client.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // Source maps are built only when they can be uploaded to Sentry, and are
  // deleted from dist/ afterwards so `wrangler deploy` never publishes them.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_PROJECT)

  return {
    resolve: { tsconfigPaths: true },
    build: {
      sourcemap: uploadSourceMaps ? 'hidden' : false,
    },
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
    plugins: [
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['baseLocale'],
        emitTsDeclarations: true,
      }),
      devtools(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
      uploadSourceMaps
        ? sentryVitePlugin({
            org: env.SENTRY_ORG || 'he-phai-khat-si',
            project: env.SENTRY_PROJECT,
            authToken: env.SENTRY_AUTH_TOKEN,
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            telemetry: false,
          })
        : null,
    ],
  }
})

export default config
