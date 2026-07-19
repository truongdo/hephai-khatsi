import { Button, Group, Skeleton, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { useAuth } from '#/auth/useAuth'

export function AppHeader() {
  const { user, loading, signOut } = useAuth()

  return (
    <Group justify="flex-end" p="md" gap="sm" component="header">
      {loading ? (
        <Skeleton data-testid="auth-header-loading" height={28} width={120} />
      ) : user ? (
        <>
          <Text size="sm">
            {user.displayName || user.email || user.uid.slice(0, 8)}
          </Text>
          <Button variant="subtle" onClick={() => void signOut()}>
            {m.auth_logout()}
          </Button>
        </>
      ) : (
        <Button component={Link} to="/login" variant="subtle">
          {m.auth_login_link()}
        </Button>
      )}
    </Group>
  )
}
