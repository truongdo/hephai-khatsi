import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$token/edit/temple')({
  component: TempleEditLayoutRoute,
})

function TempleEditLayoutRoute() {
  return <Outlet />
}
