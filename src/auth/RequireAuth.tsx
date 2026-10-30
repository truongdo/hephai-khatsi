import { useEffect, useRef, type ReactNode } from 'react'
import { Center, Loader } from '@mantine/core'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '#/auth/useAuth'

/** Paths that do not require a signed-in Firebase user. */
export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/f/') ||
    pathname.startsWith('/r/')
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const publicPath = isPublicAuthPath(location.pathname)
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (user) {
      redirectedRef.current = false
      return
    }
    if (loading || publicPath || redirectedRef.current) return
    redirectedRef.current = true
    const path = `${location.pathname}${location.searchStr}`
    const redirect = path === '/' ? undefined : path
    void navigate({
      to: '/login',
      search: redirect ? { redirect } : {},
      replace: true,
    })
  }, [
    user,
    loading,
    publicPath,
    location.pathname,
    location.searchStr,
    navigate,
  ])

  if (!publicPath && (loading || !user)) {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }

  return children
}
