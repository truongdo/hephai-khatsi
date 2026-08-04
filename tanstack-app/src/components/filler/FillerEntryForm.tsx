import {
  Alert,
  Button,
  Group,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useMemo, useState, type FormEvent } from 'react'
import { filterOrgUnitsForFormType } from '#/components/filler/filterOrgUnitsForFormType'
import { isDomainError } from '#/domain/errors'
import { memberIdentityMatches } from '#/domain/memberIdentityMatches'
import { normalizeVnPhone } from '#/domain/normalize'
import type { FormType, OrgUnit } from '#/domain/types'
import { m } from '#/paraglide/messages'

export type FillerEntryMatchedMember = {
  id: string
  cccd: string
  ngaySinh?: string
}

export type FillerEntryFormProps = {
  orgUnits: OrgUnit[]
  pending?: boolean
  templeMatches?: Array<{ id: string; label: string }>
  memberMatches?: Array<{ id: string; label: string }>
  matchedMember?: FillerEntryMatchedMember | null
  onSubmit: (payload: {
    formType: FormType
    orgUnitId: string
    phone: string
  }) => void
  onPickTemple?: (templeId: string) => void
  onPickMember?: (memberId: string) => void
  onConfirmMatch?: (memberId: string) => void
  onClearMatch?: () => void
  onCreateTemple?: () => void
  onCreateMember?: () => void
  notFound?: boolean
  error?: string | null
}

type FieldErrors = {
  formType?: string
  orgUnitId?: string
  phone?: string
}

function identityFieldError(code: string): string {
  switch (code) {
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
  memberMatches,
  matchedMember,
  onSubmit,
  onPickTemple,
  onPickMember,
  onConfirmMatch,
  onClearMatch,
  onCreateTemple,
  onCreateMember,
  notFound = false,
  error = null,
}: FillerEntryFormProps) {
  const [formType, setFormType] = useState<FormType | ''>('')
  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [challengeCccd, setChallengeCccd] = useState('')
  const [challengeNgaySinh, setChallengeNgaySinh] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const inChallenge = Boolean(matchedMember) && formType !== 'temple'
  const verified =
    inChallenge && matchedMember
      ? memberIdentityMatches(matchedMember, {
          cccd: challengeCccd,
          ngaySinh: challengeNgaySinh,
        })
      : false
  const showIdentityError =
    inChallenge &&
    challengeCccd.trim() !== '' &&
    challengeNgaySinh.trim() !== '' &&
    !verified

  function handleChallengeContextChange() {
    if (matchedMember) {
      setChallengeCccd('')
      setChallengeNgaySinh('')
      onClearMatch?.()
    }
  }

  const orgUnitOptions = useMemo(() => {
    if (!formType) return []
    return filterOrgUnitsForFormType(orgUnits, formType).map((unit) => ({
      value: unit.id,
      label: unit.name,
    }))
  }, [formType, orgUnits])

  const phoneDescription =
    formType === 'temple'
      ? m.filler_phone_description_temple()
      : formType === 'member_tang' || formType === 'member_ni'
        ? m.filler_phone_description_member()
        : undefined

  function handleTypeChange(value: string) {
    handleChallengeContextChange()
    setFormType(value as FormType)
    setOrgUnitId(null)
    setFieldErrors((prev) => ({ ...prev, formType: undefined }))
  }

  function handleOrgUnitChange(value: string | null) {
    handleChallengeContextChange()
    setOrgUnitId(value)
  }

  function handlePhoneChange(value: string) {
    handleChallengeContextChange()
    setPhone(value)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (inChallenge && verified && matchedMember) {
      onConfirmMatch?.(matchedMember.id)
      return
    }
    const nextErrors: FieldErrors = {}

    if (!formType) {
      nextErrors.formType = m.filler_error_type_required()
    }

    if (!orgUnitId) {
      nextErrors.orgUnitId = m.filler_error_org_required()
    }

    let normalizedPhone = ''

    if (formType) {
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
          onChange={handleOrgUnitChange}
          disabled={!formType}
          searchable
          maxDropdownHeight={400}
          error={fieldErrors.orgUnitId}
        />

        <TextInput
          label={m.filler_phone_label()}
          description={phoneDescription}
          value={phone}
          onChange={(event) => handlePhoneChange(event.currentTarget.value)}
          error={fieldErrors.phone}
        />

        {inChallenge ? (
          <Stack gap="sm">
            <TextInput
              label={m.filler_field_cccd()}
              placeholder={m.filler_ph_cccd()}
              value={challengeCccd}
              onChange={(event) => setChallengeCccd(event.currentTarget.value)}
            />
            <DateInput
              label={m.filler_field_ngay_sinh()}
              valueFormat="YYYY-MM-DD"
              clearable
              value={challengeNgaySinh || null}
              onChange={(value) => setChallengeNgaySinh(value ?? '')}
            />
            {showIdentityError ? (
              <Alert color="red">{m.filler_error_identity_mismatch()}</Alert>
            ) : null}
          </Stack>
        ) : null}

        <Button type="submit" loading={pending} disabled={pending || (inChallenge && !verified)}>
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
