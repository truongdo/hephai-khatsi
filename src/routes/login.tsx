import { createFileRoute } from '@tanstack/react-router'
import { safeRedirectPath } from '#/auth/safeRedirect'
import { LoginPage } from '#/components/LoginPage'

function parseRedirect(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const safe = safeRedirectPath(raw, '')
  if (safe === '' || safe === '/') return undefined
  return safe
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: parseRedirect(search.redirect),
  }),
  component: LoginPage,
})
