import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  Radio,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { useAdminClaim } from '#/auth/useAdminClaim'
import { AdminDenied } from '#/components/admin/AdminDenied'
import { AdminDataTable } from '#/components/admin/AdminDataTable'
import { CopyRetreatRegistrationLinkButton } from '#/components/admin/CopyRetreatRegistrationLinkButton'
import { emptyCell } from '#/components/admin/emptyCell'
import { QueryErrorAlert } from '#/components/admin/QueryErrorAlert'
import { useAdminListSelection } from '#/components/admin/useAdminListSelection'
import { canManageRetreats } from '#/domain/authClaims'
import { isoToGmt7Date } from '#/domain/gmt7Date'
import type {
  RegistrationStatus,
  RegisteredVia,
  RetreatRegistration,
} from '#/domain/retreatRegistration'
import { adminKeys } from '#/query/adminKeys'
import {
  memberQuery,
  retreatQuery,
  retreatRegistrationsQuery,
} from '#/query/adminQueries'
import { createRetreatRegistration } from '#/use-cases/createRetreatRegistration'
import { ensureRetreatRegistrationInvite } from '#/use-cases/ensureRetreatRegistrationInvite'
import { resumeMemberByPhone } from '#/use-cases/resumeMemberByPhone'
import { reviewRetreatRegistrations } from '#/use-cases/reviewRetreatRegistrations'

const REGISTRATION_STATUS_COLOR: Record<RegistrationStatus, string> = {
  pending: 'jade',
  approved: 'teal',
  rejected: 'clay',
}

function registrationStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case 'pending':
      return m.admin_retreat_registrations_status_pending()
    case 'approved':
      return m.admin_retreat_registrations_status_approved()
    case 'rejected':
      return m.admin_retreat_registrations_status_rejected()
  }
}

function registeredViaLabel(via: RegisteredVia): string {
  return via === 'self'
    ? m.admin_retreat_registrations_registered_via_self()
    : m.admin_retreat_registrations_registered_via_proxy()
}

function formatGmt7Date(iso: string): string {
  const ymd = isoToGmt7Date(iso)
  if (!ymd) return ''
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

function truncateReason(reason: string, maxLen = 60): string {
  if (reason.length <= maxLen) return reason
  return `${reason.slice(0, maxLen)}…`
}

function memberDisplayLabel(member: {
  phapDanh: string
  theDanh: string
  id: string
}): string {
  const parts = [member.phapDanh, member.theDanh].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : member.id
}

function RegistrationMemberCell({ memberId }: { memberId: string }) {
  const member = useQuery(memberQuery(memberId))
  if (member.isPending) return <Text size="sm">{memberId}</Text>
  if (member.isError || !member.data) {
    return <Text size="sm">{memberId}</Text>
  }
  return (
    <Text
      component={Link}
      to="/admin/members/$id"
      params={{ id: memberId }}
      size="sm"
      c="teal.7"
      fw={600}
    >
      {memberDisplayLabel(member.data)}
    </Text>
  )
}

export function RetreatRegistrationsPage({ retreatId }: { retreatId: string }) {
  const claim = useAdminClaim()
  const queryClient = useQueryClient()

  const manageRetreats =
    claim.status === 'admin' &&
    canManageRetreats({ role: claim.role, orgUnitId: claim.orgUnitId })

  const claims =
    claim.status === 'admin'
      ? { role: claim.role, orgUnitId: claim.orgUnitId }
      : null

  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<RetreatRegistration[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const lastAppendedKeyRef = useRef<string | null>(null)

  const [phone, setPhone] = useState('')
  const [memberMatches, setMemberMatches] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({})
  const [proxyError, setProxyError] = useState<string | null>(null)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionIds, setActionIds] = useState<string[]>([])

  const retreat = useQuery({
    ...retreatQuery(retreatId),
    enabled: manageRetreats,
  })

  const registrations = useQuery({
    ...retreatRegistrationsQuery(retreatId),
    enabled: manageRetreats,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    setCursor(undefined)
    setAllItems([])
    setNextCursor(null)
    lastAppendedKeyRef.current = null
  }, [retreatId])

  useEffect(() => {
    if (!registrations.data) return
    const appendKey = `${cursor ?? 'start'}:${registrations.dataUpdatedAt}`
    if (lastAppendedKeyRef.current === appendKey) return
    lastAppendedKeyRef.current = appendKey
    if (cursor) {
      setAllItems((prev) => [...prev, ...registrations.data.items])
    } else {
      setAllItems(registrations.data.items)
    }
    setNextCursor(registrations.data.nextCursor)
  }, [registrations.data, registrations.dataUpdatedAt, cursor])

  const itemIds = useMemo(() => allItems.map((r) => r.id), [allItems])
  const selection = useAdminListSelection(itemIds)

  const allSelectedPending = useMemo(() => {
    if (selection.selectedCount === 0) return false
    for (const id of selection.selectedIds) {
      const reg = allItems.find((r) => r.id === id)
      if (!reg || reg.status !== 'pending') return false
    }
    return true
  }, [selection.selectedIds, selection.selectedCount, allItems])

  const reviewMutation = useMutation({
    mutationFn: async ({
      ids,
      decision,
      reason,
    }: {
      ids: string[]
      decision: 'approved' | 'rejected'
      reason?: string | null
    }) => {
      if (!claims) throw new Error('Missing claims')
      return reviewRetreatRegistrations({
        claims,
        reviewerUid: claim.status === 'admin' ? claim.uid : '',
        retreatId,
        ids,
        decision,
        rejectionReason: reason,
      })
    },
    onSuccess: () => {
      selection.clear()
      setApproveConfirmOpen(false)
      setRejectModalOpen(false)
      setRejectionReason('')
      setActionIds([])
      setCursor(undefined)
      setAllItems([])
      setNextCursor(null)
      lastAppendedKeyRef.current = null
      void queryClient.invalidateQueries({
        queryKey: adminKeys.retreatRegistrations(retreatId),
      })
    },
  })

  const openApprove = (ids: string[]) => {
    setActionIds(ids)
    setApproveConfirmOpen(true)
  }

  const openReject = (ids: string[]) => {
    setActionIds(ids)
    setRejectionReason('')
    setRejectModalOpen(true)
  }

  useEffect(() => {
    if (!retreat.data) return
    const initial: Record<string, string> = {}
    for (const field of retreat.data.extraFields) {
      initial[field.key] = ''
    }
    setExtraAnswers(initial)
  }, [retreat.data])

  const showProxyPanel =
    retreat.data?.quyenDangKy === 'proxy_only' ||
    retreat.data?.quyenDangKy === 'both'

  const searchMutation = useMutation({
    mutationFn: async () => {
      if (!claims || !retreat.data) {
        throw new Error('Missing search context')
      }
      const invite = await ensureRetreatRegistrationInvite(claims, {
        retreatId: retreat.data.id,
        createdBy: claim.status === 'admin' ? claim.uid : '',
      })
      return resumeMemberByPhone({
        token: invite.token,
        orgUnitId: retreat.data.orgUnitId,
        phone,
      })
    },
    onMutate: () => {
      setProxyError(null)
      setMemberMatches([])
      setSelectedMemberId(null)
    },
    onSuccess: (result) => {
      const matches = result.members.map(({ member }) => ({
        id: member.id,
        label: member.phapDanh || member.theDanh || member.cccd || member.id,
      }))
      setMemberMatches(matches)
      if (matches.length === 1) {
        setSelectedMemberId(matches[0]!.id)
      }
    },
    onError: (error) => {
      setProxyError(error.message)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!claims || !selectedMemberId) {
        throw new Error('Missing member')
      }
      return createRetreatRegistration({
        claims,
        retreatId,
        memberId: selectedMemberId,
        registeredVia: 'proxy',
        registeredBy: claim.status === 'admin' ? claim.uid : null,
        extraAnswers,
      })
    },
    onSuccess: async () => {
      setProxyError(null)
      setMemberMatches([])
      setSelectedMemberId(null)
      setPhone('')
      setCursor(undefined)
      setAllItems([])
      setNextCursor(null)
      lastAppendedKeyRef.current = null
      await queryClient.invalidateQueries({
        queryKey: adminKeys.retreatRegistrations(retreatId),
      })
    },
    onError: (error) => {
      setProxyError(error.message)
    },
  })

  const isLoading =
    retreat.isPending || (registrations.isPending && allItems.length === 0)

  if (claim.status === 'admin' && !manageRetreats) {
    return <AdminDenied />
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={2}>
            {retreat.data
              ? m.admin_retreat_registrations_title({ name: retreat.data.name })
              : m.admin_retreat_registrations_title_loading()}
          </Title>
          {retreat.data && (
            <Text size="sm" c="dimmed">
              {m.admin_retreat_registrations_subtitle()}
            </Text>
          )}
        </Stack>
        <Group gap="sm" wrap="wrap">
          <CopyRetreatRegistrationLinkButton retreatId={retreatId} />
          <Button
            component={Link}
            to="/admin/retreats/$id"
            params={{ id: retreatId }}
            variant="subtle"
          >
            {m.admin_retreat_registrations_back()}
          </Button>
        </Group>
      </Group>

      {retreat.isError && retreat.error && (
        <QueryErrorAlert error={retreat.error} />
      )}
      {registrations.isError && registrations.error && (
        <QueryErrorAlert error={registrations.error} />
      )}

      {!retreat.isError && !registrations.isError && (
        <>
          {selection.selectedCount > 0 && (
            <Group wrap="wrap">
              <Text>{m.admin_bulk_selected({ count: selection.selectedCount })}</Text>
              <Button
                disabled={!allSelectedPending}
                loading={reviewMutation.isPending}
                onClick={() => openApprove([...selection.selectedIds])}
              >
                {m.admin_retreat_registrations_approve()}
              </Button>
              <Button
                color="red"
                variant="light"
                disabled={!allSelectedPending}
                loading={reviewMutation.isPending}
                onClick={() => openReject([...selection.selectedIds])}
              >
                {m.admin_retreat_registrations_reject()}
              </Button>
            </Group>
          )}

          {reviewMutation.error && (
            <Text c="red" size="sm" role="alert">
              {reviewMutation.error.message}
            </Text>
          )}

          <AdminDataTable
            loading={isLoading}
            empty={!isLoading && allItems.length === 0}
            aria-label={m.admin_retreat_registrations_table_aria()}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    checked={selection.allLoadedSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAllLoaded}
                    aria-label={m.admin_bulk_selected({
                      count: selection.selectedCount,
                    })}
                  />
                </Table.Th>
                <Table.Th>
                  {m.admin_retreat_registrations_col_created_at()}
                </Table.Th>
                <Table.Th>{m.admin_retreat_registrations_col_member()}</Table.Th>
                <Table.Th>
                  {m.admin_retreat_registrations_col_registered_via()}
                </Table.Th>
                <Table.Th>{m.admin_retreat_registrations_col_status()}</Table.Th>
                <Table.Th>{m.admin_retreat_registrations_col_actions()}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allItems.map((registration) => (
                <Table.Tr key={registration.id}>
                  <Table.Td>
                    <Checkbox
                      checked={selection.selectedIds.has(registration.id)}
                      onChange={() => selection.toggle(registration.id)}
                      aria-label={registration.memberId}
                    />
                  </Table.Td>
                  <Table.Td>
                    {emptyCell(formatGmt7Date(registration.createdAt))}
                  </Table.Td>
                  <Table.Td>
                    <RegistrationMemberCell memberId={registration.memberId} />
                  </Table.Td>
                  <Table.Td>
                    {registeredViaLabel(registration.registeredVia)}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Badge
                        color={REGISTRATION_STATUS_COLOR[registration.status]}
                        variant="light"
                        radius="sm"
                      >
                        {registrationStatusLabel(registration.status)}
                      </Badge>
                      {registration.status === 'rejected' &&
                        registration.rejectionReason && (
                          <Text size="xs" c="dimmed">
                            {m.admin_retreat_registrations_reason({
                              reason: truncateReason(registration.rejectionReason),
                            })}
                          </Text>
                        )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    {registration.status === 'pending' && (
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          size="compact-xs"
                          variant="light"
                          loading={reviewMutation.isPending}
                          onClick={() => openApprove([registration.id])}
                        >
                          {m.admin_retreat_registrations_approve()}
                        </Button>
                        <Button
                          size="compact-xs"
                          color="red"
                          variant="light"
                          loading={reviewMutation.isPending}
                          onClick={() => openReject([registration.id])}
                        >
                          {m.admin_retreat_registrations_reject()}
                        </Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </AdminDataTable>

          {nextCursor && (
            <Button
              variant="light"
              loading={registrations.isFetching}
              onClick={() => setCursor(nextCursor)}
            >
              {m.admin_retreats_load_more()}
            </Button>
          )}
        </>
      )}

      {showProxyPanel && retreat.data && (
        <Paper p="xl" radius="md" maw={760} w="100%">
          <Stack gap="md">
            <Title order={3}>{m.admin_retreat_registrations_proxy_title()}</Title>
            <Group align="flex-end" wrap="wrap">
              <TextInput
                label={m.filler_phone_label()}
                value={phone}
                onChange={(event) => setPhone(event.currentTarget.value)}
                aria-label={m.filler_phone_label()}
                style={{ flex: 1 }}
              />
              <Button
                loading={searchMutation.isPending}
                disabled={!phone.trim()}
                onClick={() => searchMutation.mutate()}
              >
                {m.admin_retreat_registrations_proxy_search()}
              </Button>
            </Group>

            {memberMatches.length > 1 && (
              <Radio.Group
                label={m.admin_retreat_registrations_proxy_pick_member()}
                value={selectedMemberId}
                onChange={setSelectedMemberId}
              >
                <Stack gap="xs" mt="xs">
                  {memberMatches.map((match) => (
                    <Radio key={match.id} value={match.id} label={match.label} />
                  ))}
                </Stack>
              </Radio.Group>
            )}

            {selectedMemberId &&
              retreat.data.extraFields.map((field) => (
                <TextInput
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  value={extraAnswers[field.key] ?? ''}
                  onChange={(event) =>
                    setExtraAnswers((prev) => ({
                      ...prev,
                      [field.key]: event.currentTarget.value,
                    }))
                  }
                />
              ))}

            {proxyError && (
              <Text c="red" size="sm" role="alert">
                {proxyError}
              </Text>
            )}

            {selectedMemberId && (
              <Button
                loading={registerMutation.isPending}
                onClick={() => registerMutation.mutate()}
              >
                {m.admin_retreat_registrations_proxy_submit()}
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {isLoading && <Loader aria-label="loading" />}

      <Modal
        opened={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        title={m.admin_retreat_registrations_approve_confirm_title()}
        closeOnClickOutside={!reviewMutation.isPending}
        closeOnEscape={!reviewMutation.isPending}
      >
        <Text>{m.admin_retreat_registrations_approve_confirm_body()}</Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => setApproveConfirmOpen(false)}
            disabled={reviewMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            loading={reviewMutation.isPending}
            onClick={() =>
              reviewMutation.mutate({
                ids: actionIds,
                decision: 'approved',
              })
            }
          >
            {m.admin_retreat_registrations_approve()}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={m.admin_retreat_registrations_reject_title()}
        closeOnClickOutside={!reviewMutation.isPending}
        closeOnEscape={!reviewMutation.isPending}
      >
        <Textarea
          label={m.admin_retreat_registrations_reject_reason_label()}
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.currentTarget.value)}
          minRows={3}
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => setRejectModalOpen(false)}
            disabled={reviewMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            color="red"
            loading={reviewMutation.isPending}
            onClick={() =>
              reviewMutation.mutate({
                ids: actionIds,
                decision: 'rejected',
                reason: rejectionReason,
              })
            }
          >
            {m.admin_retreat_registrations_reject_confirm()}
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
