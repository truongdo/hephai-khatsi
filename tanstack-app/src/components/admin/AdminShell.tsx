import type { ReactNode } from 'react'
import {
  Anchor,
  AppShell,
  Box,
  Breadcrumbs,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, useRouterState } from '@tanstack/react-router'
import { BarChart3, CalendarDays, Home, List, LogOut } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { useAuth } from '#/auth/useAuth'
import { canManageDirectory, canManageRetreats } from '#/domain/authClaims'
import { DharmaWheel } from '#/components/icons/DharmaWheel'
import { AdminCopyFormLinkButton } from './AdminCopyFormLinkButton'
import { AdminDirectorySearch } from './AdminDirectorySearch'
import { AdminNotificationsButton } from './AdminNotificationsButton'
import { buildAdminBreadcrumbs } from './adminBreadcrumbs'

type NavCapability = 'directory' | 'retreats'

const allNavItems: {
  label: () => string
  to: string
  icon: typeof Home
  capability: NavCapability
}[] = [
  {
    label: () => m.admin_nav_temples(),
    to: '/admin/temples',
    icon: Home,
    capability: 'directory',
  },
  {
    label: () => m.admin_nav_tang(),
    to: '/admin/members/tang',
    icon: DharmaWheel,
    capability: 'directory',
  },
  {
    label: () => m.admin_nav_ni(),
    to: '/admin/members/ni',
    icon: DharmaWheel,
    capability: 'directory',
  },
  {
    label: () => m.admin_nav_member_stats(),
    to: '/admin/members/stats',
    icon: BarChart3,
    capability: 'directory',
  },
  {
    label: () => m.admin_nav_org_units(),
    to: '/admin/org-units',
    icon: List,
    capability: 'directory',
  },
  {
    label: () => m.admin_nav_retreats(),
    to: '/admin/retreats',
    icon: CalendarDays,
    capability: 'retreats',
  },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure()
  const claim = useAdminClaim()
  const { signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const crumbs = buildAdminBreadcrumbs(pathname)

  const claims =
    claim.status === 'admin'
      ? { role: claim.role, orgUnitId: claim.orgUnitId }
      : null

  const navItems = allNavItems.filter((item) => {
    if (!claims) return false
    if (item.capability === 'directory') return canManageDirectory(claims)
    if (item.capability === 'retreats') return canManageRetreats(claims)
    return false
  })

  const showDirectorySearch =
    claims != null && canManageDirectory(claims)

  return (
    <AppShell
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      header={{ height: 56 }}
      layout="alt"
      padding="md"
    >
      <AppShell.Navbar style={{ backgroundColor: 'var(--ink-teal)', border: 'none' }}>
        <Stack gap={0} h="100%">
          <Group gap="sm" p="lg" wrap="nowrap">
            <Box
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: '50%',
                border: '1.5px solid var(--saffron-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <img
                src="/mylogo.svg"
                alt=""
                width={36}
                height={36}
                style={{ objectFit: 'contain', display: 'block' }}
              />
            </Box>
            <div>
              <Text
                fw={700}
                c="white"
                style={{ fontFamily: 'var(--font-display)', lineHeight: 1.2 }}
              >
                {m.app_title()}
              </Text>
              <Text size="xs" c="rgba(255, 255, 255, 0.6)">
                {m.admin_title()}
              </Text>
            </div>
          </Group>
          <Divider color="rgba(255, 255, 255, 0.08)" />
          <ScrollArea flex={1} p="md">
            <Stack gap={4}>
              {navItems.map((item) => {
                const active =
                  pathname === item.to || pathname.startsWith(`${item.to}/`)
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    component={Link}
                    to={item.to}
                    label={item.label()}
                    leftSection={<Icon size={18} />}
                    active={active}
                    variant="filled"
                    color="teal.7"
                    className="admin-nav-link"
                    onClick={closeMobile}
                    styles={{
                      root: {
                        borderRadius: 'var(--mantine-radius-md)',
                        color: active ? 'white' : 'rgba(255, 255, 255, 0.75)',
                        borderLeft: `3px solid ${active ? 'var(--saffron)' : 'transparent'}`,
                        paddingLeft: 'calc(var(--mantine-spacing-sm) - 3px)',
                      },
                      label: { fontWeight: active ? 600 : 500 },
                    }}
                  />
                )
              })}
            </Stack>
          </ScrollArea>
          <Divider color="rgba(255, 255, 255, 0.08)" />
          <Group p="md">
            <Button
              variant="subtle"
              leftSection={<LogOut size={16} />}
              onClick={() => void signOut()}
              styles={{ root: { color: 'rgba(255, 255, 255, 0.75)' } }}
            >
              {m.admin_sign_out()}
            </Button>
          </Group>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Header
        px="md"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <Group justify="space-between" w="100%" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label={m.admin_nav_menu_aria()}
              aria-expanded={mobileOpened}
            />
            <Breadcrumbs
              separator="›"
              style={{ minWidth: 0, overflow: 'hidden' }}
            >
            {crumbs.map((crumb, index, all) => {
              const isLast = index === all.length - 1
              if (!isLast && crumb.href) {
                return (
                  <Anchor
                    key={`${crumb.href}-${crumb.title}`}
                    component={Link}
                    to={crumb.href}
                    size="sm"
                    c="dimmed"
                    underline="hover"
                  >
                    {crumb.title}
                  </Anchor>
                )
              }
              return (
                <Text
                  key={`${crumb.title}-${index}`}
                  size="sm"
                  fw={isLast ? 600 : 400}
                >
                  {crumb.title}
                </Text>
              )
            })}
            </Breadcrumbs>
          </Group>
          <Group gap="sm" wrap="nowrap">
            {showDirectorySearch ? <AdminDirectorySearch /> : null}
            <AdminCopyFormLinkButton />
            <AdminNotificationsButton />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
