import {
  Alert,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { isDomainError } from '#/domain/errors'
import { normalizeVnPhone } from '#/domain/normalize'
import { m } from '#/paraglide/messages'

export type RetreatRegistrationEntryProps = {
  retreatName: string
  orgUnitName: string
  pending?: boolean
  memberMatches?: Array<{ id: string; label: string }>
  error?: string | null
  onSubmit: (payload: { phone: string }) => void
  onPickMember?: (memberId: string) => void
  onCreateMember?: () => void
}

type FieldErrors = {
  phone?: string
}

function phoneFieldError(code: string): string {
  switch (code) {
    case 'PHONE_INVALID':
      return 'Số điện thoại không hợp lệ.'
    default:
      return m.registration_error_generic()
  }
}

export function RetreatRegistrationEntry({
  retreatName,
  orgUnitName,
  pending = false,
  memberMatches,
  error = null,
  onSubmit,
  onPickMember,
  onCreateMember,
}: RetreatRegistrationEntryProps) {
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: FieldErrors = {}

    let normalizedPhone = ''
    try {
      normalizedPhone = normalizeVnPhone(phone)
    } catch (err) {
      if (isDomainError(err)) {
        nextErrors.phone = phoneFieldError(err.code)
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    onSubmit({ phone: normalizedPhone })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        <Title order={1}>{m.registration_entry_title()}</Title>
        <Text fw={600}>{retreatName}</Text>

        {error ? <Alert color="red">{error}</Alert> : null}

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {m.filler_org_label()}
          </Text>
          <Text>{orgUnitName}</Text>
        </Stack>

        <TextInput
          label={m.filler_phone_label()}
          description={m.filler_phone_description_member()}
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
          error={fieldErrors.phone}
        />

        <Button type="submit" loading={pending}>
          {m.filler_continue()}
        </Button>

        {memberMatches && memberMatches.length > 0 ? (
          <Stack gap="sm">
            <Text fw={600}>{m.filler_identity_pick_member()}</Text>
            <Group gap="sm">
              {memberMatches.map((match) => (
                <Button
                  key={match.id}
                  variant="light"
                  onClick={() => onPickMember?.(match.id)}
                >
                  {match.label}
                </Button>
              ))}
            </Group>
            {onCreateMember ? (
              <Button variant="default" onClick={onCreateMember}>
                {m.filler_identity_create_member()}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </form>
  )
}
