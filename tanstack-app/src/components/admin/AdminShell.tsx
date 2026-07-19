import type { ReactNode } from 'react'
import {
  AppShell,
  Box,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { Link, useRouterState } from '@tanstack/react-router'
import { Home, Link2, List, LogOut } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { useAuth } from '#/auth/useAuth'
import { DharmaWheel } from '#/components/icons/DharmaWheel'

const navItems = [
  { label: () => m.admin_nav_invites(), to: '/admin/invites', icon: Link2 },
  { label: () => m.admin_nav_temples(), to: '/admin/temples', icon: Home },
  { label: () => m.admin_nav_tang(), to: '/admin/members/tang', icon: DharmaWheel },
  { label: () => m.admin_nav_ni(), to: '/admin/members/ni', icon: DharmaWheel },
  { label: () => m.admin_nav_org_units(), to: '/admin/org-units', icon: List },
] as const

export function AdminShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <AppShell navbar={{ width: 260, breakpoint: 'sm' }} padding="md">
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
              }}
            >
              <DharmaWheel size={22} color="var(--saffron-light)" />
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
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
