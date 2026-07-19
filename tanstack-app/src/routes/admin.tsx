import { useEffect, useRef } from 'react'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { Center, Loader } from '@mantine/core'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminShell } from '#/components/admin/AdminShell'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const claim = useAdminClaim()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (claim.status !== 'signed_out' || redirectedRef.current) return
    redirectedRef.current = true
    const redirect = `${location.pathname}${location.searchStr}`
    void navigate({ to: '/login', search: { redirect }, replace: true })
  }, [claim.status, location.pathname, location.searchStr, navigate])

  if (claim.status === 'loading' || claim.status === 'signed_out') {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }
  if (claim.status === 'denied') return <AdminDenied />
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
