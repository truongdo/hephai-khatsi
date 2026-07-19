import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Center,
  Divider,
  Loader,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { safeRedirectPath } from '#/auth/safeRedirect'
import { useAuth } from '#/auth/useAuth'
import { Route } from '#/routes/login'
import { authErrorMessage } from '#/auth/authErrors'
import {
  signInWithEmailPassword,
  signInWithGoogle,
} from '#/repositories/authRepo'

export function LoginPage() {
  const { user, loading } = useAuth()
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: safeRedirectPath(redirect) })
    }
  }, [loading, user, navigate, redirect])

  if (loading || user) {
    return (
      <Center p="xl">
        <Loader aria-label="loading" />
      </Center>
    )
  }

  async function run(action: () => Promise<unknown>) {
    setError(null)
    setPending(true)
    try {
      await action()
      await navigate({ to: safeRedirectPath(redirect) })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void run(() => signInWithEmailPassword(email, password))
  }

  return (
    <Stack maw={400} mx="auto" p="xl" gap="md">
      <Text size="sm" c="dimmed">
        {m.app_title()}
      </Text>
      <Title order={1}>{m.auth_login_title()}</Title>
      {error ? <Alert color="red">{error}</Alert> : null}
      <Button
        fullWidth
        disabled={pending}
        onClick={() => void run(() => signInWithGoogle())}
      >
        {m.auth_login_google()}
      </Button>
      <Divider label={m.auth_login_or()} labelPosition="center" />
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            label={m.auth_login_email()}
            type="email"
            autoComplete="email"
            value={email}
            disabled={pending}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label={m.auth_login_password()}
            autoComplete="current-password"
            value={password}
            disabled={pending}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button fullWidth type="submit" disabled={pending}>
            {m.auth_login_submit()}
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
