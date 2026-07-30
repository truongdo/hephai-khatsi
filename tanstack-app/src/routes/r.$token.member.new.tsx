import { createFileRoute } from '@tanstack/react-router'
import { Group, Radio, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { MemberEditorForm } from '#/components/filler/MemberEditorForm'
import { useRegistrationRouteContext } from '#/components/registration/registrationRouteContext'
import type { SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/r/$token/member/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: typeof search.phone === 'string' ? search.phone : '',
  }),
  component: RegistrationMemberNewRoute,
})

function RegistrationMemberNewRoute() {
  const { token, invite } = useRegistrationRouteContext()
  const { phone } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [sanghaType, setSanghaType] = useState<SanghaType | ''>('')

  return (
    <Stack gap="lg">
      <Radio.Group
        label={m.registration_member_new_sangha_label()}
        description={m.registration_member_new_sangha_hint()}
        value={sanghaType}
        onChange={(value) => setSanghaType(value as SanghaType)}
      >
        <Group mt="xs">
          <Radio value="tang" label={m.filler_type_tang()} />
          <Radio value="ni" label={m.filler_type_ni()} />
        </Group>
      </Radio.Group>

      {!sanghaType ? (
        <Text c="dimmed" size="sm">
          {m.registration_error_sangha_required()}
        </Text>
      ) : (
        <MemberEditorForm
          key={`new-${invite.orgUnitId}-${sanghaType}-${phone}`}
          title={m.registration_member_new_title()}
          token={token}
          orgUnitId={invite.orgUnitId!}
          sanghaType={sanghaType}
          seedPhone={phone}
          status="draft"
          onCreated={(memberId) =>
            navigate({
              to: '/r/$token/register/$memberId',
              params: { token, memberId },
            })
          }
        />
      )}
    </Stack>
  )
}
