import { useState } from 'react'
import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'

import '@mantine/core/styles.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-500.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/noto-serif/vietnamese-600.css'
import '@fontsource/noto-serif/vietnamese-700.css'
import '@fontsource/noto-serif/latin-600.css'
import '@fontsource/noto-serif/latin-700.css'
import '../styles.css'
import { AuthProvider } from '#/auth/AuthProvider'
import { AppHeader } from '#/components/AppHeader'
import { createAppQueryClient } from '#/query/queryClient'
import { theme } from '../theme'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [queryClient] = useState(() => createAppQueryClient())
  const showAppHeader = useRouterState({
    select: (s) => shouldShowAppHeader(s.location.pathname),
  })

  return (
    <MantineProvider theme={theme} defaultColorScheme="light" deduplicateInlineStyles>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {showAppHeader ? <AppHeader /> : null}
          <Outlet />
        </AuthProvider>
      </QueryClientProvider>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </MantineProvider>
  )
}

export function shouldShowAppHeader(pathname: string): boolean {
  return !pathname.startsWith('/admin') && !pathname.startsWith('/f/')
}
