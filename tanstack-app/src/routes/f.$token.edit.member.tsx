import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$token/edit/member')({
  component: MemberEditLayoutRoute,
})

function MemberEditLayoutRoute() {
  return <Outlet />
}
