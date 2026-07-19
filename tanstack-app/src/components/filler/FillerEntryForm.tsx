import {
  Alert,
  Button,
  Group,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMemo, useState, type FormEvent } from 'react'
import { filterOrgUnitsForFormType } from '#/components/filler/filterOrgUnitsForFormType'
import { isDomainError } from '#/domain/errors'
import { normalizeCccd, normalizeVnPhone } from '#/domain/normalize'
import type { FormType, OrgUnit } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type FillerEntryFormProps = {
  orgUnits: OrgUnit[]
  pending?: boolean
  templeMatches?: Array<{ id: string; label: string }>
  onSubmit: (payload: {
    formType: FormType
    orgUnitId: string
    cccd: string
    phone: string
  }) => void
  onPickTemple?: (templeId: string) => void
  onCreateTemple?: () => void
  onCreateMember?: () => void
  notFound?: boolean
  error?: string | null
}

type FieldErrors = {
  formType?: string
  orgUnitId?: string
  cccd?: string
  phone?: string
}

function identityFieldError(code: string): string {
  switch (code) {
    case 'CCCD_REQUIRED':
      return 'Nhập CCCD.'
    case 'CCCD_INVALID':
      return 'CCCD phải có 9–12 chữ số.'
    case 'PHONE_INVALID':
      return 'Số điện thoại không hợp lệ.'
    default:
      return m.filler_error_generic()
  }
}

export function FillerEntryForm({
  orgUnits,
  pending = false,
  templeMatches,
  onSubmit,
  onPickTemple,
  onCreateTemple,
  onCreateMember,
  notFound = false,
  error = null,
}: FillerEntryFormProps) {
  const [formType, setFormType] = useState<FormType | ''>('')
  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [cccd, setCccd] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const orgUnitOptions = useMemo(() => {
    if (!formType) return []
    return filterOrgUnitsForFormType(orgUnits, formType).map((unit) => ({
      value: unit.id,
      label: unit.name,
    }))
  }, [formType, orgUnits])

  function handleTypeChange(value: string) {
    setFormType(value as FormType)
    setOrgUnitId(null)
    setFieldErrors((prev) => ({ ...prev, formType: undefined }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: FieldErrors = {}

    if (!formType) {
      nextErrors.formType = m.filler_error_type_required()
    }

    if (!orgUnitId) {
      nextErrors.orgUnitId = m.filler_error_org_required()
    }

    let normalizedCccd = ''
    let normalizedPhone = ''

    if (formType === 'member_tang' || formType === 'member_ni') {
      try {
        normalizedCccd = normalizeCccd(cccd)
      } catch (err) {
        if (isDomainError(err)) {
          nextErrors.cccd = identityFieldError(err.code)
        }
      }
    }

    if (formType === 'temple') {
      try {
        normalizedPhone = normalizeVnPhone(phone)
      } catch (err) {
        if (isDomainError(err)) {
          nextErrors.phone = identityFieldError(err.code)
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    onSubmit({
      formType: formType as FormType,
      orgUnitId: orgUnitId as string,
      cccd: normalizedCccd,
      phone: normalizedPhone,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        <Title order={1}>{m.filler_entry_title()}</Title>

        {error ? <Alert color="red">{error}</Alert> : null}

        <Radio.Group
          label={m.filler_entry_type_label()}
          value={formType}
          onChange={handleTypeChange}
          error={fieldErrors.formType}
        >
          <Group mt="xs">
            <Radio value="member_tang" label={m.filler_type_tang()} />
            <Radio value="member_ni" label={m.filler_type_ni()} />
            <Radio value="temple" label={m.filler_type_temple()} />
          </Group>
        </Radio.Group>

        <Select
          label={m.filler_org_label()}
          placeholder={m.filler_org_placeholder()}
          data={orgUnitOptions}
          value={orgUnitId}
          onChange={setOrgUnitId}
          disabled={!formType}
          searchable
          error={fieldErrors.orgUnitId}
        />

        <Stack gap="xs">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_cccd_label()}
              value={cccd}
              onChange={(event) => setCccd(event.currentTarget.value)}
              error={fieldErrors.cccd}
            />
            <TextInput
              label={m.filler_phone_label()}
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              error={fieldErrors.phone}
            />
          </SimpleGrid>
          <Text size="sm" c="dimmed">
            {m.filler_identity_helper()}
          </Text>
        </Stack>

        <Button type="submit" loading={pending}>
          {m.filler_continue()}
        </Button>

        {notFound ? (
          <Stack gap="sm">
            <Text>{m.filler_identity_not_found()}</Text>
            {onCreateMember ? (
              <Button variant="light" onClick={onCreateMember}>
                {m.filler_identity_create_member()}
              </Button>
            ) : null}
          </Stack>
        ) : null}

        {templeMatches && templeMatches.length > 0 ? (
          <Stack gap="sm">
            <Text fw={600}>{m.filler_identity_pick_temple()}</Text>
            <Group gap="sm">
              {templeMatches.map((match) => (
                <Button
                  key={match.id}
                  variant="light"
                  onClick={() => onPickTemple?.(match.id)}
                >
                  {match.label}
                </Button>
              ))}
            </Group>
            {onCreateTemple ? (
              <Button variant="default" onClick={onCreateTemple}>
                {m.filler_identity_create_temple()}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </form>
  )
}
