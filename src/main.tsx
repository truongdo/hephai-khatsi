import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { initSentry, sentryRootErrorHandlers } from './monitoring/sentry'
import { getRouter } from './router'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

const router = getRouter()
initSentry(router)

createRoot(rootElement, sentryRootErrorHandlers).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
