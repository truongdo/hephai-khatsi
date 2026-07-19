import { createFileRoute } from '@tanstack/react-router'
import { safeRedirectPath } from '#/auth/safeRedirect'
import { LoginPage } from '#/components/LoginPage'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirectPath(search.redirect),
  }),
  component: LoginPage,
})
