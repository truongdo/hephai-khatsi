/// <reference types="@cloudflare/vitest-plugin/types" />

import type { D1Migration } from 'cloudflare:test'
import type { Env as WorkerEnv } from '../../env'

declare global {
  namespace Cloudflare {
    // Bindings of the `worker-d1` Vitest project (vitest.config.ts).
    interface Env extends Pick<WorkerEnv, 'DB' | 'PHOTOS'> {
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
