import { Alert, Button, Stack, Text, TextInput, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { isDomainError } from '#/domain/errors'
import type { Retreat } from '#/domain/retreat'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { createRetreatRegistration } from '#/use-cases/createRetreatRegistration'

export type RetreatRegistrationConfirmProps = {
  retreat: Retreat
  member: Member
}

function memberSummaryLabel(member: Member): string {
  const parts = [member.phapDanh, member.theDanh].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : member.id
}

function registrationErrorMessage(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'ALREADY_EXISTS':
        return m.registration_error_duplicate()
      case 'INVALID_STATUS':
        return m.registration_gate_closed()
      case 'INVALID_INPUT':
        if (err.message.includes('window')) return m.registration_gate_window()
        if (err.message.includes('Self registration')) return m.registration_gate_quyen()
        return m.registration_error_generic()
      default:
        return m.registration_error_generic()
    }
  }
  return m.registration_error_generic()
}

export function RetreatRegistrationConfirm({
  retreat,
  member,
}: RetreatRegistrationConfirmProps) {
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const field of retreat.extraFields) {
      initial[field.key] = ''
    }
    setExtraAnswers(initial)
  }, [retreat.extraFields])

  const registerMutation = useMutation({
    mutationFn: () =>
      createRetreatRegistration({
        claims: null,
        retreatId: retreat.id,
        memberId: member.id,
        registeredVia: 'self',
        registeredBy: null,
        extraAnswers,
      }),
    onSuccess: () => {
      setSubmitted(true)
    },
  })

  if (submitted) {
    return (
      <Alert color="teal" title={m.registration_success_title()}>
        <Text>{m.registration_success_body()}</Text>
      </Alert>
    )
  }

  return (
    <Stack gap="lg">
      <Title order={1}>{m.registration_confirm_title()}</Title>

      <Stack gap="xs">
        <Text fw={600}>{m.registration_confirm_member_section()}</Text>
        <Text>{memberSummaryLabel(member)}</Text>
        <Text size="sm" c="dimmed">
          {member.dienThoai}
        </Text>
      </Stack>

      {retreat.extraFields.map((field) => (
        <TextInput
          key={field.key}
          label={field.label}
          required={field.required}
          value={extraAnswers[field.key] ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value
            setExtraAnswers((prev) => ({
              ...prev,
              [field.key]: value,
            }))
          }}
        />
      ))}

      {registerMutation.isError && (
        <Alert color="red" role="alert">
          {registrationErrorMessage(registerMutation.error)}
        </Alert>
      )}

      <Button
        loading={registerMutation.isPending}
        onClick={() => registerMutation.mutate()}
      >
        {m.registration_submit()}
      </Button>
    </Stack>
  )
}
